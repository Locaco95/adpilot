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
