"""Request/response schemas for creating a Meta campaign + ad set.

This slice creates the campaign + ad set (targeting, budget) — both PAUSED.
The ad/creative layer (needs a Page + payment method) is a later slice.
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class MetaObjective(str, Enum):
    # Meta ODAX objectives (campaign level)
    OUTCOME_TRAFFIC = "OUTCOME_TRAFFIC"
    OUTCOME_SALES = "OUTCOME_SALES"
    OUTCOME_AWARENESS = "OUTCOME_AWARENESS"
    OUTCOME_ENGAGEMENT = "OUTCOME_ENGAGEMENT"
    OUTCOME_LEADS = "OUTCOME_LEADS"


# optimization_goal that pairs sensibly with each objective at the ad set level
OBJECTIVE_OPTIMIZATION = {
    MetaObjective.OUTCOME_TRAFFIC: "LINK_CLICKS",
    MetaObjective.OUTCOME_SALES: "OFFSITE_CONVERSIONS",
    MetaObjective.OUTCOME_AWARENESS: "REACH",
    MetaObjective.OUTCOME_ENGAGEMENT: "POST_ENGAGEMENT",
    MetaObjective.OUTCOME_LEADS: "LEAD_GENERATION",
}


class CreateMetaCampaignRequest(BaseModel):
    name: str = Field(..., max_length=400)
    objective: MetaObjective = MetaObjective.OUTCOME_TRAFFIC
    country_code: str = Field(..., min_length=2, max_length=2, description="ISO-2, e.g. 'SA'")
    daily_budget: float = Field(..., gt=0, description="In the ad account's currency (Meta enforces a per-account minimum)")
    age_min: int = Field(18, ge=13, le=65)
    age_max: int = Field(65, ge=13, le=65)
    # TODO: forward-ready — consumed once the Meta creative/ad layer is built; it
    # will obtain media via the shared services.media_service.get_creative_media().
    creative_file_id: str | None = Field(None, description="Google Drive file id (OAuth) for the future creative layer.")


class CreateMetaCampaignResult(BaseModel):
    campaign_id: str
    ad_set_id: str
    status: str  # PAUSED — never goes live automatically in this slice
