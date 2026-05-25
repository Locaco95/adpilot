from pydantic import BaseModel
from uuid import UUID


class CampaignOut(BaseModel):
    id: UUID
    platform: str
    name: str
    status: str
    budget: float
    spend_7d: float
    conv_7d: int
    rev_7d: float
    cpa: float
    roas: float
    ctr: float
    freq: float
    trend: str  # up|down|stable


class CampaignPatch(BaseModel):
    status: str | None = None
    daily_budget: float | None = None
