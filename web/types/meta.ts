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

export type KpiGrade = "Excellent" | "Good" | "Average" | "Below Average" | "Poor";

export interface AuditKpi {
  key: string;
  label: string;
  value: number | null;
  display: string;   // formatted, e.g. "1.20%" or "N/A"
  grade: KpiGrade | null;
}

export interface AuditDimension { name: string; score: number; max: number }

export interface MetaAudit {
  available: boolean;
  date_preset: string;
  message?: string;      // set when available=false
  spend?: number;
  score?: number;        // 0-100
  assessment?: string;
  kpis?: AuditKpi[];
  dimensions?: AuditDimension[];
  recommendations?: { tier1: string[]; tier2: string[]; tier3: string[] };
}

export type MetaObjective =
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_SALES"
  | "OUTCOME_AWARENESS"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_LEADS";

export interface MetaInterest {
  id: string;
  name: string;
  audience?: number;
  path?: string | null;
}

export interface AdCreativeSpec {
  creative_file_id: string;
  destination_url: string;
  headline?: string;
  message?: string;
  call_to_action?: string;
}

export interface AdSetSpec {
  country_code: string;
  daily_budget?: number; // omit in CBO (campaign holds the budget)
  age_min: number;
  age_max: number;
  gender?: number;       // 0=all, 1=men, 2=women
  languages?: number[];  // Meta locale keys, e.g. [28]=Arabic
  interests?: { id: string; name: string }[];
  start_time?: string; // ISO-8601; omit => starts when activated
  end_time?: string;   // ISO-8601; omit => runs until paused
  // Ads under this ad set (media via Google Drive OAuth)
  ads?: AdCreativeSpec[];
}

export interface CreateMetaCampaignRequest {
  name: string;
  objective: MetaObjective;
  campaign_daily_budget?: number; // set => CBO (Meta splits across ad sets)
  ad_sets: AdSetSpec[];
}

export interface CreatedAd {
  ad_id: string;
  creative_id: string;
}

export interface CreatedAdSet {
  ad_set_id: string;
  country_code: string;
  ads?: CreatedAd[];
  // Back-compat: first ad's ids
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
