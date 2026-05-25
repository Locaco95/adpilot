from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import Literal


class ActionOut(BaseModel):
    id: UUID
    tier: int
    type: str
    platform: str | None
    campaign: str | None
    description: str
    rationale: str | None
    impact: str | None
    risk: str | None
    estimatedGain: str | None
    status: str
    createdAt: datetime
    expiresAt: datetime | None
    revokeDeadline: datetime | None


class ActionDecision(BaseModel):
    decision: Literal["approved", "rejected", "deferred"]
    defer_hours: int | None = Field(default=None, ge=1, le=72)
