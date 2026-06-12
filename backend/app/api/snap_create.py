"""Snap Marketing API write endpoint: create a full campaign in one call.

Runs the Snap create chain — media → upload → creative → campaign → ad squad
→ ad — and returns the created IDs. Everything is created PAUSED so a live
test cannot spend money. The creative pulls its asset from a public Google
Drive link.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from httpx import HTTPStatusError

from app.deps import get_current_user
from app.platforms.snap import get_snap_client, SnapAuthError
from app.schemas.snap_create import (
    CreateCampaignRequest,
    CreateCampaignResult,
    OBJECTIVE_OPTIMIZATION,
)
from app.services.drive import download_public_drive_file, DriveError
from app.settings import get_settings

router = APIRouter(prefix="/snap", tags=["snap"])

MEDIA_READY_TIMEOUT_SEC = 60
MEDIA_POLL_INTERVAL_SEC = 3


def _snap_error(e: HTTPStatusError) -> HTTPException:
    return HTTPException(
        status_code=e.response.status_code,
        detail=f"Snap API error: {e.response.text[:400]}",
    )


async def _wait_for_media_ready(client, media_id: str) -> str:
    """Poll media status until READY (or timeout). Returns the final status."""
    waited = 0
    status = "PENDING_UPLOAD"
    while waited < MEDIA_READY_TIMEOUT_SEC:
        data = await client.get(f"/media/{media_id}")
        media_list = data.get("media", [])
        if media_list:
            status = media_list[0].get("media", {}).get("media_status", status)
        if status == "READY":
            return status
        await asyncio.sleep(MEDIA_POLL_INTERVAL_SEC)
        waited += MEDIA_POLL_INTERVAL_SEC
    return status


def _first(data: dict, key: str) -> dict:
    """Snap wraps single results in a list under a plural key, each item under
    its singular sub-key. e.g. {"campaigns":[{"campaign":{...}}]}."""
    items = data.get(key, [])
    if not items:
        raise HTTPException(502, f"Snap returned no {key}: {data}")
    singular = key[:-1] if key.endswith("s") else key
    inner = items[0]
    obj = inner.get(singular, inner)
    sub_status = inner.get("sub_request_status")
    if sub_status and sub_status != "SUCCESS":
        raise HTTPException(502, f"Snap {singular} create failed: {inner}")
    return obj


@router.post("/campaigns/create", response_model=CreateCampaignResult)
async def create_campaign(
    body: CreateCampaignRequest,
    _user=Depends(get_current_user),
):
    s = get_settings()
    ad_account_id = s.snapchat_ad_account_id
    if not ad_account_id:
        raise HTTPException(503, "SNAPCHAT_AD_ACCOUNT_ID not configured.")

    client = get_snap_client()

    try:
        # 1. Download creative from Google Drive (public link)
        try:
            content, filename, content_type = await download_public_drive_file(body.drive_url)
        except DriveError as e:
            raise HTTPException(422, f"Drive download failed: {e}")

        # 2. Create media entity
        media_resp = await client.post(
            f"/adaccounts/{ad_account_id}/media",
            json={"media": [{
                "name": f"{body.name} media",
                "type": body.media_type.value,
                "ad_account_id": ad_account_id,
            }]},
        )
        media = _first(media_resp, "media")
        media_id = media["id"]

        # 3. Upload the file bytes
        await client.post_multipart(
            f"/media/{media_id}/upload",
            files={"file": (filename, content, content_type)},
        )
        media_status = await _wait_for_media_ready(client, media_id)
        if media_status != "READY":
            raise HTTPException(
                502, f"Media {media_id} not READY after upload (status={media_status})."
            )

        # 4. Create creative (WEB_VIEW → swipe-up to destination_url)
        profile_id = await client.get_profile_id()
        creative_resp = await client.post(
            f"/adaccounts/{ad_account_id}/creatives",
            json={"creatives": [{
                "ad_account_id": ad_account_id,
                "name": f"{body.name} creative",
                "type": "WEB_VIEW",
                "headline": body.headline,
                "top_snap_media_id": media_id,
                "profile_properties": {"profile_id": profile_id},
                "web_view_properties": {"url": body.destination_url},
                "call_to_action": "VIEW",
                "shareable": True,
            }]},
        )
        creative = _first(creative_resp, "creatives")
        creative_id = creative["id"]

        # 5. Create campaign (PAUSED)
        start_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        campaign_resp = await client.post(
            f"/adaccounts/{ad_account_id}/campaigns",
            json={"campaigns": [{
                "name": body.name,
                "ad_account_id": ad_account_id,
                "status": "PAUSED",
                "start_time": start_time,
                "buy_model": "AUCTION",
                "objective_v2_properties": {"objective_v2_type": body.objective.value},
            }]},
        )
        campaign = _first(campaign_resp, "campaigns")
        campaign_id = campaign["id"]

        # 6. Create ad squad (budget, targeting/region) — PAUSED
        daily_budget_micro = int(round(body.daily_budget * 1_000_000))
        optimization_goal = OBJECTIVE_OPTIMIZATION.get(body.objective, "IMPRESSIONS")
        adsquad_resp = await client.post(
            f"/campaigns/{campaign_id}/adsquads",
            json={"adsquads": [{
                "name": f"{body.name} ad squad",
                "campaign_id": campaign_id,
                "status": "PAUSED",
                "type": "SNAP_ADS",
                "billing_event": "IMPRESSION",
                "bid_strategy": "AUTO_BID",
                "optimization_goal": optimization_goal,
                "placement_v2": {"config": "AUTOMATIC"},
                "daily_budget_micro": daily_budget_micro,
                "delivery_constraint": "DAILY_BUDGET",
                "targeting": {
                    "regulated_content": False,
                    "geos": [{"country_code": body.country_code.lower()}],
                },
            }]},
        )
        adsquad = _first(adsquad_resp, "adsquads")
        ad_squad_id = adsquad["id"]

        # 7. Create ad linking creative → ad squad (PAUSED)
        ad_resp = await client.post(
            f"/adsquads/{ad_squad_id}/ads",
            json={"ads": [{
                "name": f"{body.name} ad",
                "ad_squad_id": ad_squad_id,
                "creative_id": creative_id,
                "status": "PAUSED",
                "type": "SNAP_AD",
            }]},
        )
        ad = _first(ad_resp, "ads")
        ad_id = ad["id"]

        return CreateCampaignResult(
            campaign_id=campaign_id,
            ad_squad_id=ad_squad_id,
            creative_id=creative_id,
            ad_id=ad_id,
            media_id=media_id,
            media_status=media_status,
            status="PAUSED",
        )

    except SnapAuthError as e:
        raise HTTPException(503, f"Snap auth error: {e}")
    except HTTPStatusError as e:
        raise _snap_error(e)
