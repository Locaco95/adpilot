"""Request/response schemas for creating a Meta campaign + ad set.

This slice creates the campaign + ad set (targeting, budget) — both PAUSED.
The ad/creative layer (needs a Page + payment method) is a later slice.
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, model_validator


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

    # Creative/ad layer (optional). When creative_file_id is set, the media is
    # fetched via services.media_service and a PAUSED ad creative + ad are built.
    creative_file_id: str | None = Field(None, description="Google Drive file id (OAuth) for the creative.")
    destination_url: str | None = Field(None, description="Landing URL for the ad's call-to-action.")
    headline: str | None = Field(None, max_length=255, description="Ad headline/title.")
    message: str | None = Field(None, max_length=2200, description="Primary text shown with the ad.")
    call_to_action: str = Field("LEARN_MORE", description="Meta CTA type, e.g. LEARN_MORE, SHOP_NOW.")

    @model_validator(mode="after")
    def _creative_needs_destination(self) -> "CreateMetaCampaignRequest":
        if self.creative_file_id and not self.destination_url:
            raise ValueError("destination_url is required when a creative_file_id is provided.")
        return self


class CreateMetaCampaignResult(BaseModel):
    campaign_id: str
    ad_set_id: str
    creative_id: str | None = None
    ad_id: str | None = None
    status: str  # PAUSED — never goes live automatically in this slice
