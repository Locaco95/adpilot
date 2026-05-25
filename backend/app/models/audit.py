import uuid
from sqlalchemy import String, Integer, DateTime, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, INET
from datetime import datetime, timezone
from app.database import Base


class AuditLog(Base):
    """Append-only. Supabase RLS enforces INSERT-only."""
    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_timestamp", "timestamp"),
        Index("ix_audit_entity", "entity_id", "timestamp"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    tier: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detail: Mapped[str] = mapped_column(String(1024), nullable=True)
    actor: Mapped[str] = mapped_column(String(64), nullable=False)  # system|operator|telegram
    entity_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    params_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
