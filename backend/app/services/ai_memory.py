"""AI Media Buyer memory — the "stacking experience" layer.

Honest scope: an LLM cannot learn on its own. This makes it *look* like it
learns by storing every decision + the metrics at the time, later recording the
OUTCOME (what the metrics did after), and injecting that account-specific
track record back into the prompt. The AI then reasons WITH its own history —
so it stops repeating mistakes it can see it made. Value is ~nil until weeks of
data accumulate; it compounds.

Stored in SystemConfig (JSON) keyed per Meta entity — no schema change, and Meta
ids are strings (not our UUID FKs). Bounded to the most recent N per entity.

Also holds `lessons`: short rules the weekly self-review distills from outcomes.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SystemConfig

MEM_KEY = "ai_memory"
MAX_PER_ENTITY = 20      # keep the last N decisions per ad set
MAX_LESSONS = 15


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _load(db: AsyncSession) -> dict:
    row = (await db.execute(select(SystemConfig).where(SystemConfig.key == MEM_KEY))).scalar_one_or_none()
    if row and isinstance(row.value, dict):
        return row.value
    return {"decisions": {}, "lessons": []}


async def _save(db: AsyncSession, mem: dict) -> None:
    row = (await db.execute(select(SystemConfig).where(SystemConfig.key == MEM_KEY))).scalar_one_or_none()
    if row:
        row.value = mem
    else:
        db.add(SystemConfig(key=MEM_KEY, value=mem, updated_by="ai_media_buyer"))
    await db.commit()


async def record_decisions(db: AsyncSession, recs: list[dict], metrics_by_id: dict[str, dict]) -> None:
    """Append each decision with the metrics snapshot AT the time (for later
    outcome comparison). Trims to the most recent MAX_PER_ENTITY."""
    mem = await _load(db)
    decisions = mem.setdefault("decisions", {})
    for r in recs:
        eid = r["entity_id"]
        entry = {
            "at": _now(),
            "action": r["action"],
            "confidence": r.get("confidence"),
            "diagnosis": r.get("diagnosis", "")[:300],
            "metrics_then": {k: v for k, v in (metrics_by_id.get(eid) or {}).items() if v is not None},
            "outcome": None,  # filled on a later run
        }
        lst = decisions.setdefault(eid, [])
        lst.append(entry)
        del lst[:-MAX_PER_ENTITY]
    await _save(db, mem)


async def update_outcomes(db: AsyncSession, metrics_by_id: dict[str, dict]) -> None:
    """For the most recent decision on each entity that lacks an outcome, record
    how the key metrics moved since (roas/cpa/spend). Cheap deltas the AI reads."""
    mem = await _load(db)
    for eid, lst in mem.get("decisions", {}).items():
        now_m = metrics_by_id.get(eid)
        if not now_m or not lst:
            continue
        # attach outcome to the latest decision that doesn't have one yet and is
        # not the one we might record this same run (skip the very last if brand new)
        for entry in reversed(lst):
            if entry.get("outcome") is None:
                then = entry.get("metrics_then", {})
                entry["outcome"] = {
                    "at": _now(),
                    "roas_then": then.get("roas"), "roas_now": now_m.get("roas"),
                    "cpa_then": then.get("cpa"), "cpa_now": now_m.get("cpa"),
                    "spend_then": then.get("spend"), "spend_now": now_m.get("spend"),
                }
                break
    await _save(db, mem)


async def get_history_prompt(db: AsyncSession, entity_ids: list[str]) -> str:
    """Render this account's decision→outcome history + distilled lessons as a
    compact block for the system/user prompt. Empty string when there's nothing."""
    mem = await _load(db)
    lessons = mem.get("lessons", [])
    lines: list[str] = []

    if lessons:
        lines.append("LESSONS from your past decisions in THIS account (apply them):")
        lines.extend(f"- {l}" for l in lessons[-MAX_LESSONS:])

    hist_lines: list[str] = []
    for eid in entity_ids:
        for e in (mem.get("decisions", {}).get(eid) or [])[-3:]:
            o = e.get("outcome")
            if o and (o.get("roas_now") is not None or o.get("cpa_now") is not None):
                hist_lines.append(
                    f"- {eid}: you chose {e['action']}; after that "
                    f"ROAS {o.get('roas_then')}→{o.get('roas_now')}, CPA {o.get('cpa_then')}→{o.get('cpa_now')}."
                )
    if hist_lines:
        lines.append("\nWHAT HAPPENED after your recent decisions (learn from it):")
        lines.extend(hist_lines[-20:])

    return "\n".join(lines)


async def add_lessons(db: AsyncSession, lessons: list[str]) -> None:
    mem = await _load(db)
    cur = mem.setdefault("lessons", [])
    for l in lessons:
        l = (l or "").strip()
        if l and l not in cur:
            cur.append(l)
    del cur[:-MAX_LESSONS]
    await _save(db, mem)
