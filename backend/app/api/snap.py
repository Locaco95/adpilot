"""Snap Marketing API read endpoints.

All endpoints require a valid AdPilot JWT. They proxy reads to Snap using
the server-side OAuth credentials (no end-user OAuth flow needed).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from httpx import HTTPStatusError

from app.deps import get_current_user
from app.platforms.snap import get_snap_client, SnapAuthError
from app.settings import get_settings

router = APIRouter(prefix="/snap", tags=["snap"])


async def _call(path: str, params: dict | None = None) -> dict:
    client = get_snap_client()
    try:
        return await client.get(path, params=params)
    except SnapAuthError as e:
        raise HTTPException(status_code=503, detail=f"Snap auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Snap API error: {e.response.text[:300]}",
        )


@router.get("/status")
async def status(_user=Depends(get_current_user)):
    """Quick check: is Snap configured + reachable?"""
    s = get_settings()
    configured = bool(s.snapchat_client_id and s.snapchat_client_secret and s.snapchat_refresh_token)
    return {
        "configured": configured,
        "default_ad_account_id": s.snapchat_ad_account_id or None,
    }


@router.get("/me")
async def me(_user=Depends(get_current_user)):
    return await _call("/me")


@router.get("/organizations")
async def organizations(
    with_ad_accounts: bool = Query(True),
    _user=Depends(get_current_user),
):
    return await _call(
        "/me/organizations",
        params={"with_ad_accounts": str(with_ad_accounts).lower()},
    )


@router.get("/adaccounts/{ad_account_id}")
async def ad_account(ad_account_id: str, _user=Depends(get_current_user)):
    return await _call(f"/adaccounts/{ad_account_id}")


@router.get("/adaccounts/{ad_account_id}/campaigns")
async def campaigns(ad_account_id: str, _user=Depends(get_current_user)):
    return await _call(f"/adaccounts/{ad_account_id}/campaigns")


@router.get("/adaccounts/{ad_account_id}/adsquads")
async def adsquads(ad_account_id: str, _user=Depends(get_current_user)):
    return await _call(f"/adaccounts/{ad_account_id}/adsquads")


@router.get("/adaccounts/{ad_account_id}/ads")
async def ads(ad_account_id: str, _user=Depends(get_current_user)):
    return await _call(f"/adaccounts/{ad_account_id}/ads")


@router.get("/campaigns/{campaign_id}/stats")
async def campaign_stats(
    campaign_id: str,
    granularity: str = Query("TOTAL", description="TOTAL | DAY | HOUR"),
    fields: str = Query(
        "spend,impressions,swipes,video_views",
        description="Comma-separated stat fields",
    ),
    _user=Depends(get_current_user),
):
    return await _call(
        f"/campaigns/{campaign_id}/stats",
        params={"granularity": granularity, "fields": fields},
    )
