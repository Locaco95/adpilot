"""Operator-entered real orders per ad set — the ground truth Meta can't see.

For Cash-on-Delivery, Meta's pixel/CAPI attributes only a fraction of sales, so
its ROAS/CPA are misleading (often 0). The operator enters the TRUE order count
per ad set from their store (easy-orders); we compute true revenue/CPA/ROAS from
it (orders × AOV) and feed that to the AI so it judges on reality, not Meta's
COD blind spot.

Stored in SystemConfig (JSON) keyed by Meta ad-set id — no schema change.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SystemConfig

KEY = "real_orders"


async def _load(db: AsyncSession) -> dict:
    row = (await db.execute(select(SystemConfig).where(SystemConfig.key == KEY))).scalar_one_or_none()
    return row.value if row and isinstance(row.value, dict) else {}


async def get_all(db: AsyncSession) -> dict:
    """{entity_id: {"orders": int, "at": iso}}"""
    return await _load(db)


async def set_orders(db: AsyncSession, entity_id: str, orders: int, actor: str | None = None) -> dict:
    data = await _load(db)
    data[entity_id] = {"orders": int(orders), "at": datetime.now(timezone.utc).isoformat()}
    row = (await db.execute(select(SystemConfig).where(SystemConfig.key == KEY))).scalar_one_or_none()
    if row:
        row.value = data
        row.updated_by = actor
    else:
        db.add(SystemConfig(key=KEY, value=data, updated_by=actor))
    await db.commit()
    return data


def true_metrics(orders: int, spend: float, aov: float) -> dict:
    """Derive true CPA/ROAS/revenue/profit-proxy from real orders + AOV."""
    revenue = orders * aov if aov else 0.0
    return {
        "real_orders": orders,
        "real_revenue": revenue,
        "real_cpa": (spend / orders) if orders else None,
        "real_roas": (revenue / spend) if spend and revenue else None,
    }
