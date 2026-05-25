from datetime import date, timedelta
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user
from app.models import Campaign, Platform, DailyMetric
from app.schemas.campaign import CampaignOut, CampaignPatch

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def _trend(spend_first: float, spend_last: float) -> str:
    if spend_last > spend_first * 1.05:
        return "up"
    if spend_last < spend_first * 0.95:
        return "down"
    return "stable"


@router.get("", response_model=list[CampaignOut])
async def list_campaigns(
    platform: str = Query("all"),
    status: str = Query("all"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    pmap_q = (await db.execute(select(Platform))).scalars().all()
    pmap = {p.id: p.slug for p in pmap_q}
    pmap_rev = {p.slug: p.id for p in pmap_q}

    q = select(Campaign)
    if platform != "all" and platform in pmap_rev:
        q = q.where(Campaign.platform_id == pmap_rev[platform])
    if status != "all":
        q = q.where(Campaign.status == status)
    campaigns = (await db.execute(q)).scalars().all()

    today = date.today()
    start_7d = today - timedelta(days=7)

    out: list[CampaignOut] = []
    for c in campaigns:
        # 7-day rollup for this campaign
        agg_q = (
            select(
                func.coalesce(func.sum(DailyMetric.spend), 0).label("spend"),
                func.coalesce(func.sum(DailyMetric.conversions), 0).label("conv"),
                func.coalesce(func.sum(DailyMetric.revenue), 0).label("rev"),
                func.coalesce(func.sum(DailyMetric.impressions), 0).label("imp"),
                func.coalesce(func.sum(DailyMetric.clicks), 0).label("clk"),
                func.coalesce(func.avg(DailyMetric.frequency), 0).label("freq"),
            )
            .where(DailyMetric.entity_type == "campaign")
            .where(DailyMetric.entity_id == c.id)
            .where(DailyMetric.date >= start_7d)
        )
        agg = (await db.execute(agg_q)).one()
        spend, conv, rev = float(agg.spend), int(agg.conv), float(agg.rev)
        imp, clk, freq = int(agg.imp), int(agg.clk), float(agg.freq)

        # trend: first 3 days vs last 3 days of window
        first_q = select(func.coalesce(func.sum(DailyMetric.spend), 0)).where(
            DailyMetric.entity_type == "campaign",
            DailyMetric.entity_id == c.id,
            DailyMetric.date >= start_7d,
            DailyMetric.date < start_7d + timedelta(days=3),
        )
        last_q = select(func.coalesce(func.sum(DailyMetric.spend), 0)).where(
            DailyMetric.entity_type == "campaign",
            DailyMetric.entity_id == c.id,
            DailyMetric.date > today - timedelta(days=3),
        )
        first_spend = float((await db.execute(first_q)).scalar() or 0)
        last_spend = float((await db.execute(last_q)).scalar() or 0)

        out.append(CampaignOut(
            id=c.id,
            platform=pmap.get(c.platform_id, "unknown"),
            name=c.name,
            status=c.status,
            budget=float(c.daily_budget or 0),
            spend7d=round(spend, 2),
            conv7d=conv,
            rev7d=round(rev, 2),
            cpa=round(spend / conv, 2) if conv else 0,
            roas=round(rev / spend, 3) if spend else 0,
            ctr=round(clk / imp, 4) if imp else 0,
            freq=round(freq, 2),
            trend=_trend(first_spend, last_spend),
        ))
    return out


@router.patch("/{campaign_id}")
async def patch_campaign(
    campaign_id: UUID,
    patch: CampaignPatch,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    c = await db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(404, "Campaign not found")
    if patch.status is not None:
        c.status = patch.status
    if patch.daily_budget is not None:
        c.daily_budget = patch.daily_budget
    await db.commit()
    return {"id": str(c.id), "status": c.status, "daily_budget": float(c.daily_budget or 0)}
