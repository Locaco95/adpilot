/* ── AdPilot — Snap Marketing API service ──────────────────────── */
import { apiGet, apiPost } from "./api-client";
import type {
  SnapStatus,
  SnapMeResponse,
  SnapOrganizationsResponse,
  SnapCampaignsResponse,
  SnapAdSquadsResponse,
  SnapAdsResponse,
  SnapCampaignStatsResponse,
  CreateCampaignRequest,
  CreateCampaignResult,
} from "@/types/snap";

export function getSnapStatus(): Promise<SnapStatus> {
  return apiGet<SnapStatus>("/snap/status");
}

export function getSnapMe(): Promise<SnapMeResponse> {
  return apiGet<SnapMeResponse>("/snap/me");
}

export function getSnapOrganizations(
  withAdAccounts = true
): Promise<SnapOrganizationsResponse> {
  return apiGet<SnapOrganizationsResponse>(
    `/snap/organizations?with_ad_accounts=${withAdAccounts}`
  );
}

export function getSnapCampaigns(
  adAccountId: string
): Promise<SnapCampaignsResponse> {
  return apiGet<SnapCampaignsResponse>(
    `/snap/adaccounts/${adAccountId}/campaigns`
  );
}

export function getSnapAdSquads(
  adAccountId: string
): Promise<SnapAdSquadsResponse> {
  return apiGet<SnapAdSquadsResponse>(
    `/snap/adaccounts/${adAccountId}/adsquads`
  );
}

export function getSnapAds(adAccountId: string): Promise<SnapAdsResponse> {
  return apiGet<SnapAdsResponse>(`/snap/adaccounts/${adAccountId}/ads`);
}

export function getSnapCampaignStats(
  campaignId: string,
  granularity: "TOTAL" | "DAY" | "HOUR" = "TOTAL",
  fields = "spend,impressions,swipes,video_views"
): Promise<SnapCampaignStatsResponse> {
  return apiGet<SnapCampaignStatsResponse>(
    `/snap/campaigns/${campaignId}/stats?granularity=${granularity}&fields=${fields}`
  );
}

export function createSnapCampaign(
  payload: CreateCampaignRequest
): Promise<CreateCampaignResult> {
  return apiPost<CreateCampaignResult>("/snap/campaigns/create", payload);
}
