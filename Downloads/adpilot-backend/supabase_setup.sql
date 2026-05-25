-- ════════════════════════════════════════════════════════════════
-- AdPilot Supabase setup — paste this entire file into:
--   Supabase Dashboard → SQL Editor → New query → Run
-- ════════════════════════════════════════════════════════════════
-- Creates all 13 tables + indexes + audit_log immutability trigger.
-- Idempotent: safe to re-run (drops existing tables first).
-- After running this, run `python seed.py` from the backend repo
-- to populate mock data.
-- ════════════════════════════════════════════════════════════════

-- Drop in FK-safe reverse order
DROP TABLE IF EXISTS attribution_map      CASCADE;
DROP TABLE IF EXISTS shopify_orders       CASCADE;
DROP TABLE IF EXISTS telegram_messages    CASCADE;
DROP TABLE IF EXISTS creative_drafts      CASCADE;
DROP TABLE IF EXISTS audit_log            CASCADE;
DROP TABLE IF EXISTS actions              CASCADE;
DROP TABLE IF EXISTS anomalies            CASCADE;
DROP TABLE IF EXISTS daily_metrics        CASCADE;
DROP TABLE IF EXISTS ads                  CASCADE;
DROP TABLE IF EXISTS ad_sets              CASCADE;
DROP TABLE IF EXISTS campaigns            CASCADE;
DROP TABLE IF EXISTS platforms            CASCADE;
DROP TABLE IF EXISTS system_config        CASCADE;
DROP FUNCTION IF EXISTS audit_log_block_modify() CASCADE;

-- ── platforms ─────────────────────────────────────────────────
CREATE TABLE platforms (
    id UUID PRIMARY KEY,
    slug VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(64) NOT NULL,
    color VARCHAR(16) NOT NULL,
    icon VARCHAR(4) NOT NULL,
    budget_share DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── campaigns ─────────────────────────────────────────────────
CREATE TABLE campaigns (
    id UUID PRIMARY KEY,
    external_id VARCHAR(64) NOT NULL,
    platform_id UUID NOT NULL REFERENCES platforms(id),
    name VARCHAR(256) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    daily_budget NUMERIC(10,2),
    lifetime_budget NUMERIC(10,2),
    objective VARCHAR(64),
    target_cpa NUMERIC(10,2),
    target_roas NUMERIC(5,3),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_campaign_external UNIQUE (platform_id, external_id)
);
CREATE INDEX ix_campaign_platform_status ON campaigns(platform_id, status);

-- ── ad_sets ───────────────────────────────────────────────────
CREATE TABLE ad_sets (
    id UUID PRIMARY KEY,
    external_id VARCHAR(64) NOT NULL,
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    name VARCHAR(256) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    daily_budget NUMERIC(10,2),
    audience_spec JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_adset_external UNIQUE (campaign_id, external_id)
);

-- ── ads ───────────────────────────────────────────────────────
CREATE TABLE ads (
    id UUID PRIMARY KEY,
    external_id VARCHAR(64) NOT NULL,
    ad_set_id UUID NOT NULL REFERENCES ad_sets(id),
    name VARCHAR(256) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    creative_id UUID,
    first_live_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_ad_external UNIQUE (ad_set_id, external_id)
);

-- ── daily_metrics ─────────────────────────────────────────────
CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(32) NOT NULL,
    entity_id UUID NOT NULL,
    platform_id UUID NOT NULL REFERENCES platforms(id),
    date DATE NOT NULL,
    is_provisional BOOLEAN DEFAULT TRUE,
    spend NUMERIC(12,2) DEFAULT 0,
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    reach BIGINT DEFAULT 0,
    conversions BIGINT DEFAULT 0,
    revenue NUMERIC(12,2) DEFAULT 0,
    frequency NUMERIC(6,3) DEFAULT 0,
    ctr NUMERIC(8,6) DEFAULT 0,
    cpm NUMERIC(8,4) DEFAULT 0,
    cpc NUMERIC(8,4) DEFAULT 0,
    cpa NUMERIC(8,4) DEFAULT 0,
    roas NUMERIC(8,4) DEFAULT 0,
    hook_rate NUMERIC(6,4) DEFAULT 0,
    thumb_stop_rate NUMERIC(6,4) DEFAULT 0,
    ewma_cpa NUMERIC(8,4),
    ewma_roas NUMERIC(8,4),
    z_score_cpa NUMERIC(6,3),
    z_score_roas NUMERIC(6,3),
    bayes_cpa_lo NUMERIC(8,4),
    bayes_cpa_hi NUMERIC(8,4),
    raw_payload JSONB,
    pulled_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_metric_entity_date UNIQUE (entity_type, entity_id, date)
);
CREATE INDEX ix_metric_entity_date ON daily_metrics(entity_id, date DESC);
CREATE INDEX ix_metric_date_type ON daily_metrics(date, entity_type);

-- ── anomalies ─────────────────────────────────────────────────
CREATE TABLE anomalies (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(32) NOT NULL,
    entity_id UUID NOT NULL,
    platform_id UUID NOT NULL REFERENCES platforms(id),
    severity VARCHAR(16) NOT NULL,
    title VARCHAR(256) NOT NULL,
    detail VARCHAR(1024),
    metric VARCHAR(32),
    value VARCHAR(64),
    baseline VARCHAR(64),
    z_score NUMERIC(6,3),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ix_anomaly_active ON anomalies(resolved_at) WHERE resolved_at IS NULL;

-- ── actions ───────────────────────────────────────────────────
CREATE TABLE actions (
    id UUID PRIMARY KEY,
    tier INTEGER NOT NULL,
    type VARCHAR(64) NOT NULL,
    platform_id UUID REFERENCES platforms(id),
    campaign_id UUID REFERENCES campaigns(id),
    description VARCHAR(512) NOT NULL,
    rationale VARCHAR(1024),
    params JSONB NOT NULL DEFAULT '{}',
    impact VARCHAR(16),
    risk VARCHAR(16),
    estimated_gain VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    decision_actor VARCHAR(64),
    decision_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    revoke_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ix_action_pending ON actions(status, tier) WHERE status = 'pending';
CREATE INDEX ix_action_expires ON actions(expires_at) WHERE status = 'pending';

-- ── audit_log (immutable, INSERT-only) ────────────────────────
CREATE TABLE audit_log (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    action VARCHAR(64) NOT NULL,
    tier INTEGER,
    detail VARCHAR(1024),
    actor VARCHAR(64) NOT NULL,
    entity_type VARCHAR(32),
    entity_id UUID,
    params_snapshot JSONB,
    ip_address INET
);
CREATE INDEX ix_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX ix_audit_entity ON audit_log(entity_id, timestamp DESC);

CREATE OR REPLACE FUNCTION audit_log_block_modify() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only; UPDATE/DELETE not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
    BEFORE UPDATE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_block_modify();

CREATE TRIGGER audit_log_no_delete
    BEFORE DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_block_modify();

-- ── creative_drafts ───────────────────────────────────────────
CREATE TABLE creative_drafts (
    id UUID PRIMARY KEY,
    platform_id UUID NOT NULL REFERENCES platforms(id),
    campaign_id UUID REFERENCES campaigns(id),
    ad_set_id UUID REFERENCES ad_sets(id),
    hook VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    headline VARCHAR(64) NOT NULL,
    primary_text VARCHAR(256) NOT NULL,
    cta VARCHAR(32) NOT NULL,
    headline_en VARCHAR(128),
    primary_text_en VARCHAR(512),
    generation_prompt VARCHAR(2048),
    model_used VARCHAR(64),
    week_number INTEGER,
    year INTEGER,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ix_creative_status ON creative_drafts(platform_id, status, created_at DESC);

-- ── telegram_messages ─────────────────────────────────────────
CREATE TABLE telegram_messages (
    id UUID PRIMARY KEY,
    action_id UUID REFERENCES actions(id),
    message_id INTEGER,
    chat_id BIGINT NOT NULL,
    type VARCHAR(32) NOT NULL,
    text_sent VARCHAR(4096) NOT NULL,
    buttons_sent JSONB,
    response_received VARCHAR(64),
    responded_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── shopify_orders ────────────────────────────────────────────
CREATE TABLE shopify_orders (
    id UUID PRIMARY KEY,
    shopify_order_id VARCHAR(64) UNIQUE NOT NULL,
    status VARCHAR(32) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'SAR',
    customer_id VARCHAR(64),
    landing_site VARCHAR(1024),
    referring_site VARCHAR(1024),
    created_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    raw_payload JSONB
);

-- ── attribution_map ───────────────────────────────────────────
CREATE TABLE attribution_map (
    id UUID PRIMARY KEY,
    shopify_order_id VARCHAR(64) NOT NULL REFERENCES shopify_orders(shopify_order_id),
    ad_id UUID REFERENCES ads(id),
    ad_set_id UUID REFERENCES ad_sets(id),
    campaign_id UUID REFERENCES campaigns(id),
    platform_id UUID REFERENCES platforms(id),
    attribution_window VARCHAR(16) NOT NULL DEFAULT '7d_click',
    revenue_attributed NUMERIC(10,2) NOT NULL,
    is_final BOOLEAN DEFAULT FALSE,
    attributed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── system_config ─────────────────────────────────────────────
CREATE TABLE system_config (
    key VARCHAR(128) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by VARCHAR(64)
);

-- ✅ Done. 13 tables, 8 indexes, 1 immutability trigger.
SELECT 'AdPilot schema installed successfully' AS status;
