from pydantic import BaseModel
from datetime import date as date_type, datetime
from uuid import UUID


class PlatformBreakdown(BaseModel):
    meta: float = 0
    tiktok: float = 0
    snapchat: float = 0
    total: float = 0


class OverviewSummary(BaseModel):
    spend: float
    spendDelta: float
    conversions: int
    convDelta: float
    revenue: float
    revDelta: float
    roas: float
    roasDelta: float
    cpa: float
    cpaDelta: float
    impressions: int
    clicks: int
    ctr: float
    target_cpa: float
    target_roas: float
    daily_budget: float


class DailyMetric(BaseModel):
    date: date_type
    label: str
    spend: PlatformBreakdown
    conversions: PlatformBreakdown
    revenue: PlatformBreakdown
    roas: float
    cpa: float


class AnomalyOut(BaseModel):
    id: UUID
    severity: str
    platform: str
    timestamp: datetime
    title: str
    detail: str | None
    metric: str | None
    value: str | None
    baseline: str | None
    z_score: float | None
