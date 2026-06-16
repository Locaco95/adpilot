"""Telegram webhook: messages → agent loop; callbacks → execute approved writes.

Auth model (Telegram can't send our JWT): the webhook path carries a random
secret, and only the allowlisted TELEGRAM_CHAT_ID may operate the bot. An
unknown chat gets told its chat id once so the operator can configure it.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request

from app.agents import telegram_agent
from app.database import AsyncSessionLocal
from app.platforms.telegram import get_telegram_client, TelegramError
from app.schemas.snap_create import CreateCampaignRequest
from app.schemas.meta_create import CreateMetaCampaignRequest
from app.services import snap_campaigns, meta_campaigns
from app.settings import get_settings

logger = logging.getLogger("adpilot.telegram")

router = APIRouter(prefix="/telegram", tags=["telegram"])


def _authorized_chat(chat_id: int) -> bool:
    s = get_settings()
    return bool(s.telegram_chat_id) and str(chat_id) == str(s.telegram_chat_id)


async def _execute_action(action: telegram_agent.PendingAction) -> str:
    """Run an approved write through the shared service. Returns a result text."""
    if action.tool == "create_campaign":
        # Telegram still sends drive_url (legacy); create_full_campaign needs a db
        # session for the shared media layer.
        async with AsyncSessionLocal() as db:
            result = await snap_campaigns.create_full_campaign(
                CreateCampaignRequest(**action.args), db
            )
        return (
            "✅ Campaign created (PAUSED — activate it to spend)\n"
            f"campaign: {result.campaign_id}\n"
            f"ad squad: {result.ad_squad_id}\n"
            f"ad: {result.ad_id}"
        )
    if action.tool == "update_budget":
        updated = await snap_campaigns.update_adsquad_budget(
            action.args["ad_squad_id"], float(action.args["daily_budget"])
        )
        budget = updated.get("daily_budget_micro", 0) / 1_000_000
        return f"✅ Budget updated: {updated.get('name')} → {budget:g}/day"
    if action.tool == "set_campaign_status":
        updated = await snap_campaigns.set_campaign_status(
            action.args["campaign_id"], action.args["status"]
        )
        return f"✅ Campaign {updated.get('name')} is now {updated.get('status')}"
    if action.tool == "meta_create_campaign":
        result = await meta_campaigns.create_campaign_with_adset(
            CreateMetaCampaignRequest(**action.args)
        )
        return (
            "✅ Meta campaign created (PAUSED — activate it to spend)\n"
            f"campaign: {result.campaign_id}\n"
            f"ad set: {result.ad_set_id}"
        )
    return f"Unknown action tool: {action.tool}"


@router.post("/webhook/{secret}")
async def webhook(secret: str, request: Request):
    s = get_settings()
    if not s.telegram_webhook_secret or secret != s.telegram_webhook_secret:
        raise HTTPException(403, "Bad webhook secret")

    update = await request.json()
    tg = get_telegram_client()

    # ---- inline button presses (approve / reject) ----
    callback = update.get("callback_query")
    if callback:
        chat_id = callback["message"]["chat"]["id"]
        message_id = callback["message"]["message_id"]
        data = callback.get("data", "")
        if not _authorized_chat(chat_id):
            await tg.answer_callback_query(callback["id"], "Unauthorized")
            return {"ok": True}

        verb, _, action_id = data.partition(":")
        action = telegram_agent.pop_pending(action_id)
        if not action:
            await tg.answer_callback_query(callback["id"], "Expired")
            await tg.edit_message_text(chat_id, message_id, "⌛ This request expired. Ask again.")
            return {"ok": True}

        if verb == "reject":
            await tg.answer_callback_query(callback["id"], "Rejected")
            await tg.edit_message_text(chat_id, message_id, f"❌ Rejected\n\n{action.summary}")
            telegram_agent.record_decision(chat_id, f"Operator REJECTED: {action.summary}")
            return {"ok": True}

        if verb == "approve":
            await tg.answer_callback_query(callback["id"], "Executing…")
            try:
                result_text = await _execute_action(action)
            except Exception as e:
                result_text = f"❌ Execution failed:\n{str(e)[:500]}"
            await tg.edit_message_text(chat_id, message_id, f"{action.summary}\n\n{result_text}")
            telegram_agent.record_decision(chat_id, f"Operator APPROVED: {action.summary} → {result_text}")
            return {"ok": True}

        await tg.answer_callback_query(callback["id"])
        return {"ok": True}

    # ---- plain messages ----
    message = update.get("message") or update.get("edited_message")
    if not message:
        return {"ok": True}
    chat_id = message["chat"]["id"]
    text = (message.get("text") or "").strip()
    if not text:
        return {"ok": True}

    if not _authorized_chat(chat_id):
        # one helpful reply so the operator can find their chat id
        try:
            await tg.send_message(
                chat_id,
                f"Unauthorized. If you are the operator, set TELEGRAM_CHAT_ID={chat_id} "
                "in the backend environment.",
            )
        except TelegramError:
            logger.exception("telegram send failed (unauthorized hint)")
        return {"ok": True}

    try:
        from app.database import AsyncSessionLocal
        from app.services import llm_models
        async with AsyncSessionLocal() as db:
            model = await llm_models.get_current_model(db)
        reply = await telegram_agent.handle_message(chat_id, text, model=model)
    except Exception as e:
        logger.exception("agent error")
        try:
            await tg.send_message(chat_id, f"⚠️ Agent error: {str(e)[:300]}")
        except TelegramError:
            pass
        return {"ok": True}

    buttons = None
    if reply.pending:
        buttons = [[
            {"text": "✅ Approve", "callback_data": f"approve:{reply.pending.id}"},
            {"text": "❌ Reject", "callback_data": f"reject:{reply.pending.id}"},
        ]]
    try:
        await tg.send_message(chat_id, reply.text, buttons=buttons)
    except TelegramError:
        logger.exception("telegram send failed")
    return {"ok": True}
