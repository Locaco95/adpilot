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

DEFAULTS: dict = {
    "enabled": False,          # run the hourly loop at all
    "auto_execute": False,     # master kill switch — OFF until real numbers are set
    "breakeven_roas": 1.5,
    "target_cpa": 200.0,       # EGP — placeholder, edit before enabling
    "currency": "EGP",
    "human_approval_spend_threshold": 1000.0,
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
