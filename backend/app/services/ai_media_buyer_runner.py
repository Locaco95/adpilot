"""Run the AI Media Buyer: analyze → apply auto-execute limits → act or queue.

The AI recommends; THIS deterministic layer decides what may auto-run based on
the operator's config limits, and performs the Meta write. Advisory actions
(ROTATE_CREATIVE, DUPLICATE_WINNER, FLAG_FUNNEL) always queue — they need human
or creative work, so the AI can't execute them.
"""
from __future__ import annotations

import logging

from app.agents import ai_media_buyer
from app.database import AsyncSessionLocal
from app.models import Action, AuditLog
from app.services import meta_campaigns, optimizer_config
from app.services.optimizer_data import build_adset_metrics

logger = logging.getLogger("adpilot.ai_media_buyer")

# Only budget/status actions can be executed by code. The rest are advice.
_EXECUTABLE = {"KILL", "SCALE", "DECREASE"}


def _may_auto(action: str, confidence: str, cfg: dict) -> bool:
    """Apply the operator's per-action auto-execute limits."""
    if confidence != "high":
        return False  # never auto-run on medium/low confidence
    if action == "KILL":
        return bool(cfg.get("auto_kill", True))
    if action == "DECREASE":
        return bool(cfg.get("auto_decrease", True))
    if action == "SCALE":
        if not cfg.get("auto_scale", False):
            return False
        return int(cfg.get("scale_step_pct", 30)) <= int(cfg.get("max_auto_budget_change_pct", 50))
    return False


async def _execute(rec: dict, cfg: dict) -> str:
    action = rec["action"]
    eid = rec["entity_id"]
    if action == "KILL":
        await meta_campaigns.set_adset_status(eid, "PAUSED")
        return f"paused {eid}"
    if action == "SCALE":
        res = await meta_campaigns.scale_adset_budget(eid, int(cfg.get("scale_step_pct", 30)))
        return f"scaled {eid}: {res['old_daily_budget']}→{res['new_daily_budget']}"
    if action == "DECREASE":
        res = await meta_campaigns.scale_adset_budget(eid, -int(cfg.get("decrease_step_pct", 25)))
        return f"decreased {eid}: {res['old_daily_budget']}→{res['new_daily_budget']}"
    raise ValueError(f"{action} is not executable")


async def run_once(model: str | None = None) -> dict:
    """One AI pass. Returns a summary with the recommendations (for the UI)."""
    async with AsyncSessionLocal() as db:
        cfg = await optimizer_config.get_config(db)
        if not cfg.get("ai_enabled"):
            return {"ran": False, "reason": "AI media buyer disabled", "recommendations": []}

        entities = await build_adset_metrics()
        recs = await ai_media_buyer.analyze(entities, cfg, model=model)

        auto = bool(cfg.get("auto_execute"))
        executed, queued = 0, 0
        for rec in recs:
            rec["executed"] = False
            if rec["action"] == "HOLD":
                continue
            can_auto = auto and rec["action"] in _EXECUTABLE and _may_auto(rec["action"], rec["confidence"], cfg)
            if can_auto:
                try:
                    detail = await _execute(rec, cfg)
                    rec["executed"] = True
                    rec["result"] = detail
                    db.add(AuditLog(action="ai_executed", tier=1,
                        detail=f"{rec['action']} — {rec['reasoning'][:200]} — {detail}",
                        actor="ai_media_buyer", entity_type="ad_set", entity_id=None,
                        params_snapshot=rec))
                    executed += 1
                except Exception as e:
                    logger.exception("AI execute failed for %s", rec["entity_id"])
                    rec["result"] = f"execute failed: {str(e)[:200]}"
                    db.add(AuditLog(action="ai_execute_failed", tier=1,
                        detail=f"{rec['action']} {rec['entity_id']}: {str(e)[:200]}",
                        actor="ai_media_buyer", entity_type="ad_set", entity_id=None,
                        params_snapshot=rec))
            else:
                db.add(Action(tier=3, type=f"ai_{rec['action'].lower()}",
                    description=f"{rec['entity_name']}: {rec['diagnosis'][:200]}",
                    rationale=rec["reasoning"][:1000],
                    params={"meta_entity_id": rec["entity_id"], "recommendation": rec},
                    status="pending"))
                queued += 1

        await db.commit()
        return {"ran": True, "auto_execute": auto, "evaluated": len(entities),
                "executed": executed, "queued": queued, "recommendations": recs}
