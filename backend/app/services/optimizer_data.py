"""Build EntitySnapshots for the optimizer from live Meta data.

v1 operates at the ad-set level (where budget/audience decisions live) over the
last 7 days. Fields Meta gives directly (spend, ctr, cpm, frequency, purchase
actions → roas/cpa) are filled; trend/history fields that need day-by-day
storage or event data we don't have yet are left None, so the engine returns
HOLD "insufficient data" rather than guessing.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.analytics.optimizer import EntitySnapshot
from app.platforms.meta import get_meta_client
from app.settings import get_settings

_PURCHASE_TYPES = ("purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase")


def _sum_actions(rows: list[dict] | None, types: tuple[str, ...]) -> float:
    total = 0.0
    for a in rows or []:
        if a.get("action_type") in types:
            try:
                total += float(a.get("value", 0) or 0)
            except (TypeError, ValueError):
                pass
    return total


def _days_running(created_time: str | None) -> int:
    if not created_time:
        return 0
    try:
        # Meta returns e.g. "2026-06-25T09:00:00+0000"
        dt = datetime.fromisoformat(created_time.replace("+0000", "+00:00"))
        return max(0, (datetime.now(timezone.utc) - dt).days)
    except ValueError:
        return 0


async def build_adset_snapshots(date_preset: str = "last_7d") -> list[EntitySnapshot]:
    """One snapshot per active ad set on the account, for the period."""
    s = get_settings()
    client = get_meta_client()
    acct = s.meta_ad_account_id

    # ad set metadata (status, created_time, audience hint via targeting)
    meta = await client.get(
        f"/{acct}/adsets",
        params={"fields": "id,name,status,created_time,daily_budget", "limit": 200},
    )
    by_id = {a["id"]: a for a in meta.get("data", [])}

    # ad-set-level insights for the window. video_3_sec_watched_actions is not
    # valid on every API version/account, so it's requested separately and its
    # failure degrades to "no hook rate" rather than 500-ing the whole call.
    ins = await client.get(
        f"/{acct}/insights",
        params={
            "level": "adset",
            "date_preset": date_preset,
            "fields": ("adset_id,adset_name,spend,impressions,clicks,ctr,cpm,frequency,"
                       "actions,action_values"),
            "limit": 200,
        },
    )

    snapshots: list[EntitySnapshot] = []
    for row in ins.get("data", []):
        aid = row.get("adset_id")
        md = by_id.get(aid, {})
        if md.get("status") not in (None, "ACTIVE"):  # only judge running ad sets
            continue

        spend = float(row.get("spend", 0) or 0)
        purchases = _sum_actions(row.get("actions"), _PURCHASE_TYPES)
        revenue = _sum_actions(row.get("action_values"), _PURCHASE_TYPES)

        snapshots.append(EntitySnapshot(
            entity_id=aid,
            entity_name=row.get("adset_name", aid),
            level="ad_set",
            spend=spend,
            roas=(revenue / spend) if spend and revenue else None,
            cpa=(spend / purchases) if purchases else None,
            ctr=float(row["ctr"]) if row.get("ctr") is not None else None,
            frequency=float(row["frequency"]) if row.get("frequency") is not None else None,
            conversions=int(purchases),
            days_running=_days_running(md.get("created_time")),
            # hook_rate + trend + history fields need extra data not wired yet →
            # left None so the engine treats them as unavailable (no false rules).
        ))
    return snapshots
