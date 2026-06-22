/* ── AdPilot — Meta Marketing API service ──────────────────────── */
import { apiGet, apiPost } from "./api-client";
import type {
  MetaStatus,
  MetaAccount,
  MetaCampaign,
  MetaInsightRow,
  MetaListResponse,
  CreateMetaCampaignRequest,
  CreateMetaCampaignResult,
} from "@/types/meta";

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
  return apiPost<CreateMetaCampaignResult>("/meta/campaigns/create", payload);
}

/* Activate or pause a campaign + all its ad sets + ads. Activating spends real money. */
export function setMetaCampaignStatus(
  campaignId: string,
  status: "ACTIVE" | "PAUSED"
): Promise<{ campaign_id: string; status: string; ad_sets_updated: number }> {
  return apiPost(`/meta/campaigns/${campaignId}/status`, { status });
}
