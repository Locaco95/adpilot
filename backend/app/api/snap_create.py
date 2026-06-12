"""Snap Marketing API write endpoint: create a full campaign in one call.

Thin wrapper — the chain itself lives in services/snap_campaigns.py and is
shared with the Telegram agent. Everything is created PAUSED.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from httpx import HTTPStatusError

from app.deps import get_current_user
from app.platforms.snap import SnapAuthError
from app.schemas.snap_create import CreateCampaignRequest, CreateCampaignResult
from app.services.snap_campaigns import create_full_campaign

router = APIRouter(prefix="/snap", tags=["snap"])


@router.post("/campaigns/create", response_model=CreateCampaignResult)
async def create_campaign(
    body: CreateCampaignRequest,
    _user=Depends(get_current_user),
):
    try:
        return await create_full_campaign(body)
    except SnapAuthError as e:
        raise HTTPException(503, f"Snap auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Snap API error: {e.response.text[:400]}",
        )
