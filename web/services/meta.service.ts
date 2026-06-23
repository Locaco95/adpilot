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
  // Video creatives are downloaded from Drive + uploaded to Meta server-side,
  // which can take well over the default 15s — allow up to 5 minutes.
  return apiPost<CreateMetaCampaignResult>("/meta/campaigns/create", payload, 300_000);
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

/* Activate or pause a single ad set (+ its ads). Activating spends real money. */
export function setMetaAdSetStatus(
  adsetId: string,
  status: "ACTIVE" | "PAUSED"
): Promise<{ ad_set_id: string; status: string; ads_updated: number }> {
  return apiPost(`/meta/adsets/${adsetId}/status`, { status });
}
