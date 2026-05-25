import uuid
from sqlalchemy import String, Integer, BigInteger, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
from app.database import Base


class TelegramMessage(Base):
    __tablename__ = "telegram_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("actions.id"), nullable=True)
    message_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chat_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)  # approval_request|auto_notification|anomaly_alert|digest
    text_sent: Mapped[str] = mapped_column(String(4096), nullable=False)
    buttons_sent: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    response_received: Mapped[str | None] = mapped_column(String(64), nullable=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
