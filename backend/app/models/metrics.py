import uuid
from sqlalchemy import String, Numeric, BigInteger, Boolean, DateTime, Date, ForeignKey, JSON, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, date, timezone
from app.database import Base


class DailyMetric(Base):
    __tablename__ = "daily_metrics"
    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", "date", name="uq_metric_entity_date"),
        Index("ix_metric_entity_date", "entity_id", "date"),
        Index("ix_metric_date_type", "date", "entity_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)  # campaign|ad_set|ad|account
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    platform_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("platforms.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    is_provisional: Mapped[bool] = mapped_column(Boolean, default=True)

    # Raw metrics
    spend: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    impressions: Mapped[int] = mapped_column(BigInteger, default=0)
    clicks: Mapped[int] = mapped_column(BigInteger, default=0)
    reach: Mapped[int] = mapped_column(BigInteger, default=0)
    conversions: Mapped[int] = mapped_column(BigInteger, default=0)
    revenue: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    frequency: Mapped[float] = mapped_column(Numeric(6, 3), default=0)
    ctr: Mapped[float] = mapped_column(Numeric(8, 6), default=0)
    cpm: Mapped[float] = mapped_column(Numeric(8, 4), default=0)
    cpc: Mapped[float] = mapped_column(Numeric(8, 4), default=0)
    cpa: Mapped[float] = mapped_column(Numeric(8, 4), default=0)
    roas: Mapped[float] = mapped_column(Numeric(8, 4), default=0)
    hook_rate: Mapped[float] = mapped_column(Numeric(6, 4), default=0)
    thumb_stop_rate: Mapped[float] = mapped_column(Numeric(6, 4), default=0)

    # Analytics columns (written by analyst agent)
    ewma_cpa: Mapped[float | None] = mapped_column(Numeric(8, 4), nullable=True)
    ewma_roas: Mapped[float | None] = mapped_column(Numeric(8, 4), nullable=True)
    z_score_cpa: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    z_score_roas: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    bayes_cpa_lo: Mapped[float | None] = mapped_column(Numeric(8, 4), nullable=True)
    bayes_cpa_hi: Mapped[float | None] = mapped_column(Numeric(8, 4), nullable=True)

    raw_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pulled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
