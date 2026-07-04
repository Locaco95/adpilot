"""Optimizer config + master kill switch, stored in SystemConfig (survives redeploys).

Business numbers (breakeven_roas, target_cpa, threshold) start at safe defaults
and are editable via the settings endpoint. `auto_execute` is the master switch:
OFF by default, so the loop only *proposes* until the operator sets real numbers
and flips it on. See [[project_adpilot_meta]].
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.optimizer import AccountConfig
from app.models import SystemConfig

CONFIG_KEY = "optimizer"

from app.analytics.metric_catalog import ALWAYS_AVAILABLE

DEFAULTS: dict = {
    "enabled": False,          # run the hourly loop at all
    "auto_execute": False,     # master kill switch — OFF until real numbers are set
    "breakeven_roas": 1.5,
    "target_cpa": 200.0,       # EGP — placeholder, edit before enabling
    "currency": "EGP",
    "human_approval_spend_threshold": 1000.0,
    # which metrics the operator has chosen to watch. Defaults to everything
    # available today; dormant ones are added as their data source comes online.
    "selected_metrics": ALWAYS_AVAILABLE,

    # ── AI Media Buyer — business numbers the operator fills in ──
    "avg_order_value": 0.0,          # AOV in currency; 0 = unknown
    "min_days_before_judgment": 5,   # don't judge before day 5 (research-backed)
    "min_daily_spend_per_adset": 0.0,  # algorithm-learning floor; 0 = ignore
    "max_frequency": 3.0,            # above this + CTR drop = fatigue
    "aggressiveness": "balanced",    # conservative | balanced | aggressive

    # ── AI Media Buyer — auto-execute LIMITS (past these → queue for approval) ──
    "ai_enabled": False,             # run the AI analyst layer
    "scale_step_pct": 30,            # how much a SCALE raises budget
    "decrease_step_pct": 25,         # how much a DECREASE lowers budget
    "max_auto_budget_change_pct": 50,   # auto-run budget moves up to this; bigger → approval
    "auto_kill": True,               # KILL/PAUSE may auto-run (stop-spend, safe)
    "auto_scale": False,             # SCALE may auto-run (spends more) — off by default
    "auto_decrease": True,           # DECREASE may auto-run (spends less, safe)
    # Don't act on the SAME ad set again within this many days — a change needs
    # time to breathe (rolling-window discipline; stacking edits resets learning).
    "action_cooldown_days": 3,
}


async def get_config(db: AsyncSession) -> dict:
    row = (await db.execute(select(SystemConfig).where(SystemConfig.key == CONFIG_KEY))).scalar_one_or_none()
    stored = row.value if row and isinstance(row.value, dict) else {}
    return {**DEFAULTS, **stored}


async def set_config(db: AsyncSession, patch: dict, actor: str | None = None) -> dict:
    row = (await db.execute(select(SystemConfig).where(SystemConfig.key == CONFIG_KEY))).scalar_one_or_none()
    merged = {**(row.value if row and isinstance(row.value, dict) else {}), **patch}
    if row:
        row.value = merged
        row.updated_by = actor
    else:
        db.add(SystemConfig(key=CONFIG_KEY, value=merged, updated_by=actor))
    await db.commit()
    return {**DEFAULTS, **merged}


def to_account_config(cfg: dict) -> AccountConfig:
    return AccountConfig(
        breakeven_roas=float(cfg["breakeven_roas"]),
        target_cpa=float(cfg["target_cpa"]),
        currency=cfg.get("currency", "EGP"),
        human_approval_spend_threshold=float(cfg["human_approval_spend_threshold"]),
    )
