/* ── AdPilot — Meta Marketing API service ──────────────────────── */
import { apiGet, apiPost, apiDelete } from "./api-client";
import type {
  MetaStatus,
  MetaAccount,
  MetaCampaign,
  MetaAdSet,
  MetaInterest,
  MetaInsightRow,
  MetaListResponse,
  MetaObjective,
  AdSetSpec,
  CreatedAdSet,
  CreateMetaCampaignRequest,
  CreateMetaCampaignResult,
  MetaAudit,
} from "@/types/meta";

export function getMetaAudit(datePreset = "last_7d"): Promise<MetaAudit> {
  return apiGet<MetaAudit>(`/meta/audit?date_preset=${datePreset}`);
}

/* ── Optimizer (deterministic decision engine) ── */
export interface OptimizerRec {
  entity_id: string;
  entity_name: string;
  metrics_snapshot: Record<string, unknown>;
  gate_check: string;
  diagnosis: string;
  matched_rule: string;
  recommended_action: "KILL" | "SCALE" | "HOLD" | "REFRESH_CREATIVE" | "PAUSE" | "DUPLICATE_WINNER";
  confidence: "high" | "medium" | "low";
  human_approval_required: boolean;
}

export interface OptimizerRecsResponse {
  date_preset: string;
  config: { breakeven_roas: number; target_cpa: number; currency: string; approval_threshold: number };
  count: number;
  recommendations: OptimizerRec[];
  note: string;
}

export interface OptimizerConfig {
  enabled: boolean;
  auto_execute: boolean;
  breakeven_roas: number;
  target_cpa: number;
  currency: string;
  human_approval_spend_threshold: number;
  selected_metrics: string[];
  // AI media buyer
  ai_enabled: boolean;
  avg_order_value: number;
  min_days_before_judgment: number;
  min_daily_spend_per_adset: number;
  max_frequency: number;
  aggressiveness: "conservative" | "balanced" | "aggressive";
  scale_step_pct: number;
  decrease_step_pct: number;
  max_auto_budget_change_pct: number;
  auto_kill: boolean;
  auto_scale: boolean;
  auto_decrease: boolean;
}

export interface AiRecommendation {
  entity_id: string;
  entity_name: string;
  diagnosis: string;
  action: "KILL" | "SCALE" | "DECREASE" | "HOLD" | "ROTATE_CREATIVE" | "DUPLICATE_WINNER" | "FLAG_FUNNEL";
  reasoning: string;
  confidence: "high" | "medium" | "low";
  executed?: boolean;
  result?: string;
}

export interface AiRunResponse {
  ran: boolean;
  reason?: string;
  auto_execute?: boolean;
  evaluated?: number;
  executed?: number;
  queued?: number;
  recommendations: AiRecommendation[];
}

export function runAiMediaBuyer(): Promise<AiRunResponse> {
  return apiPost<AiRunResponse>("/settings/ai-media-buyer/run", {}, 120_000);
}

export type RealOrdersMap = Record<string, { orders: number; at: string }>;

export interface RealRoasResponse {
  aov: number;
  campaigns: Record<string, { orders: number; revenue: number; roas: number | null; cpa: number | null }>;
}

export function getRealRoas(datePreset = "last_7d"): Promise<RealRoasResponse> {
  return apiGet<RealRoasResponse>(`/meta/real-roas?date_preset=${datePreset}`);
}

export function getRealOrders(): Promise<RealOrdersMap> {
  return apiGet<RealOrdersMap>("/settings/real-orders");
}

export function setRealOrders(entityId: string, orders: number): Promise<RealOrdersMap> {
  return apiPost<RealOrdersMap>("/settings/real-orders", { entity_id: entityId, orders });
}

export interface AiMemory { lessons: string[]; decision_count: number }

export function getAiMemory(): Promise<AiMemory> {
  return apiGet<AiMemory>("/settings/ai-media-buyer/memory");
}

export function runAiSelfReview(): Promise<{ lessons_added: number; lessons: string[] }> {
  return apiPost("/settings/ai-media-buyer/self-review", {}, 120_000);
}

export interface MetricDef {
  key: string;
  label: string;
  group: string;
  requires: "" | "pixel" | "video" | "history";
  desc: string;
}

export interface MetricsCatalog { metrics: MetricDef[] }

export interface EntityMetrics {
  entity_id: string;
  entity_name: string;
  metrics: Record<string, number | null>;
}

export interface OptimizerMetricsResponse {
  date_preset: string;
  count: number;
  entities: EntityMetrics[];
}

export function getOptimizerMetricsCatalog(): Promise<MetricsCatalog> {
  return apiGet<MetricsCatalog>("/meta/optimizer/metrics-catalog");
}

export function getOptimizerMetrics(datePreset = "last_7d"): Promise<OptimizerMetricsResponse> {
  return apiGet<OptimizerMetricsResponse>(`/meta/optimizer/metrics?date_preset=${datePreset}`);
}

export function getOptimizerRecs(datePreset = "last_7d"): Promise<OptimizerRecsResponse> {
  return apiGet<OptimizerRecsResponse>(`/meta/optimizer/recommendations?date_preset=${datePreset}`);
}

export function getOptimizerConfig(): Promise<OptimizerConfig> {
  return apiGet<OptimizerConfig>("/settings/optimizer");
}

export function setOptimizerConfig(patch: Partial<OptimizerConfig>): Promise<OptimizerConfig> {
  return apiPost<OptimizerConfig>("/settings/optimizer", patch);
}

export function runOptimizerNow(): Promise<Record<string, unknown>> {
  return apiPost<Record<string, unknown>>("/settings/optimizer/run", {}, 120_000);
}

export function getMetaStatus(): Promise<MetaStatus> {
  return apiGet<MetaStatus>("/meta/status");
}

export function getMetaAccount(): Promise<MetaAccount> {
  return apiGet<MetaAccount>("/meta/account");
}

export function getMetaCampaigns(): Promise<MetaListResponse<MetaCampaign>> {
  return apiGet<MetaListResponse<MetaCampaign>>("/meta/campaigns");
}

export function getMetaInsights(
  level: "account" | "campaign" | "adset" | "ad" = "campaign",
  datePreset = "last_7d"
): Promise<MetaListResponse<MetaInsightRow>> {
  return apiGet<MetaListResponse<MetaInsightRow>>(
    `/meta/insights?level=${level}&date_preset=${datePreset}`
  );
}

export function createMetaCampaign(
  payload: CreateMetaCampaignRequest
): Promise<CreateMetaCampaignResult> {
  // Video creatives are downloaded from Drive + uploaded to Meta server-side,
  // which can take well over the default 15s — allow up to 5 minutes.
  return apiPost<CreateMetaCampaignResult>("/meta/campaigns/create", payload, 300_000);
}

/* Split create — campaign shell first, then one ad set per request. Each ad-set
   request carries at most one video upload, avoiding the multi-video 502. */
export function createMetaCampaignShell(
  body: { name: string; objective: MetaObjective; campaign_daily_budget?: number }
): Promise<{ campaign_id: string; status: string }> {
  return apiPost("/meta/campaigns", body);
}

export function createMetaAdSet(
  campaignId: string,
  spec: AdSetSpec,
  meta: { index: number; name: string; objective: MetaObjective }
): Promise<CreatedAdSet> {
  const q = new URLSearchParams({
    index: String(meta.index),
    name: meta.name,
    objective: meta.objective,
  });
  // One video upload per request — allow up to 4 minutes each.
  return apiPost(`/meta/campaigns/${campaignId}/adsets/create?${q}`, spec, 240_000);
}

/* Activate or pause a campaign + all its ad sets + ads. Activating spends real money. */
export function setMetaCampaignStatus(
  campaignId: string,
  status: "ACTIVE" | "PAUSED"
): Promise<{ campaign_id: string; status: string; ad_sets_updated: number }> {
  return apiPost(`/meta/campaigns/${campaignId}/status`, { status });
}

/* Delete a campaign (and its ad sets + ads). Irreversible. */
export function deleteMetaCampaign(
  campaignId: string
): Promise<{ campaign_id: string; deleted: boolean }> {
  return apiDelete(`/meta/campaigns/${campaignId}`);
}

/* Search Meta's interest catalog for detailed targeting. */
export function searchMetaInterests(q: string): Promise<{ interests: MetaInterest[] }> {
  return apiGet<{ interests: MetaInterest[] }>(`/meta/targeting/interests?q=${encodeURIComponent(q)}`);
}

/* Ad sets under one campaign (status + budget). */
export function getMetaCampaignAdSets(
  campaignId: string
): Promise<MetaListResponse<MetaAdSet>> {
  return apiGet<MetaListResponse<MetaAdSet>>(`/meta/campaigns/${campaignId}/adsets`);
}

export interface MetaAd { id: string; name: string; status: string; effective_status?: string }

export function getMetaAdSetAds(adsetId: string): Promise<MetaListResponse<MetaAd>> {
  return apiGet<MetaListResponse<MetaAd>>(`/meta/adsets/${adsetId}/ads`);
}

/* Activate or pause a single ad set (+ its ads). Activating spends real money. */
export function setMetaAdSetStatus(
  adsetId: string,
  status: "ACTIVE" | "PAUSED"
): Promise<{ ad_set_id: string; status: string; ads_updated: number }> {
  return apiPost(`/meta/adsets/${adsetId}/status`, { status });
}
