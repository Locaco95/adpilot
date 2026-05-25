import uuid
from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
from app.database import Base


class Action(Base):
    __tablename__ = "actions"
    __table_args__ = (
        Index("ix_action_pending", "status", "tier", postgresql_where="status = 'pending'"),
        Index("ix_action_expires", "expires_at", postgresql_where="status = 'pending'"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tier: Mapped[int] = mapped_column(Integer, nullable=False)  # 1|2|3
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    platform_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("platforms.id"), nullable=True)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=True)
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    rationale: Mapped[str] = mapped_column(String(1024), nullable=True)
    params: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    impact: Mapped[str] = mapped_column(String(16), nullable=True)
    risk: Mapped[str] = mapped_column(String(16), nullable=True)
    estimated_gain: Mapped[str] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    decision_actor: Mapped[str | None] = mapped_column(String(64), nullable=True)
    decision_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoke_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
