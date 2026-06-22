"""Meta campaign write operations, shared by web API and Telegram.

Creates a PAUSED campaign + PAUSED ad set (targeting + budget). When a
creative_file_id is supplied, it also builds the ad/creative layer — the media
comes from the shared services.media_service (Google Drive OAuth), is uploaded
to Meta, and a PAUSED ad creative + ad are created. Needs META_PAGE_ID set.

Budgets are sent in the account's minor units (cents). Meta enforces a per-account
daily minimum and returns a clear error if the budget is below it.
"""
from __future__ import annotations

import json

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.platforms.meta import get_meta_client
from app.schemas.meta_create import (
    CreateMetaCampaignRequest,
    CreateMetaCampaignResult,
    OBJECTIVE_OPTIMIZATION,
)
from app.services.media_service import get_creative_media, MediaType
from app.settings import get_settings


async def create_campaign_with_adset(
    body: CreateMetaCampaignRequest, db: AsyncSession
) -> CreateMetaCampaignResult:
    s = get_settings()
    acct = s.meta_ad_account_id
    if not acct:
        raise HTTPException(503, "META_AD_ACCOUNT_ID not configured.")

    client = get_meta_client()

    # 1. Campaign (PAUSED). is_adset_budget_sharing_enabled is required by Meta
    #    when budget lives on the ad set (not the campaign).
    campaign = await client.post(
        f"/{acct}/campaigns",
        data={
            "name": body.name,
            "objective": body.objective.value,
            "status": "PAUSED",
            "special_ad_categories": "[]",
            "is_adset_budget_sharing_enabled": "false",
        },
    )
    campaign_id = campaign["id"]

    # 2. Ad set (PAUSED) — targeting (geo), daily budget in minor units.
    daily_budget_minor = int(round(body.daily_budget * 100))
    optimization_goal = OBJECTIVE_OPTIMIZATION.get(body.objective, "LINK_CLICKS")
    targeting = json.dumps({
        "geo_locations": {"countries": [body.country_code.upper()]},
        "age_min": body.age_min,
        "age_max": body.age_max,
    })
    ad_set = await client.post(
        f"/{acct}/adsets",
        data={
            "name": f"{body.name} ad set",
            "campaign_id": campaign_id,
            "status": "PAUSED",
            "daily_budget": str(daily_budget_minor),
            "billing_event": "IMPRESSIONS",
            "optimization_goal": optimization_goal,
            "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
            "targeting": targeting,
        },
    )
    ad_set_id = ad_set["id"]

    # 3. Optional creative + ad layer. Without a creative_file_id we stop at the
    #    campaign + ad set (backward compatible with the Telegram meta tool).
    if not body.creative_file_id:
        return CreateMetaCampaignResult(
            campaign_id=campaign_id, ad_set_id=ad_set_id, status="PAUSED",
        )

    page_id = s.meta_page_id
    if not page_id:
        raise HTTPException(503, "META_PAGE_ID not configured — required to create ad creatives.")

    cta = {"type": body.call_to_action, "value": {"link": body.destination_url}}

    async with get_creative_media(db, body.creative_file_id, None) as creative:
        if creative.media_type == MediaType.IMAGE:
            image_hash = await client.upload_image(acct, creative.path, creative.filename, creative.content_type)
            object_story_spec = {
                "page_id": page_id,
                "link_data": {
                    "message": body.message or "",
                    "link": body.destination_url,
                    "name": body.headline or "",
                    "image_hash": image_hash,
                    "call_to_action": cta,
                },
            }
        else:  # VIDEO
            video_id = await client.upload_video(acct, creative.path, creative.filename, creative.content_type)
            video_data = {
                "message": body.message or "",
                "video_id": video_id,
                "title": body.headline or "",
                "call_to_action": cta,
            }
            thumb = await client.get_video_thumbnail(video_id)
            if thumb:
                video_data["image_url"] = thumb
            object_story_spec = {"page_id": page_id, "video_data": video_data}

    # 4. Ad creative (PAUSED ad references it)
    creative_resp = await client.post(
        f"/{acct}/adcreatives",
        data={
            "name": f"{body.name} creative",
            "object_story_spec": json.dumps(object_story_spec),
        },
    )
    creative_id = creative_resp["id"]

    # 5. Ad (PAUSED) linking the creative to the ad set
    ad_resp = await client.post(
        f"/{acct}/ads",
        data={
            "name": f"{body.name} ad",
            "adset_id": ad_set_id,
            "creative": json.dumps({"creative_id": creative_id}),
            "status": "PAUSED",
        },
    )
    ad_id = ad_resp["id"]

    return CreateMetaCampaignResult(
        campaign_id=campaign_id,
        ad_set_id=ad_set_id,
        creative_id=creative_id,
        ad_id=ad_id,
        status="PAUSED",
    )


async def set_campaign_status(campaign_id: str, status: str) -> dict:
    """Set a campaign and all of its ad sets + ads to ACTIVE or PAUSED.

    Meta tracks status independently at each level, so activating only the
    campaign won't deliver if its ad sets/ads are still paused. We cascade to
    every child so the web toggle matches what the operator expects.
    """
    status = status.upper()
    if status not in ("ACTIVE", "PAUSED"):
        raise HTTPException(400, "status must be ACTIVE or PAUSED.")

    client = get_meta_client()

    # Campaign first.
    await client.post(f"/{campaign_id}", data={"status": status})

    # Then every ad set under it, and every ad under each ad set.
    adsets = await client.get(f"/{campaign_id}/adsets", params={"fields": "id", "limit": 100})
    adset_ids = [a["id"] for a in adsets.get("data", [])]
    for adset_id in adset_ids:
        await client.post(f"/{adset_id}", data={"status": status})
        ads = await client.get(f"/{adset_id}/ads", params={"fields": "id", "limit": 100})
        for ad in ads.get("data", []):
            await client.post(f"/{ad['id']}", data={"status": status})

    return {"campaign_id": campaign_id, "status": status, "ad_sets_updated": len(adset_ids)}
