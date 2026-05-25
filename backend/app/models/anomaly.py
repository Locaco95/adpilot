import uuid
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
from app.database import Base


class Anomaly(Base):
    __tablename__ = "anomalies"
    __table_args__ = (
        Index("ix_anomaly_active", "resolved_at", postgresql_where="resolved_at IS NULL"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    platform_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("platforms.id"), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)  # critical|warning|info
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    detail: Mapped[str] = mapped_column(String(1024), nullable=True)
    metric: Mapped[str] = mapped_column(String(32), nullable=True)
    value: Mapped[str] = mapped_column(String(64), nullable=True)
    baseline: Mapped[str] = mapped_column(String(64), nullable=True)
    z_score: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
