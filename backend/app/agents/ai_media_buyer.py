"""AI Media Buyer — an LLM analyst that reads correlated metrics per ad set and
recommends one senior-buyer action, WITH its reasoning.

Design: the LLM does the *analysis and recommendation* (diagnosing how metrics
interrelate — the thing flat rules can't). It NEVER calls the Meta write API.
Its structured output feeds the deterministic executor, which applies the
operator's auto-execute limits (see services/optimizer_runner). AI reasons,
code executes.

The model is the operator's chosen one (settings.llm) — passed in by the caller.
Output is strict JSON so the executor can act on it deterministically.
"""
from __future__ import annotations

import json

from app.services import llm

# Actions the AI may recommend (senior-buyer toolkit).
ACTIONS = ["KILL", "SCALE", "DECREASE", "HOLD", "ROTATE_CREATIVE", "DUPLICATE_WINNER", "FLAG_FUNNEL"]

# ── The system prompt — a senior media buyer's brain, research-backed ──
# Sources: coinis.com kill-framework, fabfunnel 7 rules, ALM 2026 optimization.
SYSTEM_PROMPT = """You are a SENIOR Meta (Facebook/Instagram) media buyer with 10+ years \
managing e-commerce ad accounts. You manage live campaigns AFTER launch. You are paid to be \
RIGHT, not fast. You diagnose root causes before acting — a junior reacts to a bad number, a \
senior asks WHY it's bad first.

CORE METHOD — diagnose in SIGNAL ORDER before deciding (this is non-negotiable):
1. CREATIVE (CTR, CPC, hook rate) — is the ad stopping the scroll?
2. FUNNEL (add-to-cart, checkout, landing page views) — is the traffic qualified? does the page sell?
3. PROFITABILITY (CPA, ROAS) — do the economics work?

CPA and ROAS are SYMPTOMS, not diagnoses. Never act on them alone — decompose first.

KEY INTERRELATIONS you must reason through (this is why you exist, not a rulebook):
- HIGH CTR + LOW/ZERO conversions → "the ad works, the page doesn't." This is a FUNNEL problem, \
NOT an ad problem. Recommend FLAG_FUNNEL (tell the operator to fix the page). DO NOT KILL a \
high-CTR ad for zero sales if it hasn't had a fair chance — killing it destroys a working ad.
- LOW CTR + high CPM → weak creative or wrong audience. Creative issue → ROTATE_CREATIVE.
- Good CTR + good conversions + high CPA → CPM (auction competition) is the culprit, or the \
audience is too narrow. Consider HOLD + widen audience, not KILL.
- Frequency > {max_frequency} AND CTR dropping → creative FATIGUE, not failure. ROTATE_CREATIVE, don't kill.
- Rising CPM but stable CTR/CVR → auction competition increased. HOLD, flag for audience expansion.

HARD RULES (these override nuance):
- Spent >= 3x target CPA with ZERO conversions AND zero add-to-cart AND zero checkout → KILL. \
(If it has add-to-cart or checkout but no purchase, it's a FUNNEL problem → FLAG_FUNNEL, not KILL.)
- Do NOT judge an ad set younger than {min_days} days or below the minimum spend floor → HOLD \
("still learning / not enough data"). Days 1-4 are expensive noise.
- Evaluate trends over a rolling 3-5 day window, never a single day.

SCALING (only when genuinely winning):
- CPA at/below target AND ROAS >= {breakeven_roas} x 1.3, sustained → SCALE (raise budget). \
Never scale an ad set with a funnel problem or in the learning phase.
- A proven winner already scaled hard → DUPLICATE_WINNER (fresh ad set) beats over-scaling one.

DECREASING:
- Profitable but softening (CPA creeping toward target, ROAS above breakeven but falling) → \
DECREASE budget to protect efficiency rather than kill outright.

OPERATOR TARGETS (their actual business numbers — respect these):
- Target CPA: {target_cpa} {currency}
- Breakeven ROAS: {breakeven_roas}
- Average order value: {avg_order_value} {currency}
- Max frequency before fatigue: {max_frequency}
- Aggressiveness: {aggressiveness} (conservative = slower to scale, faster to protect; \
aggressive = scale winners harder, cut losers faster)

CONFIDENCE: only "high" when the data is unambiguous and there's enough spend/time. If data is \
thin, early, or contradictory, say "low" or "medium" and prefer HOLD. Never fake certainty.

For EACH ad set you are given, output ONE object. Return STRICT JSON only — an array, no prose \
outside it:
[{{
  "entity_id": "<id>",
  "entity_name": "<name>",
  "diagnosis": "<the WHY, in signal order — one or two sentences a human trusts>",
  "action": "KILL|SCALE|DECREASE|HOLD|ROTATE_CREATIVE|DUPLICATE_WINNER|FLAG_FUNNEL",
  "reasoning": "<why THIS action follows from the diagnosis and the operator's targets>",
  "confidence": "high|medium|low"
}}]
"""


def build_system_prompt(cfg: dict) -> str:
    return SYSTEM_PROMPT.format(
        target_cpa=cfg.get("target_cpa", 0),
        breakeven_roas=cfg.get("breakeven_roas", 1.5),
        avg_order_value=cfg.get("avg_order_value", 0),
        currency=cfg.get("currency", "EGP"),
        max_frequency=cfg.get("max_frequency", 3.0),
        min_days=cfg.get("min_days_before_judgment", 5),
        aggressiveness=cfg.get("aggressiveness", "balanced"),
    )


def _entities_payload(entities: list[dict]) -> str:
    """Compact, LLM-friendly rendering of each ad set's metrics."""
    lines = []
    for e in entities:
        m = e.get("metrics", {})
        kept = {k: (round(v, 3) if isinstance(v, float) else v) for k, v in m.items() if v is not None}
        lines.append(json.dumps({"entity_id": e["entity_id"], "entity_name": e["entity_name"], "metrics": kept}))
    return "\n".join(lines)


async def analyze(entities: list[dict], cfg: dict, model: str | None = None,
                  history: str = "") -> list[dict]:
    """Return one recommendation dict per ad set. On any failure, returns [].

    `history` is this account's decision→outcome track record + lessons (from
    ai_memory) — injected so the AI reasons with its own past. Empty when new."""
    if not entities:
        return []
    user = "Analyze these ad sets and return the JSON array of recommendations:\n\n" + _entities_payload(entities)
    if history:
        user += "\n\n--- YOUR TRACK RECORD IN THIS ACCOUNT ---\n" + history
    messages = [
        {"role": "system", "content": build_system_prompt(cfg)},
        {"role": "user", "content": user},
    ]
    resp = await llm.chat(messages, model=model)
    content = (resp.get("content") or "").strip()
    return _parse(content, entities)


REVIEW_PROMPT = """You are a senior media buyer reviewing YOUR OWN past decisions on this \
ad account to get better. Below is a history of decisions you made and what the metrics did \
afterward. Distill 3-6 SHORT, concrete lessons for THIS account — patterns worth remembering \
(e.g. "scaling above 30% here spiked CPA within 2 days" or "FLAG_FUNNEL ad sets never recovered \
without a page fix"). Only lessons the data actually supports; if the data is too thin, say so \
and return fewer. Return STRICT JSON: {"lessons": ["...", "..."]}"""


async def self_review(history: str, model: str | None = None) -> list[str]:
    """Ask the model to distill lessons from its own decision→outcome history."""
    if not history.strip():
        return []
    resp = await llm.chat(
        [{"role": "system", "content": REVIEW_PROMPT},
         {"role": "user", "content": history}],
        model=model,
    )
    content = (resp.get("content") or "").strip()
    s, e = content.find("{"), content.rfind("}")
    if s == -1 or e == -1:
        return []
    try:
        data = json.loads(content[s:e + 1])
    except json.JSONDecodeError:
        return []
    lessons = data.get("lessons", [])
    return [str(l).strip() for l in lessons if isinstance(l, str) and l.strip()][:6]


def _parse(content: str, entities: list[dict]) -> list[dict]:
    """Extract the JSON array from the model output; validate each item."""
    # strip markdown fences if present
    if content.startswith("```"):
        content = content.split("```", 2)[1]
        if content.startswith("json"):
            content = content[4:]
    start, end = content.find("["), content.rfind("]")
    if start == -1 or end == -1:
        return []
    try:
        arr = json.loads(content[start:end + 1])
    except json.JSONDecodeError:
        return []
    valid_ids = {e["entity_id"] for e in entities}
    out = []
    for item in arr:
        if not isinstance(item, dict):
            continue
        action = item.get("action")
        if item.get("entity_id") in valid_ids and action in ACTIONS:
            out.append({
                "entity_id": item["entity_id"],
                "entity_name": item.get("entity_name", ""),
                "diagnosis": item.get("diagnosis", ""),
                "action": action,
                "reasoning": item.get("reasoning", ""),
                "confidence": item.get("confidence", "low"),
            })
    return out


if __name__ == "__main__":
    ents = [{"entity_id": "A", "entity_name": "set A", "metrics": {}},
            {"entity_id": "B", "entity_name": "set B", "metrics": {}}]
    # fenced JSON, one invalid action, one unknown id → only the valid one survives
    raw = '''```json
    [
      {"entity_id":"A","action":"FLAG_FUNNEL","diagnosis":"high CTR, 0 sales","reasoning":"page","confidence":"high"},
      {"entity_id":"B","action":"NUKE","reasoning":"bad"},
      {"entity_id":"ZZ","action":"KILL"}
    ]
    ```'''
    r = _parse(raw, ents)
    assert len(r) == 1 and r[0]["entity_id"] == "A" and r[0]["action"] == "FLAG_FUNNEL", r
    assert _parse("no json here", ents) == []
    assert _parse("[bad json", ents) == []
    print("OK ai_media_buyer._parse self-check passed")

