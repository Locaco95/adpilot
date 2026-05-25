from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user, get_config
from app.models import DailyMetric, Platform, Anomaly
from app.schemas.overview import OverviewSummary, DailyMetric as DailyMetricOut, PlatformBreakdown, AnomalyOut

router = APIRouter(prefix="/overview", tags=["overview"])


async def _platform_map(db: AsyncSession) -> dict:
    rows = (await db.execute(select(Platform))).scalars().all()
    return {p.id: p.slug for p in rows}


@router.get("/summary", response_model=OverviewSummary)
async def summary(
    window: str = Query("7d"),
    db: AsyncSession = Depends(get_db),
    config: dict = Depends(get_config),
    _user=Depends(get_current_user),
):
    days = int(window.rstrip("d"))
    today = date.today()
    cur_start = today - timedelta(days=days)
    prev_start = cur_start - timedelta(days=days)

    async def window_totals(start: date, end: date) -> dict:
        q = (
            select(
                func.coalesce(func.sum(DailyMetric.spend), 0).label("spend"),
                func.coalesce(func.sum(DailyMetric.conversions), 0).label("conv"),
                func.coalesce(func.sum(DailyMetric.revenue), 0).label("rev"),
                func.coalesce(func.sum(DailyMetric.impressions), 0).label("imp"),
                func.coalesce(func.sum(DailyMetric.clicks), 0).label("clk"),
            )
            .where(DailyMetric.entity_type == "campaign")
            .where(DailyMetric.date >= start)
            .where(DailyMetric.date < end)
        )
        row = (await db.execute(q)).one()
        return {"spend": float(row.spend), "conv": int(row.conv), "rev": float(row.rev),
                "imp": int(row.imp), "clk": int(row.clk)}

    cur = await window_totals(cur_start, today)
    prev = await window_totals(prev_start, cur_start)

    def pct_delta(a: float, b: float) -> float:
        if b == 0:
            return 0.0
        return round((a - b) / b * 100, 1)

    cur_cpa = cur["spend"] / cur["conv"] if cur["conv"] else 0
    prev_cpa = prev["spend"] / prev["conv"] if prev["conv"] else 0
    cur_roas = cur["rev"] / cur["spend"] if cur["spend"] else 0
    prev_roas = prev["rev"] / prev["spend"] if prev["spend"] else 0
    cur_ctr = cur["clk"] / cur["imp"] if cur["imp"] else 0

    targets = config.get("targets", {})

    return OverviewSummary(
        spend=round(cur["spend"], 2),
        spendDelta=pct_delta(cur["spend"], prev["spend"]),
        conversions=cur["conv"],
        convDelta=pct_delta(cur["conv"], prev["conv"]),
        revenue=round(cur["rev"], 2),
        revDelta=pct_delta(cur["rev"], prev["rev"]),
        roas=round(cur_roas, 2),
        roasDelta=pct_delta(cur_roas, prev_roas),
        cpa=round(cur_cpa, 2),
        cpaDelta=pct_delta(cur_cpa, prev_cpa),
        impressions=cur["imp"],
        clicks=cur["clk"],
        ctr=round(cur_ctr, 4),
        target_cpa=float(targets.get("cpa", 15.0)),
        target_roas=float(targets.get("roas", 2.5)),
        daily_budget=float(targets.get("daily_budget", 700.0)),
    )


@router.get("/daily", response_model=list[DailyMetricOut])
async def daily(
    days: int = Query(14, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    today = date.today()
    start = today - timedelta(days=days - 1)
    pmap = await _platform_map(db)

    q = (
        select(DailyMetric)
        .where(DailyMetric.entity_type == "campaign")
        .where(DailyMetric.date >= start)
        .where(DailyMetric.date <= today)
        .order_by(DailyMetric.date.asc())
    )
    rows = (await db.execute(q)).scalars().all()

    # Aggregate per (date, platform)
    by_day: dict[date, dict] = {}
    for r in rows:
        d = by_day.setdefault(r.date, {"spend": {}, "conv": {}, "rev": {}})
        slug = pmap.get(r.platform_id, "unknown")
        d["spend"][slug] = d["spend"].get(slug, 0.0) + float(r.spend or 0)
        d["conv"][slug] = d["conv"].get(slug, 0) + int(r.conversions or 0)
        d["rev"][slug] = d["rev"].get(slug, 0.0) + float(r.revenue or 0)

    out = []
    cur = start
    while cur <= today:
        bucket = by_day.get(cur, {"spend": {}, "conv": {}, "rev": {}})
        spend = PlatformBreakdown(
            meta=bucket["spend"].get("meta", 0.0),
            tiktok=bucket["spend"].get("tiktok", 0.0),
            snapchat=bucket["spend"].get("snapchat", 0.0),
        )
        spend.total = round(spend.meta + spend.tiktok + spend.snapchat, 2)
        conv = PlatformBreakdown(
            meta=bucket["conv"].get("meta", 0),
            tiktok=bucket["conv"].get("tiktok", 0),
            snapchat=bucket["conv"].get("snapchat", 0),
        )
        conv.total = conv.meta + conv.tiktok + conv.snapchat
        rev = PlatformBreakdown(
            meta=bucket["rev"].get("meta", 0.0),
            tiktok=bucket["rev"].get("tiktok", 0.0),
            snapchat=bucket["rev"].get("snapchat", 0.0),
        )
        rev.total = round(rev.meta + rev.tiktok + rev.snapchat, 2)

        roas = (rev.total / spend.total) if spend.total else 0
        cpa = (spend.total / conv.total) if conv.total else 0

        out.append(DailyMetricOut(
            date=cur,
            label=cur.strftime("%b %d"),
            spend=spend, conversions=conv, revenue=rev,
            roas=round(roas, 3), cpa=round(cpa, 2),
        ))
        cur += timedelta(days=1)
    return out


@router.get("/anomalies", response_model=list[AnomalyOut])
async def anomalies(
    status: str = Query("active"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    pmap = await _platform_map(db)
    q = select(Anomaly).order_by(Anomaly.created_at.desc()).limit(20)
    if status == "active":
        q = q.where(Anomaly.resolved_at.is_(None))
    rows = (await db.execute(q)).scalars().all()
    return [
        AnomalyOut(
            id=a.id,
            severity=a.severity,
            platform=pmap.get(a.platform_id, "unknown"),
            timestamp=a.created_at,
            title=a.title,
            detail=a.detail,
            metric=a.metric,
            value=a.value,
            baseline=a.baseline,
            zScore=float(a.z_score) if a.z_score is not None else None,
        )
        for a in rows
    ]
