import uuid
from sqlalchemy import String, Numeric, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
from app.database import Base


class ShopifyOrder(Base):
    __tablename__ = "shopify_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shopify_order_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    total_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="SAR")
    customer_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    landing_site: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    referring_site: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class AttributionMap(Base):
    __tablename__ = "attribution_map"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shopify_order_id: Mapped[str] = mapped_column(String(64), ForeignKey("shopify_orders.shopify_order_id"), nullable=False)
    ad_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("ads.id"), nullable=True)
    ad_set_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("ad_sets.id"), nullable=True)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=True)
    platform_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("platforms.id"), nullable=True)
    attribution_window: Mapped[str] = mapped_column(String(16), nullable=False, default="7d_click")
    revenue_attributed: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    is_final: Mapped[bool] = mapped_column(Boolean, default=False)
    attributed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
