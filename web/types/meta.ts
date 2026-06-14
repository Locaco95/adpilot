/* ── AdPilot — Meta Marketing API types ────────────────────────── */

export interface MetaStatus {
  configured: boolean;
  ad_account_id: string | null;
}

export interface MetaAccount {
  name?: string;
  account_status?: number; // 1 = ACTIVE
  currency?: string;
  timezone_name?: string;
  amount_spent?: string;
  balance?: string;
  id?: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
}

export interface MetaInsightRow {
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  reach?: string;
}

export interface MetaListResponse<T> {
  data: T[];
  paging?: unknown;
}

export type MetaObjective =
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_SALES"
  | "OUTCOME_AWARENESS"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_LEADS";

export interface CreateMetaCampaignRequest {
  name: string;
  objective: MetaObjective;
  country_code: string;
  daily_budget: number;
  age_min: number;
  age_max: number;
}

export interface CreateMetaCampaignResult {
  campaign_id: string;
  ad_set_id: string;
  status: string;
}
