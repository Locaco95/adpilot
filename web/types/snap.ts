/* ── AdPilot — Snap Marketing API types ─────────────────────────
 * Shapes returned by /api/v1/snap/* (proxied through the backend).
 * Snap nests every object inside a wrapper with the entity name as the key.
 */

export interface SnapStatus {
  configured: boolean;
  default_ad_account_id: string | null;
}

export interface SnapMe {
  id: string;
  display_name: string;
  email: string;
  organization_id?: string;
}

export interface SnapMeResponse {
  request_status: string;
  me: SnapMe;
}

export interface SnapAdAccount {
  id: string;
  name: string;
  status: string;       // "ACTIVE" | "PENDING" | "PAUSED" | ...
  currency: string;
  timezone: string;
  type?: string;        // "PARTNER" | "DIRECT" ...
}

export interface SnapOrganization {
  id: string;
  name: string;
  country?: string | null;
  ad_accounts?: SnapAdAccount[];
}

export interface SnapOrganizationsResponse {
  request_status: string;
  organizations: { organization: SnapOrganization }[];
}

export interface SnapCampaign {
  id: string;
  name: string;
  ad_account_id: string;
  status: string;
  objective?: string;
  start_time?: string;
  end_time?: string;
  daily_budget_micro?: number;
  buy_model?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SnapCampaignsResponse {
  request_status: string;
  campaigns: { campaign: SnapCampaign }[];
}

export interface SnapAdSquad {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  bid_strategy?: string;
  billing_event?: string;
  optimization_goal?: string;
  daily_budget_micro?: number;
  targeting?: Record<string, unknown>;
}

export interface SnapAdSquadsResponse {
  request_status: string;
  adsquads: { adsquad: SnapAdSquad }[];
}

export interface SnapAd {
  id: string;
  name: string;
  ad_squad_id: string;
  creative_id?: string;
  status: string;
  review_status?: string;
  type?: string;
}

export interface SnapAdsResponse {
  request_status: string;
  ads: { ad: SnapAd }[];
}

export interface SnapCampaignStat {
  id: string;
  type: string;
  granularity: string;
  start_time?: string;
  end_time?: string;
  stats: {
    spend?: number;          // micros
    impressions?: number;
    swipes?: number;
    video_views?: number;
    screen_time_millis?: number;
    quartile_1?: number;
    quartile_2?: number;
    quartile_3?: number;
    view_completion?: number;
  };
}

export interface SnapCampaignStatsResponse {
  request_status: string;
  total_stats?: { total_stat: SnapCampaignStat }[];
  timeseries_stats?: { timeseries_stat: SnapCampaignStat }[];
}
