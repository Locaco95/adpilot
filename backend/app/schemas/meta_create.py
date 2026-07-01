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


class Interest(BaseModel):
    """A detailed-targeting interest, as returned by the interest search."""
    id: str
    name: str


class AdCreativeSpec(BaseModel):
    """One ad (creative) under an ad set. Multiple can share the same ad set —
    the standard way to test creatives against one audience."""
    creative_file_id: str = Field(..., description="Google Drive file id (OAuth) for the creative.")
    destination_url: str = Field(..., description="Landing URL for the ad's call-to-action.")
    headline: str | None = Field(None, max_length=255, description="Ad headline/title.")
    message: str | None = Field(None, max_length=2200, description="Primary text shown with the ad.")
    call_to_action: str = Field("LEARN_MORE", description="Meta CTA type, e.g. LEARN_MORE, SHOP_NOW.")


class AdSetSpec(BaseModel):
    """One ad set under the campaign: its own targeting, budget and (optional) ads.

    Multiple of these can live under a single campaign — the standard way to
    test regions/audiences side by side (ABO: each ad set owns its budget).
    Each ad set can itself hold multiple ads (see `ads`).
    """
    country_code: str = Field(..., min_length=2, max_length=2, description="ISO-2, e.g. 'SA'")
    daily_budget: float | None = Field(None, gt=0, description="Per-ad-set budget (ABO). Omit when the campaign holds the budget (CBO).")
    age_min: int = Field(18, ge=13, le=65)
    age_max: int = Field(65, ge=13, le=65)

    # Audience targeting (optional). gender: 0=all, 1=men, 2=women.
    gender: int = Field(0, ge=0, le=2, description="0=all, 1=men, 2=women")
    languages: list[int] = Field(default_factory=list, description="Meta locale keys, e.g. [28] for Arabic.")
    interests: list[Interest] = Field(default_factory=list, description="Detailed-targeting interests (id+name from search).")

    # Schedule (optional). ISO-8601 strings passed straight to Meta. start_time
    # omitted => starts when activated; end_time omitted => runs until paused.
    start_time: str | None = Field(None, description="ISO-8601 start, e.g. 2026-06-25T09:00:00+0000")
    end_time: str | None = Field(None, description="ISO-8601 end; the ad set auto-stops at this time.")

    # Ads under this ad set (optional). Each one becomes a PAUSED creative + ad.
    ads: list[AdCreativeSpec] = Field(default_factory=list, description="Ads to create under this ad set.")

    # Legacy single-ad fields (still accepted; folded into `ads` when it's empty).
    creative_file_id: str | None = Field(None, description="Legacy single-ad creative (Google Drive file id).")
    destination_url: str | None = Field(None, description="Legacy single-ad landing URL.")
    headline: str | None = Field(None, max_length=255, description="Legacy single-ad headline.")
    message: str | None = Field(None, max_length=2200, description="Legacy single-ad primary text.")
    call_to_action: str = Field("LEARN_MORE", description="Legacy single-ad CTA type.")

    @model_validator(mode="after")
    def _normalize_ads(self) -> "AdSetSpec":
        """Fold the legacy flat creative fields into `ads`, and validate each ad."""
        if not self.ads and self.creative_file_id:
            self.ads = [AdCreativeSpec(
                creative_file_id=self.creative_file_id,
                destination_url=self.destination_url or "",
                headline=self.headline,
                message=self.message,
                call_to_action=self.call_to_action,
            )]
        for i, ad in enumerate(self.ads, start=1):
            if not ad.destination_url:
                raise ValueError(f"Ad {i}: destination_url is required when a creative is provided.")
        return self


class CreateMetaCampaignRequest(BaseModel):
    name: str = Field(..., max_length=400)
    objective: MetaObjective = MetaObjective.OUTCOME_TRAFFIC

    # Budget model. When campaign_daily_budget is set => CBO: the budget lives on
    # the campaign and Meta splits it across ad sets (ad sets carry no budget).
    # When it's None => ABO: each ad set carries its own daily_budget.
    campaign_daily_budget: float | None = Field(None, gt=0, description="Whole-campaign daily budget (CBO). Omit for per-ad-set budgets (ABO).")

    # New: one or more ad sets under this campaign. Back-compat: if ad_sets is
    # omitted, the flat fields below are wrapped into a single ad set.
    ad_sets: list[AdSetSpec] = Field(default_factory=list, description="Ad sets to create under the campaign.")

    # Legacy single-ad-set fields (still accepted; used only when ad_sets is empty).
    country_code: str | None = Field(None, min_length=2, max_length=2, description="ISO-2, e.g. 'SA' (legacy single ad set)")
    daily_budget: float | None = Field(None, gt=0, description="Legacy single ad set budget")
    age_min: int = Field(18, ge=13, le=65)
    age_max: int = Field(65, ge=13, le=65)
    creative_file_id: str | None = Field(None, description="Legacy single ad set creative.")
    destination_url: str | None = Field(None)
    headline: str | None = Field(None, max_length=255)
    message: str | None = Field(None, max_length=2200)
    call_to_action: str = Field("LEARN_MORE")

    @model_validator(mode="after")
    def _normalize_ad_sets(self) -> "CreateMetaCampaignRequest":
        """Fold legacy flat fields into ad_sets, then enforce the budget model.

        CBO (campaign_daily_budget set): ad sets must NOT carry a budget.
        ABO (campaign_daily_budget None): every ad set MUST carry a budget.
        """
        cbo = self.campaign_daily_budget is not None
        if not self.ad_sets:
            if not self.country_code:
                raise ValueError("Provide ad_sets, or the legacy country_code.")
            if not cbo and not self.daily_budget:
                raise ValueError("Provide a per-ad-set daily_budget, or a campaign_daily_budget (CBO).")
            self.ad_sets = [AdSetSpec(
                country_code=self.country_code,
                daily_budget=None if cbo else self.daily_budget,
                age_min=self.age_min,
                age_max=self.age_max,
                creative_file_id=self.creative_file_id,
                destination_url=self.destination_url,
                headline=self.headline,
                message=self.message,
                call_to_action=self.call_to_action,
            )]

        for i, a in enumerate(self.ad_sets, start=1):
            if cbo and a.daily_budget is not None:
                raise ValueError(f"Ad set {i}: drop the budget — the campaign holds it (CBO).")
            if not cbo and a.daily_budget is None:
                raise ValueError(f"Ad set {i}: a daily_budget is required (ABO).")
        return self


class CreatedAd(BaseModel):
    ad_id: str
    creative_id: str


class CreatedAdSet(BaseModel):
    ad_set_id: str
    country_code: str
    ads: list[CreatedAd] = Field(default_factory=list)

    # Back-compat convenience: first ad's ids, so existing UI keeps working.
    creative_id: str | None = None
    ad_id: str | None = None


class CreateMetaCampaignResult(BaseModel):
    campaign_id: str
    status: str  # PAUSED — never goes live automatically
    ad_sets: list[CreatedAdSet] = Field(default_factory=list)

    # Back-compat convenience: first ad set's ids, so existing UI keeps working.
    ad_set_id: str | None = None
    creative_id: str | None = None
    ad_id: str | None = None
