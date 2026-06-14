"""Meta campaign + ad set write operations, shared by web API and (later) Telegram.

Creates a PAUSED campaign + PAUSED ad set (targeting + budget). The ad/creative
layer (needs a Page + payment method) is a later slice. Budgets are sent in the
account's minor units (e.g. EGP piastres / USD cents). Meta enforces a per-account
daily minimum and returns a clear error if the budget is below it.
"""
from __future__ import annotations

import json

from fastapi import HTTPException

from app.platforms.meta import get_meta_client
from app.schemas.meta_create import (
    CreateMetaCampaignRequest,
    CreateMetaCampaignResult,
    OBJECTIVE_OPTIMIZATION,
)
from app.settings import get_settings


async def create_campaign_with_adset(body: CreateMetaCampaignRequest) -> CreateMetaCampaignResult:
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

    return CreateMetaCampaignResult(
        campaign_id=campaign_id,
        ad_set_id=ad_set_id,
        status="PAUSED",
    )
