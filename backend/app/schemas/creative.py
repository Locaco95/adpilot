from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import Literal


HookType = Literal["pain_point", "curiosity", "social_proof", "scarcity", "identity"]


class CreativeDraftOut(BaseModel):
    id: UUID
    platform: str
    campaign: str | None
    hook: str
    status: str
    headline: str
    primary_text: str
    cta: str
    headline_en: str | None
    primary_text_en: str | None
    created_at: datetime


class CreativeDecision(BaseModel):
    decision: Literal["approved", "rejected"]


class CreativeGenerateRequest(BaseModel):
    campaign_id: UUID
    ad_set_id: UUID | None = None
    hook_types: list[HookType] = Field(default_factory=lambda: ["pain_point", "social_proof"])
    count: int = Field(default=3, ge=1, le=10)
