"""Request/response schemas for creating a Snap campaign end-to-end."""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class SnapObjective(str, Enum):
    AWARENESS_AND_ENGAGEMENT = "AWARENESS_AND_ENGAGEMENT"
    SALES = "SALES"
    TRAFFIC = "TRAFFIC"
    APP_PROMOTION = "APP_PROMOTION"
    LEADS = "LEADS"


class SnapMediaType(str, Enum):
    VIDEO = "VIDEO"
    IMAGE = "IMAGE"


# optimization_goal that pairs sensibly with each objective for a WEB_VIEW ad
OBJECTIVE_OPTIMIZATION = {
    SnapObjective.AWARENESS_AND_ENGAGEMENT: "IMPRESSIONS",
    SnapObjective.SALES: "PIXEL_PURCHASE",
    SnapObjective.TRAFFIC: "SWIPES",
    SnapObjective.APP_PROMOTION: "APP_INSTALLS",
    SnapObjective.LEADS: "SWIPES",
}


class CreateCampaignRequest(BaseModel):
    name: str = Field(..., max_length=375)
    objective: SnapObjective = SnapObjective.TRAFFIC
    country_code: str = Field(..., min_length=2, max_length=2, description="ISO-2, e.g. 'sa'")
    daily_budget: float = Field(..., ge=20, description="In the ad account's currency; Snap min is 20")
    destination_url: str = Field(..., description="Where the swipe-up goes (WEB_VIEW url)")
    headline: str = Field(..., max_length=34)
    drive_url: str = Field(..., description="Public Google Drive share link to the creative")
    media_type: SnapMediaType = SnapMediaType.VIDEO


class CreateCampaignResult(BaseModel):
    campaign_id: str
    ad_squad_id: str
    creative_id: str
    ad_id: str
    media_id: str
    media_status: str
    status: str  # PAUSED — never goes live automatically in this slice
