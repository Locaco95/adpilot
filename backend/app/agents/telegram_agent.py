"""Telegram conversational agent: LLM tool-loop over the Snap account.

Reads execute immediately and feed back into the loop. Writes never execute
here — they become a PendingAction the webhook turns into an Approve/Reject
card; execution happens only on Approve (services/snap_campaigns.py).

State is in-memory per process (single-operator v1): per-chat history and
pending actions with a TTL. A Railway redeploy clears both.
"""
from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass, field

from app.platforms.snap import get_snap_client
from app.platforms.meta import get_meta_client
from app.services import llm
from app.settings import get_settings

MAX_LOOP_ITERATIONS = 6
HISTORY_MAX_MESSAGES = 12
PENDING_TTL_SEC = 15 * 60

SYSTEM_PROMPT = """You are AdPilot, a media-buying assistant for Snapchat AND Meta (Facebook) \
ad accounts, talking to the operator over Telegram. Reply in the user's language (Arabic or \
English). Be concise — short sentences, no markdown headers.

Snapchat tools have plain names (list_campaigns, create_campaign, ...). Meta tools are prefixed \
meta_ (meta_list_campaigns, meta_create_campaign, ...). When the user names a platform, use that \
one; if they don't say, ask which platform — never guess. Snap budgets/ids ≠ Meta budgets/ids.

You have tools to read live account data and to request write actions. \
Write actions (create campaign, change budget, pause/activate) are NOT executed by you — \
calling a write tool only creates an Approve/Reject card for the operator; nothing runs \
until they press Approve. Therefore NEVER ask for confirmation in text: as soon as you \
have all required parameters, call the write tool directly. The card IS the confirmation.

Rules:
- When the user references a campaign or ad squad by name, first use the list tools to find its id.
- Budgets are in the ad account currency (usually USD). Minimum daily budget is 20.
- New campaigns are always created PAUSED; tell the user they must activate them to spend.
- For create_campaign you need: name, objective, country_code, daily_budget, destination_url, \
headline (max 34 chars), drive_url (public Google Drive link to the creative), media_type. \
Ask for whatever is missing before calling the tool.
"""

TOOLS = [
    {"type": "function", "function": {
        "name": "get_account_overview",
        "description": "Ad account info: name, status, currency, timezone.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    }},
    {"type": "function", "function": {
        "name": "list_campaigns",
        "description": "List campaigns with id, name, status, objective, daily budget.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    }},
    {"type": "function", "function": {
        "name": "list_adsquads",
        "description": "List ad squads with id, name, campaign_id, status, budget, optimization goal.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    }},
    {"type": "function", "function": {
        "name": "get_campaign_stats",
        "description": "Stats for one campaign (spend, impressions, swipes, video views).",
        "parameters": {"type": "object", "properties": {
            "campaign_id": {"type": "string"},
        }, "required": ["campaign_id"]},
    }},
    # ---- writes (confirm-gated) ----
    {"type": "function", "function": {
        "name": "create_campaign",
        "description": "WRITE: create a full campaign (media from Drive + creative + campaign + ad squad + ad), all PAUSED. Requires operator approval.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string"},
            "objective": {"type": "string", "enum": ["AWARENESS_AND_ENGAGEMENT", "SALES", "TRAFFIC", "APP_PROMOTION", "LEADS"]},
            "country_code": {"type": "string", "description": "ISO-2, e.g. sa"},
            "daily_budget": {"type": "number", "minimum": 20},
            "destination_url": {"type": "string"},
            "headline": {"type": "string", "maxLength": 34},
            "drive_url": {"type": "string", "description": "Public Google Drive share link"},
            "media_type": {"type": "string", "enum": ["VIDEO", "IMAGE"]},
        }, "required": ["name", "objective", "country_code", "daily_budget",
                        "destination_url", "headline", "drive_url", "media_type"]},
    }},
    {"type": "function", "function": {
        "name": "update_budget",
        "description": "WRITE: change an ad squad's daily budget. Requires operator approval.",
        "parameters": {"type": "object", "properties": {
            "ad_squad_id": {"type": "string"},
            "daily_budget": {"type": "number", "minimum": 20},
        }, "required": ["ad_squad_id", "daily_budget"]},
    }},
    {"type": "function", "function": {
        "name": "set_campaign_status",
        "description": "WRITE (Snapchat): pause or activate a Snapchat campaign. Requires operator approval.",
        "parameters": {"type": "object", "properties": {
            "campaign_id": {"type": "string"},
            "status": {"type": "string", "enum": ["ACTIVE", "PAUSED"]},
        }, "required": ["campaign_id", "status"]},
    }},
    # ---- Meta reads ----
    {"type": "function", "function": {
        "name": "meta_get_account_overview",
        "description": "Meta (Facebook) ad account info: name, status, currency, timezone, spend.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    }},
    {"type": "function", "function": {
        "name": "meta_list_campaigns",
        "description": "List Meta campaigns with id, name, status, objective, daily budget.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    }},
    # ---- Meta writes (confirm-gated) ----
    {"type": "function", "function": {
        "name": "meta_create_campaign",
        "description": "WRITE (Meta): create a PAUSED campaign + ad set (targeting + budget). Requires operator approval. No creative/Drive needed at this layer.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string"},
            "objective": {"type": "string", "enum": ["OUTCOME_TRAFFIC", "OUTCOME_SALES", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS"]},
            "country_code": {"type": "string", "description": "ISO-2, e.g. SA"},
            "daily_budget": {"type": "number", "description": "In the account currency; Meta enforces a per-account minimum"},
        }, "required": ["name", "objective", "country_code", "daily_budget"]},
    }},
]

WRITE_TOOLS = {
    "create_campaign", "update_budget", "set_campaign_status",
    "meta_create_campaign",
}


@dataclass
class PendingAction:
    id: str
    tool: str
    args: dict
    summary: str
    created_at: float = field(default_factory=time.monotonic)


@dataclass
class AgentReply:
    text: str
    pending: PendingAction | None = None  # set → webhook adds Approve/Reject buttons


_histories: dict[int, list[dict]] = {}
_pending: dict[str, PendingAction] = {}


def get_pending(action_id: str) -> PendingAction | None:
    a = _pending.get(action_id)
    if a and time.monotonic() - a.created_at > PENDING_TTL_SEC:
        del _pending[action_id]
        return None
    return a


def pop_pending(action_id: str) -> PendingAction | None:
    a = get_pending(action_id)
    if a:
        del _pending[a.id]
    return a


async def _run_read_tool(name: str, args: dict) -> str:
    s = get_settings()
    client = get_snap_client()
    acct = s.snapchat_ad_account_id
    if name == "get_account_overview":
        data = await client.get(f"/adaccounts/{acct}")
        a = data["adaccounts"][0]["adaccount"]
        return json.dumps({k: a.get(k) for k in ("name", "status", "currency", "timezone", "id")})
    if name == "list_campaigns":
        data = await client.get(f"/adaccounts/{acct}/campaigns")
        out = [{
            "id": w["campaign"]["id"],
            "name": w["campaign"]["name"],
            "status": w["campaign"]["status"],
            "objective": (w["campaign"].get("objective_v2_properties") or {}).get("objective_v2_type")
                         or w["campaign"].get("objective"),
            "daily_budget_micro": w["campaign"].get("daily_budget_micro"),
        } for w in data.get("campaigns", [])]
        return json.dumps(out)
    if name == "list_adsquads":
        data = await client.get(f"/adaccounts/{acct}/adsquads")
        out = [{
            "id": w["adsquad"]["id"],
            "name": w["adsquad"]["name"],
            "campaign_id": w["adsquad"]["campaign_id"],
            "status": w["adsquad"]["status"],
            "daily_budget_micro": w["adsquad"].get("daily_budget_micro"),
            "optimization_goal": w["adsquad"].get("optimization_goal"),
        } for w in data.get("adsquads", [])]
        return json.dumps(out)
    if name == "get_campaign_stats":
        data = await client.get(
            f"/campaigns/{args['campaign_id']}/stats",
            params={"granularity": "TOTAL", "fields": "spend,impressions,swipes,video_views"},
        )
        return json.dumps(data.get("total_stats", data))

    # ---- Meta reads ----
    if name == "meta_get_account_overview":
        m = get_meta_client()
        macct = s.meta_ad_account_id
        data = await m.get(f"/{macct}", params={"fields": "name,account_status,currency,timezone_name,amount_spent"})
        return json.dumps(data)
    if name == "meta_list_campaigns":
        m = get_meta_client()
        macct = s.meta_ad_account_id
        data = await m.get(f"/{macct}/campaigns", params={"fields": "name,status,objective,daily_budget", "limit": 100})
        return json.dumps(data.get("data", []))

    return json.dumps({"error": f"unknown tool {name}"})


def _summarize_write(tool: str, args: dict) -> str:
    if tool == "create_campaign":
        return (
            "Create campaign (PAUSED):\n"
            f"• name: {args.get('name')}\n"
            f"• objective: {args.get('objective')}\n"
            f"• region: {str(args.get('country_code', '')).upper()}\n"
            f"• daily budget: {args.get('daily_budget')}\n"
            f"• headline: {args.get('headline')}\n"
            f"• destination: {args.get('destination_url')}\n"
            f"• creative: {args.get('media_type')} from Drive"
        )
    if tool == "update_budget":
        return (
            "Change ad squad budget:\n"
            f"• ad squad: {args.get('ad_squad_id')}\n"
            f"• new daily budget: {args.get('daily_budget')}"
        )
    if tool == "set_campaign_status":
        return (
            f"Set campaign {args.get('status')}:\n"
            f"• campaign: {args.get('campaign_id')}"
        )
    if tool == "meta_create_campaign":
        return (
            "Create Meta campaign + ad set (PAUSED):\n"
            f"• name: {args.get('name')}\n"
            f"• objective: {args.get('objective')}\n"
            f"• region: {str(args.get('country_code', '')).upper()}\n"
            f"• daily budget: {args.get('daily_budget')}"
        )
    return f"{tool}: {json.dumps(args)}"


async def handle_message(chat_id: int, text: str) -> AgentReply:
    history = _histories.setdefault(chat_id, [])
    history.append({"role": "user", "content": text})
    del history[:-HISTORY_MAX_MESSAGES]

    messages = [{"role": "system", "content": SYSTEM_PROMPT}, *history]

    for _ in range(MAX_LOOP_ITERATIONS):
        assistant = await llm.chat(messages, tools=TOOLS)
        tool_calls = assistant.get("tool_calls") or []

        if not tool_calls:
            reply = assistant.get("content") or "…"
            history.append({"role": "assistant", "content": reply})
            del history[:-HISTORY_MAX_MESSAGES]
            return AgentReply(text=reply)

        # keep the assistant turn (needed so tool results have a parent)
        messages.append(assistant)

        for tc in tool_calls:
            name = tc["function"]["name"]
            try:
                args = json.loads(tc["function"].get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}

            if name in WRITE_TOOLS:
                action = PendingAction(
                    id=uuid.uuid4().hex[:12],
                    tool=name,
                    args=args,
                    summary=_summarize_write(name, args),
                )
                _pending[action.id] = action
                note = f"Requested approval for: {action.summary}"
                history.append({"role": "assistant", "content": note})
                del history[:-HISTORY_MAX_MESSAGES]
                return AgentReply(
                    text=f"⚠️ Approval needed\n\n{action.summary}",
                    pending=action,
                )

            try:
                result = await _run_read_tool(name, args)
            except Exception as e:  # surface Snap errors into the loop
                result = json.dumps({"error": str(e)[:300]})
            messages.append({
                "role": "tool",
                "tool_call_id": tc.get("id", ""),
                "content": result,
            })

    return AgentReply(text="I got stuck in a loop — please rephrase that.")


def record_decision(chat_id: int, decision_note: str) -> None:
    """Keep approve/reject outcomes in the conversation history."""
    history = _histories.setdefault(chat_id, [])
    history.append({"role": "assistant", "content": decision_note})
    del history[:-HISTORY_MAX_MESSAGES]
