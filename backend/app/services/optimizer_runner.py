"""Optimizer loop: evaluate every ad set → execute or queue → log.

Guardrails (this touches live budgets):
  1. Master kill switch: cfg['auto_execute'] must be True or NOTHING executes.
  2. Only KILL / PAUSE (stop-spend) and SCALE auto-run, and only when the engine
     says human_approval_required=False. Everything else is queued for approval.
  3. Every decision — executed, queued, or skipped — is written to audit_log.

Meta entity ids are strings and aren't in our `campaigns` table, so pending
actions carry the id in `params`, not the FK column.
"""
from __future__ import annotations

import logging

from app.analytics.optimizer import Recommendation, evaluate
from app.database import AsyncSessionLocal
from app.models import Action, AuditLog
from app.services import meta_campaigns, optimizer_config
from app.services.optimizer_data import build_adset_snapshots

logger = logging.getLogger("adpilot.optimizer")

# Actions the loop may execute automatically (stop-spend + measured scale).
AUTO_EXECUTABLE = {"KILL", "PAUSE", "SCALE"}


async def _execute(rec: Recommendation, scale_step_pct: int) -> str:
    """Perform the Meta write for an auto-approved recommendation."""
    if rec.recommended_action in ("KILL", "PAUSE"):
        await meta_campaigns.set_adset_status(rec.entity_id, "PAUSED")
        return f"paused ad set {rec.entity_id}"
    if rec.recommended_action == "SCALE":
        res = await meta_campaigns.scale_adset_budget(rec.entity_id, scale_step_pct)
        return f"scaled {rec.entity_id}: {res['old_daily_budget']}→{res['new_daily_budget']}"
    raise ValueError(f"{rec.recommended_action} is not auto-executable")


async def run_once() -> dict:
    """One optimizer pass. Returns a summary. Safe to call from the scheduler."""
    async with AsyncSessionLocal() as db:
        cfg = await optimizer_config.get_config(db)
        if not cfg.get("enabled"):
            return {"ran": False, "reason": "optimizer disabled"}

        acct_cfg = optimizer_config.to_account_config(cfg)
        auto = bool(cfg.get("auto_execute"))
        scale_step = int(acct_cfg.budget_scale_step_pct)

        snapshots = await build_adset_snapshots()
        executed, queued, skipped = 0, 0, 0

        for snap in snapshots:
            rec = evaluate(snap, acct_cfg)
            can_auto = (
                auto
                and rec.recommended_action in AUTO_EXECUTABLE
                and not rec.human_approval_required
            )

            if rec.recommended_action == "HOLD":
                skipped += 1
                continue

            if can_auto:
                try:
                    detail = await _execute(rec, scale_step)
                    db.add(AuditLog(
                        action="optimizer_executed", tier=1,
                        detail=f"{rec.recommended_action} — {rec.matched_rule} — {detail}",
                        actor="optimizer", entity_type="ad_set", entity_id=None,
                        params_snapshot=rec.to_json(),
                    ))
                    executed += 1
                except Exception as e:  # a failed write must never crash the loop
                    logger.exception("optimizer execute failed for %s", rec.entity_id)
                    db.add(AuditLog(
                        action="optimizer_execute_failed", tier=1,
                        detail=f"{rec.recommended_action} {rec.entity_id}: {str(e)[:300]}",
                        actor="optimizer", entity_type="ad_set", entity_id=None,
                        params_snapshot=rec.to_json(),
                    ))
                    skipped += 1
            else:
                # queue as a Tier-3 pending action for operator approval
                db.add(Action(
                    tier=3, type=f"optimizer_{rec.recommended_action.lower()}",
                    description=rec.summary,
                    rationale=f"{rec.matched_rule} · confidence {rec.confidence}",
                    params={"meta_entity_id": rec.entity_id, "recommendation": rec.to_json()},
                    status="pending",
                ))
                queued += 1

        await db.commit()
        return {"ran": True, "auto_execute": auto, "evaluated": len(snapshots),
                "executed": executed, "queued": queued, "skipped": skipped}
