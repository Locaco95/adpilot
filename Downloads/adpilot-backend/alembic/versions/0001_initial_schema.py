"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-25

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # platforms
    op.create_table(
        "platforms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(32), unique=True, nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("color", sa.String(16), nullable=False),
        sa.Column("icon", sa.String(4), nullable=False),
        sa.Column("budget_share", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # campaigns
    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("external_id", sa.String(64), nullable=False),
        sa.Column("platform_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("platforms.id"), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("daily_budget", sa.Numeric(10, 2)),
        sa.Column("lifetime_budget", sa.Numeric(10, 2)),
        sa.Column("objective", sa.String(64)),
        sa.Column("target_cpa", sa.Numeric(10, 2)),
        sa.Column("target_roas", sa.Numeric(5, 3)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("platform_id", "external_id", name="uq_campaign_external"),
    )
    op.create_index("ix_campaign_platform_status", "campaigns", ["platform_id", "status"])

    # ad_sets
    op.create_table(
        "ad_sets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("external_id", sa.String(64), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("daily_budget", sa.Numeric(10, 2)),
        sa.Column("audience_spec", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("campaign_id", "external_id", name="uq_adset_external"),
    )

    # ads
    op.create_table(
        "ads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("external_id", sa.String(64), nullable=False),
        sa.Column("ad_set_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ad_sets.id"), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("creative_id", postgresql.UUID(as_uuid=True)),
        sa.Column("first_live_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("ad_set_id", "external_id", name="uq_ad_external"),
    )

    # daily_metrics
    op.create_table(
        "daily_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(32), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("platforms.id"), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("is_provisional", sa.Boolean, server_default=sa.text("true")),
        sa.Column("spend", sa.Numeric(12, 2), server_default="0"),
        sa.Column("impressions", sa.BigInteger, server_default="0"),
        sa.Column("clicks", sa.BigInteger, server_default="0"),
        sa.Column("reach", sa.BigInteger, server_default="0"),
        sa.Column("conversions", sa.BigInteger, server_default="0"),
        sa.Column("revenue", sa.Numeric(12, 2), server_default="0"),
        sa.Column("frequency", sa.Numeric(6, 3), server_default="0"),
        sa.Column("ctr", sa.Numeric(8, 6), server_default="0"),
        sa.Column("cpm", sa.Numeric(8, 4), server_default="0"),
        sa.Column("cpc", sa.Numeric(8, 4), server_default="0"),
        sa.Column("cpa", sa.Numeric(8, 4), server_default="0"),
        sa.Column("roas", sa.Numeric(8, 4), server_default="0"),
        sa.Column("hook_rate", sa.Numeric(6, 4), server_default="0"),
        sa.Column("thumb_stop_rate", sa.Numeric(6, 4), server_default="0"),
        sa.Column("ewma_cpa", sa.Numeric(8, 4)),
        sa.Column("ewma_roas", sa.Numeric(8, 4)),
        sa.Column("z_score_cpa", sa.Numeric(6, 3)),
        sa.Column("z_score_roas", sa.Numeric(6, 3)),
        sa.Column("bayes_cpa_lo", sa.Numeric(8, 4)),
        sa.Column("bayes_cpa_hi", sa.Numeric(8, 4)),
        sa.Column("raw_payload", postgresql.JSONB),
        sa.Column("pulled_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("entity_type", "entity_id", "date", name="uq_metric_entity_date"),
    )
    op.create_index("ix_metric_entity_date", "daily_metrics", ["entity_id", sa.text("date DESC")])
    op.create_index("ix_metric_date_type", "daily_metrics", ["date", "entity_type"])

    # anomalies
    op.create_table(
        "anomalies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(32), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("platforms.id"), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("detail", sa.String(1024)),
        sa.Column("metric", sa.String(32)),
        sa.Column("value", sa.String(64)),
        sa.Column("baseline", sa.String(64)),
        sa.Column("z_score", sa.Numeric(6, 3)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_anomaly_active", "anomalies", ["resolved_at"], postgresql_where=sa.text("resolved_at IS NULL"))

    # actions
    op.create_table(
        "actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tier", sa.Integer, nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("platform_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("platforms.id")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id")),
        sa.Column("description", sa.String(512), nullable=False),
        sa.Column("rationale", sa.String(1024)),
        sa.Column("params", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("impact", sa.String(16)),
        sa.Column("risk", sa.String(16)),
        sa.Column("estimated_gain", sa.String(128)),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("decision_actor", sa.String(64)),
        sa.Column("decision_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("executed_at", sa.DateTime(timezone=True)),
        sa.Column("revoke_deadline", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_action_pending", "actions", ["status", "tier"], postgresql_where=sa.text("status = 'pending'"))
    op.create_index("ix_action_expires", "actions", ["expires_at"], postgresql_where=sa.text("status = 'pending'"))

    # audit_log
    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("tier", sa.Integer),
        sa.Column("detail", sa.String(1024)),
        sa.Column("actor", sa.String(64), nullable=False),
        sa.Column("entity_type", sa.String(32)),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True)),
        sa.Column("params_snapshot", postgresql.JSONB),
        sa.Column("ip_address", postgresql.INET),
    )
    op.create_index("ix_audit_timestamp", "audit_log", [sa.text("timestamp DESC")])
    op.create_index("ix_audit_entity", "audit_log", ["entity_id", sa.text("timestamp DESC")])

    # creative_drafts
    op.create_table(
        "creative_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("platform_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("platforms.id"), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id")),
        sa.Column("ad_set_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ad_sets.id")),
        sa.Column("hook", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("headline", sa.String(64), nullable=False),
        sa.Column("primary_text", sa.String(256), nullable=False),
        sa.Column("cta", sa.String(32), nullable=False),
        sa.Column("headline_en", sa.String(128)),
        sa.Column("primary_text_en", sa.String(512)),
        sa.Column("generation_prompt", sa.String(2048)),
        sa.Column("model_used", sa.String(64)),
        sa.Column("week_number", sa.Integer),
        sa.Column("year", sa.Integer),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_creative_status", "creative_drafts", ["platform_id", "status", sa.text("created_at DESC")])

    # telegram_messages
    op.create_table(
        "telegram_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("action_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("actions.id")),
        sa.Column("message_id", sa.Integer),
        sa.Column("chat_id", sa.BigInteger, nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("text_sent", sa.String(4096), nullable=False),
        sa.Column("buttons_sent", postgresql.JSONB),
        sa.Column("response_received", sa.String(64)),
        sa.Column("responded_at", sa.DateTime(timezone=True)),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # shopify_orders
    op.create_table(
        "shopify_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shopify_order_id", sa.String(64), unique=True, nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("total_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False, server_default="SAR"),
        sa.Column("customer_id", sa.String(64)),
        sa.Column("landing_site", sa.String(1024)),
        sa.Column("referring_site", sa.String(1024)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.Column("raw_payload", postgresql.JSONB),
    )

    # attribution_map
    op.create_table(
        "attribution_map",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shopify_order_id", sa.String(64), sa.ForeignKey("shopify_orders.shopify_order_id"), nullable=False),
        sa.Column("ad_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ads.id")),
        sa.Column("ad_set_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ad_sets.id")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id")),
        sa.Column("platform_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("platforms.id")),
        sa.Column("attribution_window", sa.String(16), nullable=False, server_default="7d_click"),
        sa.Column("revenue_attributed", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_final", sa.Boolean, server_default=sa.text("false")),
        sa.Column("attributed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # system_config
    op.create_table(
        "system_config",
        sa.Column("key", sa.String(128), primary_key=True),
        sa.Column("value", postgresql.JSONB, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_by", sa.String(64)),
    )


def downgrade() -> None:
    for tbl in [
        "system_config", "attribution_map", "shopify_orders", "telegram_messages",
        "creative_drafts", "audit_log", "actions", "anomalies", "daily_metrics",
        "ads", "ad_sets", "campaigns", "platforms",
    ]:
        op.drop_table(tbl)
