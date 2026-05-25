import uuid
from sqlalchemy import String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
from app.database import Base


class CreativeDraft(Base):
    __tablename__ = "creative_drafts"
    __table_args__ = (
        Index("ix_creative_status", "platform_id", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    platform_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("platforms.id"), nullable=False)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=True)
    ad_set_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("ad_sets.id"), nullable=True)
    hook: Mapped[str] = mapped_column(String(32), nullable=False)  # pain_point|curiosity|social_proof|scarcity|identity
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    headline: Mapped[str] = mapped_column(String(64), nullable=False)
    primary_text: Mapped[str] = mapped_column(String(256), nullable=False)
    cta: Mapped[str] = mapped_column(String(32), nullable=False)
    headline_en: Mapped[str | None] = mapped_column(String(128), nullable=True)
    primary_text_en: Mapped[str | None] = mapped_column(String(512), nullable=True)
    generation_prompt: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(64), nullable=True)
    week_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
