"""Meta Marketing API read endpoints.

All require a valid AdPilot JWT. Proxy reads to Meta using the server-side
long-lived token (no end-user OAuth flow).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from httpx import HTTPStatusError
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.platforms.meta import get_meta_client, MetaAuthError
from pydantic import BaseModel

from app.schemas.meta_create import CreateMetaCampaignRequest, CreateMetaCampaignResult
from app.services.meta_campaigns import (
    create_campaign_with_adset,
    set_campaign_status,
    set_adset_status,
)
from app.settings import get_settings

router = APIRouter(prefix="/meta", tags=["meta"])


async def _call(path: str, params: dict | None = None) -> dict:
    client = get_meta_client()
    try:
        return await client.get(path, params=params)
    except MetaAuthError as e:
        raise HTTPException(status_code=503, detail=f"Meta auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Meta API error: {e.response.text[:400]}",
        )


@router.get("/status")
async def status(_user=Depends(get_current_user)):
    s = get_settings()
    return {
        "configured": bool(s.meta_access_token and s.meta_ad_account_id),
        "ad_account_id": s.meta_ad_account_id or None,
    }


@router.get("/account")
async def account(_user=Depends(get_current_user)):
    s = get_settings()
    return await _call(
        f"/{s.meta_ad_account_id}",
        params={"fields": "name,account_status,currency,timezone_name,amount_spent,balance,funding_source_details"},
    )


@router.get("/campaigns")
async def campaigns(_user=Depends(get_current_user)):
    s = get_settings()
    return await _call(
        f"/{s.meta_ad_account_id}/campaigns",
        params={"fields": "name,status,effective_status,objective,daily_budget,lifetime_budget,created_time", "limit": 100},
    )


@router.get("/adsets")
async def adsets(_user=Depends(get_current_user)):
    s = get_settings()
    return await _call(
        f"/{s.meta_ad_account_id}/adsets",
        params={"fields": "name,status,campaign_id,daily_budget,optimization_goal,targeting", "limit": 100},
    )


@router.get("/ads")
async def ads(_user=Depends(get_current_user)):
    s = get_settings()
    return await _call(
        f"/{s.meta_ad_account_id}/ads",
        params={"fields": "name,status,adset_id,creative", "limit": 100},
    )


@router.get("/campaigns/{campaign_id}/adsets")
async def campaign_adsets(campaign_id: str, _user=Depends(get_current_user)):
    """Ad sets belonging to one campaign, with status + budget."""
    return await _call(
        f"/{campaign_id}/adsets",
        params={"fields": "name,status,effective_status,daily_budget,optimization_goal", "limit": 100},
    )


@router.get("/insights")
async def insights(
    level: str = Query("campaign", description="account | campaign | adset | ad"),
    date_preset: str = Query("last_7d"),
    _user=Depends(get_current_user),
):
    s = get_settings()
    return await _call(
        f"/{s.meta_ad_account_id}/insights",
        params={
            "level": level,
            "date_preset": date_preset,
            "fields": "campaign_name,spend,impressions,clicks,ctr,cpc,reach",
            "limit": 100,
        },
    )


@router.post("/campaigns/create", response_model=CreateMetaCampaignResult)
async def create_campaign(
    body: CreateMetaCampaignRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Create a PAUSED campaign + ad set, plus a PAUSED ad creative + ad when a
    creative_file_id is provided (media via Google Drive OAuth)."""
    try:
        return await create_campaign_with_adset(body, db)
    except MetaAuthError as e:
        raise HTTPException(503, f"Meta auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Meta API error: {e.response.text[:400]}",
        )


class SetStatusRequest(BaseModel):
    status: str  # "ACTIVE" | "PAUSED"


@router.post("/campaigns/{campaign_id}/status")
async def campaign_status(
    campaign_id: str,
    body: SetStatusRequest,
    _user=Depends(get_current_user),
):
    """Activate or pause a campaign and all of its ad sets + ads.

    Activating starts real ad delivery (and spend); the frontend gates this
    behind a confirmation dialog.
    """
    try:
        return await set_campaign_status(campaign_id, body.status)
    except MetaAuthError as e:
        raise HTTPException(503, f"Meta auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Meta API error: {e.response.text[:400]}",
        )


@router.post("/adsets/{adset_id}/status")
async def adset_status(
    adset_id: str,
    body: SetStatusRequest,
    _user=Depends(get_current_user),
):
    """Activate or pause a single ad set (and its ads), leaving the rest of the
    campaign untouched. Activating starts real spend; the frontend confirms it."""
    try:
        return await set_adset_status(adset_id, body.status)
    except MetaAuthError as e:
        raise HTTPException(503, f"Meta auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Meta API error: {e.response.text[:400]}",
        )
