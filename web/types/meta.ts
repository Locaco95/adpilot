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
  funding_source_details?: {
    id?: string;
    type?: number;
    display_string?: string; // e.g. "Available balance (EGP1,000.00)"
  };
  id?: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  effective_status?: string; // true delivery state (ACTIVE only if ad set + ad also active)
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  daily_budget?: string;
  optimization_goal?: string;
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

export interface AdSetSpec {
  country_code: string;
  daily_budget?: number; // omit in CBO (campaign holds the budget)
  age_min: number;
  age_max: number;
  start_time?: string; // ISO-8601; omit => starts when activated
  end_time?: string;   // ISO-8601; omit => runs until paused
  // Optional creative/ad layer (media via Google Drive OAuth)
  creative_file_id?: string;
  destination_url?: string;
  headline?: string;
  message?: string;
  call_to_action?: string;
}

export interface CreateMetaCampaignRequest {
  name: string;
  objective: MetaObjective;
  campaign_daily_budget?: number; // set => CBO (Meta splits across ad sets)
  ad_sets: AdSetSpec[];
}

export interface CreatedAdSet {
  ad_set_id: string;
  country_code: string;
  creative_id?: string | null;
  ad_id?: string | null;
}

export interface CreateMetaCampaignResult {
  campaign_id: string;
  status: string;
  ad_sets: CreatedAdSet[];
  // Back-compat: first ad set's ids
  ad_set_id?: string | null;
  creative_id?: string | null;
  ad_id?: string | null;
}
