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
    AdSetSpec,
    CreatedAdSet,
    CreateMetaCampaignRequest,
    CreateMetaCampaignResult,
    MetaObjective,
    OBJECTIVE_OPTIMIZATION,
)
from app.services.media_service import get_creative_media, MediaType
from app.settings import get_settings


async def _resolve_media(client, acct, db, file_id, media_cache):
    """Upload a creative to Meta ONCE per request and cache the result, so N ad
    sets sharing one video/image don't trigger N heavy uploads (which can blow
    the request timeout). Returns ("image", image_hash) or ("video", video_id, thumb)."""
    if file_id in media_cache:
        return media_cache[file_id]
    async with get_creative_media(db, file_id, None) as creative:
        if creative.media_type == MediaType.IMAGE:
            image_hash = await client.upload_image(acct, creative.path, creative.filename, creative.content_type)
            result = ("image", image_hash, None)
        else:
            video_id = await client.upload_video(acct, creative.path, creative.filename, creative.content_type)
            thumb = await client.get_video_thumbnail(video_id)
            result = ("video", video_id, thumb)
    media_cache[file_id] = result
    return result


async def _create_ad_set(
    client, acct: str, campaign_id: str, campaign_name: str,
    objective, spec: AdSetSpec, index: int, db: AsyncSession, media_cache: dict,
) -> CreatedAdSet:
    """Create one PAUSED ad set under the campaign, plus its ad/creative if a
    creative_file_id is supplied."""
    s = get_settings()
    optimization_goal = OBJECTIVE_OPTIMIZATION.get(objective, "LINK_CLICKS")
    targeting_spec: dict = {
        "geo_locations": {"countries": [spec.country_code.upper()]},
        "age_min": spec.age_min,
        "age_max": spec.age_max,
    }
    if spec.gender:  # 0 = all (omit); 1 = men; 2 = women
        targeting_spec["genders"] = [spec.gender]
    if spec.languages:
        targeting_spec["locales"] = spec.languages
    if spec.interests:
        targeting_spec["flexible_spec"] = [
            {"interests": [{"id": i.id, "name": i.name} for i in spec.interests]}
        ]
    # Meta now requires an EXPLICIT Advantage+ audience decision on the ad set
    # (subcode 1870227 "Advantage audience flag required") — and which combos
    # trigger it keep changing. Always declare it: 0 = respect our exact targeting,
    # don't let Meta expand beyond it.
    targeting_spec["targeting_automation"] = {"advantage_audience": 0}
    targeting = json.dumps(targeting_spec)
    ad_set_data = {
        "name": f"{campaign_name} ad set {index} ({spec.country_code.upper()})",
        "campaign_id": campaign_id,
        "status": "PAUSED",
        "billing_event": "IMPRESSIONS",
        "optimization_goal": optimization_goal,
        "targeting": targeting,
    }
    # ABO: budget + bid_strategy live on the ad set. CBO (spec.daily_budget is
    # None): both live on the CAMPAIGN — putting bid_strategy on a budget-less ad
    # set makes Meta demand a bid_amount (subcode 1815857).
    if spec.daily_budget is not None:
        ad_set_data["daily_budget"] = str(int(round(spec.daily_budget * 100)))
        ad_set_data["bid_strategy"] = "LOWEST_COST_WITHOUT_CAP"

    # Optional schedule. end_time makes the ad set auto-stop (e.g. run 3 days).
    if spec.start_time:
        ad_set_data["start_time"] = spec.start_time
    if spec.end_time:
        ad_set_data["end_time"] = spec.end_time

    # Sales objective requires a promoted_object: which pixel + which conversion
    # event Meta optimizes toward. Without it Meta rejects the ad set
    # ("select a promoted object", subcode 1815430).
    if objective == MetaObjective.OUTCOME_SALES:
        if not s.meta_pixel_id:
            raise HTTPException(503, "META_PIXEL_ID not configured — required for the Sales objective.")
        ad_set_data["promoted_object"] = json.dumps({
            "pixel_id": s.meta_pixel_id,
            "custom_event_type": "PURCHASE",
        })

    ad_set = await client.post(f"/{acct}/adsets", data=ad_set_data)
    ad_set_id = ad_set["id"]

    if not spec.creative_file_id:
        return CreatedAdSet(ad_set_id=ad_set_id, country_code=spec.country_code.upper())

    page_id = s.meta_page_id
    if not page_id:
        raise HTTPException(503, "META_PAGE_ID not configured — required to create ad creatives.")

    cta = {"type": spec.call_to_action, "value": {"link": spec.destination_url}}

    media = await _resolve_media(client, acct, db, spec.creative_file_id, media_cache)
    if media[0] == "image":
        object_story_spec = {
            "page_id": page_id,
            "link_data": {
                "message": spec.message or "",
                "link": spec.destination_url,
                "name": spec.headline or "",
                "image_hash": media[1],
                "call_to_action": cta,
            },
        }
    else:  # video
        video_data = {
            "message": spec.message or "",
            "video_id": media[1],
            "title": spec.headline or "",
            "call_to_action": cta,
        }
        if media[2]:
            video_data["image_url"] = media[2]
        object_story_spec = {"page_id": page_id, "video_data": video_data}

    creative_resp = await client.post(
        f"/{acct}/adcreatives",
        data={
            "name": f"{campaign_name} creative {index}",
            "object_story_spec": json.dumps(object_story_spec),
        },
    )
    creative_id = creative_resp["id"]

    ad_resp = await client.post(
        f"/{acct}/ads",
        data={
            "name": f"{campaign_name} ad {index}",
            "adset_id": ad_set_id,
            "creative": json.dumps({"creative_id": creative_id}),
            "status": "PAUSED",
        },
    )
    return CreatedAdSet(
        ad_set_id=ad_set_id,
        country_code=spec.country_code.upper(),
        creative_id=creative_id,
        ad_id=ad_resp["id"],
    )


def _require_acct() -> str:
    acct = get_settings().meta_ad_account_id
    if not acct:
        raise HTTPException(503, "META_AD_ACCOUNT_ID not configured.")
    return acct


async def create_campaign_only(
    name: str, objective: MetaObjective, campaign_daily_budget: float | None
) -> str:
    """Create just the PAUSED campaign (fast, no creative uploads); return its id.

    Budget model: CBO (campaign_daily_budget set) puts the budget + bid strategy
    on the campaign; ABO leaves them to the ad sets.
    """
    acct = _require_acct()
    client = get_meta_client()
    campaign_data = {
        "name": name,
        "objective": objective.value,
        "status": "PAUSED",
        "special_ad_categories": "[]",
        "is_adset_budget_sharing_enabled": "false",
    }
    if campaign_daily_budget is not None:
        campaign_data["daily_budget"] = str(int(round(campaign_daily_budget * 100)))
        campaign_data["bid_strategy"] = "LOWEST_COST_WITHOUT_CAP"
    campaign = await client.post(f"/{acct}/campaigns", data=campaign_data)
    return campaign["id"]


async def add_ad_set_to_campaign(
    campaign_id: str, campaign_name: str, objective: MetaObjective,
    spec: AdSetSpec, index: int, db: AsyncSession,
) -> CreatedAdSet:
    """Create ONE ad set (+ its ad/creative) under an existing campaign.

    This is the per-ad-set entrypoint: the frontend creates the campaign once,
    then calls this per ad set in separate requests — so a 60MB video upload
    lives in its own short request instead of one giant multi-video request that
    blows the gateway timeout (502)."""
    acct = _require_acct()
    client = get_meta_client()
    return await _create_ad_set(client, acct, campaign_id, campaign_name, objective, spec, index, db, {})


async def create_campaign_with_adset(
    body: CreateMetaCampaignRequest, db: AsyncSession
) -> CreateMetaCampaignResult:
    """All-in-one create (campaign + all ad sets in one request). Kept for the
    Telegram agent and single/light campaigns; the web app uses the split
    per-ad-set flow for multi-video reliability."""
    acct = _require_acct()
    client = get_meta_client()

    campaign_id = await create_campaign_only(body.name, body.objective, body.campaign_daily_budget)

    created: list[CreatedAdSet] = []
    media_cache: dict = {}  # upload each unique creative to Meta only once
    for i, spec in enumerate(body.ad_sets, start=1):
        created.append(
            await _create_ad_set(client, acct, campaign_id, body.name, body.objective, spec, i, db, media_cache)
        )

    first = created[0]
    return CreateMetaCampaignResult(
        campaign_id=campaign_id,
        status="PAUSED",
        ad_sets=created,
        ad_set_id=first.ad_set_id,
        creative_id=first.creative_id,
        ad_id=first.ad_id,
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


async def delete_campaign(campaign_id: str) -> dict:
    """Delete a campaign (Meta also removes its ad sets + ads). Irreversible."""
    client = get_meta_client()
    await client.delete(f"/{campaign_id}")
    return {"campaign_id": campaign_id, "deleted": True}


async def set_adset_status(adset_id: str, status: str) -> dict:
    """Set a single ad set and its ads to ACTIVE or PAUSED.

    Lets the operator pause one losing ad set while the rest of the campaign
    keeps running. Note: the parent campaign must itself be ACTIVE for an
    ACTIVE ad set to actually deliver.
    """
    status = status.upper()
    if status not in ("ACTIVE", "PAUSED"):
        raise HTTPException(400, "status must be ACTIVE or PAUSED.")

    client = get_meta_client()
    await client.post(f"/{adset_id}", data={"status": status})
    ads = await client.get(f"/{adset_id}/ads", params={"fields": "id", "limit": 100})
    for ad in ads.get("data", []):
        await client.post(f"/{ad['id']}", data={"status": status})

    return {"ad_set_id": adset_id, "status": status, "ads_updated": len(ads.get("data", []))}
