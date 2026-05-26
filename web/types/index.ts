/* ── AdPilot — TypeScript Types ────────────────────────────────── */

export type Platform = "meta" | "tiktok" | "snapchat";
export type CampaignStatus = "active" | "paused" | "warning" | "ended";
export type ActionTier = 1 | 2 | 3;
export type ActionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "deferred"
  | "auto_approved"
  | "revoked";
export type CreativeStatus = "draft" | "approved" | "rejected" | "live";
export type HookType =
  | "pain_point"
  | "social_proof"
  | "scarcity"
  | "identity"
  | "curiosity";
export type ImpactLevel = "high" | "medium" | "low";
export type TrendDirection = "up" | "down" | "flat";
export type AnomalySeverity = "critical" | "warning" | "info";
export type AuditAction =
  | "action_proposed"
  | "anomaly_detected"
  | "budget_realloc"
  | "creative_generated"
  | "data_pull"
  | "reconciliation"
  | "action_approved"
  | "campaign_paused"
  | "digest_sent"
  | "action_rejected";

/* ── Auth ─────────────────────────────────────────────────────── */
export interface TokenResponse {
  access_token: string;
  token_type: string;
}

/* ── Overview ─────────────────────────────────────────────────── */
export interface PlatformBreakdown {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
}

export interface OverviewSummary {
  total_spend: number;
  total_revenue: number;
  blended_roas: number;
  blended_cpa: number;
  total_conversions: number;
  active_campaigns: number;
  spend_delta: number;
  roas_delta: number;
  cpa_delta: number;
  conv_delta: number;
  meta: PlatformBreakdown;
  tiktok: PlatformBreakdown;
  snapchat: PlatformBreakdown;
}

export interface DailyMetricPoint {
  date: string;
  meta: number;
  tiktok: number;
  snapchat: number;
  total: number;
}

export interface DailyMetrics {
  spend: DailyMetricPoint[];
  roas: DailyMetricPoint[];
  conversions: DailyMetricPoint[];
  cpa: DailyMetricPoint[];
}

/* ── Anomaly ──────────────────────────────────────────────────── */
export interface Anomaly {
  id: string;
  severity: AnomalySeverity;
  campaign: string;
  platform: Platform;
  metric: string;
  value: number;
  baseline: number;
  z_score: number;
  detected_at: string;
  resolved_at: string | null;
  message: string;
}

/* ── Campaign ─────────────────────────────────────────────────── */
export interface Campaign {
  id: string;
  name: string;
  platform: Platform;
  status: CampaignStatus;
  budget: number;
  spend7d: number;
  conv7d: number;
  cpa: number;
  roas: number;
  ctr: number;
  freq: number;
  trend: TrendDirection;
}

/* ── Action ───────────────────────────────────────────────────── */
export interface Action {
  id: string;
  tier: ActionTier;
  platform: Platform;
  impact: ImpactLevel;
  description: string;
  campaign: string;
  rationale: string;
  estimatedGain?: string;
  status?: ActionStatus;
  autoWindow?: string;
  createdAt: string;
}

export interface DecideActionPayload {
  decision: "approved" | "rejected" | "deferred";
}

/* ── Creative ─────────────────────────────────────────────────── */
export interface CreativeDraft {
  id: string;
  platform: Platform;
  hook: HookType;
  status: CreativeStatus;
  headline: string;
  primaryText: string;
  cta: string;
  headlineEn: string;
  primaryTextEn: string;
  campaign: string;
}

/* ── Audit ────────────────────────────────────────────────────── */
export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  tier: ActionTier;
  detail: string;
  actor: string;
}

/* ── Telegram ─────────────────────────────────────────────────── */
export interface TelegramMessage {
  id: string;
  text: string;
  buttons: string[];
  time: string;
}

/* ── System ───────────────────────────────────────────────────── */
export interface SystemHealth {
  status: "ok" | "degraded" | "down";
  version: string;
  uptime: number;
}

/* ── API Response wrappers ────────────────────────────────────── */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
