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
_ATC_TYPES = ("add_to_cart", "omni_add_to_cart", "offsite_conversion.fb_pixel_add_to_cart")
_CHECKOUT_TYPES = ("initiate_checkout", "omni_initiated_checkout", "offsite_conversion.fb_pixel_initiate_checkout")
_LPV_TYPES = ("landing_page_view",)
_VIDEO_VIEW_TYPES = ("video_view",)

# Insights fields we ask Meta for. Optional/fragile ones are tried and degrade
# to "unavailable" per-metric rather than failing the whole pull.
_BASE_FIELDS = "adset_id,adset_name,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,action_values"
# Correct v21 video field names (verified against the live account 2026-07-03).
_OPTIONAL_FIELDS = "video_play_actions,video_p50_watched_actions,video_thruplay_watched_actions"


def _sum_actions(rows: list[dict] | None, types: tuple[str, ...]) -> float:
    total = 0.0
    for a in rows or []:
        if a.get("action_type") in types:
            try:
                total += float(a.get("value", 0) or 0)
            except (TypeError, ValueError):
                pass
    return total


def _num(row: dict, key: str) -> float | None:
    v = row.get(key)
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _extract_metrics(row: dict) -> dict[str, float | None]:
    """Pull every catalog metric from one insights row. Missing → None."""
    spend = _num(row, "spend") or 0.0
    clicks = _num(row, "clicks") or 0.0
    impressions = _num(row, "impressions") or 0.0

    purchases = _sum_actions(row.get("actions"), _PURCHASE_TYPES)
    revenue = _sum_actions(row.get("action_values"), _PURCHASE_TYPES)
    atc = _sum_actions(row.get("actions"), _ATC_TYPES)
    checkout = _sum_actions(row.get("actions"), _CHECKOUT_TYPES)
    lpv = _sum_actions(row.get("actions"), _LPV_TYPES)
    plays = _sum_actions(row.get("video_play_actions"), _VIDEO_VIEW_TYPES)
    v50 = _sum_actions(row.get("video_p50_watched_actions"), _VIDEO_VIEW_TYPES)
    thru = _sum_actions(row.get("video_thruplay_watched_actions"), _VIDEO_VIEW_TYPES)

    return {
        "spend": spend or None,
        "impressions": impressions or None,
        "reach": _num(row, "reach"),
        "clicks": clicks or None,
        "frequency": _num(row, "frequency"),
        "ctr": _num(row, "ctr"),
        "cpc": _num(row, "cpc"),
        "cpm": _num(row, "cpm"),
        "conversions": purchases or None,
        "roas": (revenue / spend) if spend and revenue else None,
        "cpa": (spend / purchases) if purchases else None,
        "purchase_value": revenue or None,
        "add_to_cart": atc or None,
        "cost_per_atc": (spend / atc) if atc else None,
        "initiate_checkout": checkout or None,
        "landing_page_views": lpv or None,
        "hook_rate": (plays / impressions) if impressions and plays else None,
        "hold_rate": (thru / impressions) if impressions and thru else None,
        "video_p50": v50 or None,
        # trend metrics need day-by-day history — not stored yet
        "cpm_change_7d": None,
        "ctr_change_7d": None,
        "cpa_rising_days": None,
    }


def _days_running(created_time: str | None) -> int:
    if not created_time:
        return 0
    try:
        # Meta returns e.g. "2026-06-25T09:00:00+0000"
        dt = datetime.fromisoformat(created_time.replace("+0000", "+00:00"))
        return max(0, (datetime.now(timezone.utc) - dt).days)
    except ValueError:
        return 0


async def _fetch_rows(date_preset: str) -> tuple[list[dict], dict[str, dict]]:
    """Return (insights rows, adset-metadata by id). Retries insights without
    the optional video fields if Meta rejects them, so a bad field never 500s."""
    s = get_settings()
    client = get_meta_client()
    acct = s.meta_ad_account_id

    meta = await client.get(
        f"/{acct}/adsets",
        params={"fields": "id,name,status,created_time,daily_budget", "limit": 200},
    )
    by_id = {a["id"]: a for a in meta.get("data", [])}

    from httpx import HTTPStatusError
    for fields in (f"{_BASE_FIELDS},{_OPTIONAL_FIELDS}", _BASE_FIELDS):
        try:
            ins = await client.get(
                f"/{acct}/insights",
                params={"level": "adset", "date_preset": date_preset, "fields": fields, "limit": 200},
            )
            return ins.get("data", []), by_id
        except HTTPStatusError:
            continue  # drop the optional video fields and retry once
    return [], by_id


async def build_adset_metrics(date_preset: str = "last_7d") -> list[dict]:
    """Per active ad set: {entity_id, entity_name, days_running, metrics:{key:val|None}}.
    Powers the UI metrics report — every catalog metric, None where unavailable."""
    rows, by_id = await _fetch_rows(date_preset)
    out: list[dict] = []
    for row in rows:
        aid = row.get("adset_id")
        md = by_id.get(aid, {})
        if md.get("status") not in (None, "ACTIVE"):
            continue
        metrics = _extract_metrics(row)
        metrics["days_running"] = float(_days_running(md.get("created_time")))
        out.append({"entity_id": aid, "entity_name": row.get("adset_name", aid), "metrics": metrics})
    return out


async def build_adset_snapshots(date_preset: str = "last_7d") -> list[EntitySnapshot]:
    """One EntitySnapshot per active ad set — the engine's input."""
    rows, by_id = await _fetch_rows(date_preset)
    snapshots: list[EntitySnapshot] = []
    for row in rows:
        aid = row.get("adset_id")
        md = by_id.get(aid, {})
        if md.get("status") not in (None, "ACTIVE"):
            continue
        m = _extract_metrics(row)
        snapshots.append(EntitySnapshot(
            entity_id=aid,
            entity_name=row.get("adset_name", aid),
            level="ad_set",
            spend=m["spend"] or 0.0,
            roas=m["roas"],
            cpa=m["cpa"],
            ctr=m["ctr"],
            frequency=m["frequency"],
            conversions=int(m["conversions"] or 0),
            cost_per_atc=m["cost_per_atc"],
            hook_rate=m["hook_rate"],
            days_running=_days_running(md.get("created_time")),
            # trend/history fields stay None until day-by-day storage exists.
        ))
    return snapshots
