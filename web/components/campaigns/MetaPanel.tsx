"use client";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMetaStatus, useMetaAccount, useMetaCampaigns, useMetaInsights, metaKeys } from "@/hooks/useMeta";
import { createMetaCampaign } from "@/services/meta.service";
import type { MetaCampaign, MetaInsightRow, MetaObjective, CreateMetaCampaignResult } from "@/types/meta";

const REGIONS: { code: string; label: string }[] = [
  { code: "SA", label: "Saudi Arabia" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "EG", label: "Egypt" },
  { code: "KW", label: "Kuwait" },
  { code: "QA", label: "Qatar" },
  { code: "BH", label: "Bahrain" },
  { code: "OM", label: "Oman" },
];

const OBJECTIVES: { value: MetaObjective; label: string }[] = [
  { value: "OUTCOME_TRAFFIC", label: "Traffic (link clicks)" },
  { value: "OUTCOME_SALES", label: "Sales (conversions)" },
  { value: "OUTCOME_AWARENESS", label: "Awareness (reach)" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement" },
  { value: "OUTCOME_LEADS", label: "Leads" },
];

function CreateMetaCampaignForm({ currency, onDone }: { currency: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [objective, setObjective] = useState<MetaObjective>("OUTCOME_TRAFFIC");
  const [country, setCountry] = useState("SA");
  const [budget, setBudget] = useState("100");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateMetaCampaignResult | null>(null);

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)", padding: "8px 10px", color: "var(--text-primary)",
    fontSize: 13, outline: "none",
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, display: "block", fontWeight: 600 };

  async function submit() {
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    const b = Number(budget);
    if (!b || b <= 0) { setError("Enter a daily budget."); return; }
    setSubmitting(true);
    try {
      const res = await createMetaCampaign({
        name: name.trim(), objective, country_code: country,
        daily_budget: b, age_min: 18, age_max: 65,
      });
      setResult(res);
      qc.invalidateQueries({ queryKey: metaKeys.campaigns() });
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--success)", marginBottom: 8 }}>✓ Campaign created (PAUSED)</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", lineHeight: 1.7 }}>
          <div>campaign: {result.campaign_id}</div>
          <div>ad set: {result.ad_set_id}</div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>
          Created paused — activate it in Ads Manager (needs an ad + payment method to spend).
        </div>
        <button onClick={onDone} style={{ ...inputStyle, width: "auto", marginTop: 12, cursor: "pointer", fontWeight: 600 }}>Done</button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Create Meta Campaign</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Campaign name</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. KSA Summer Sale" />
        </div>
        <div>
          <label style={labelStyle}>Objective</label>
          <select style={inputStyle} value={objective} onChange={(e) => setObjective(e.target.value as MetaObjective)}>
            {OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Region</label>
          <select style={inputStyle} value={country} onChange={(e) => setCountry(e.target.value)}>
            {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Daily budget ({currency})</label>
          <input style={inputStyle} type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", fontSize: 11, color: "var(--text-tertiary)" }}>
          Targets ages 18–65 · created PAUSED
        </div>
      </div>

      {error && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 10 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={submit} disabled={submitting}
          style={{ ...inputStyle, width: "auto", cursor: submitting ? "default" : "pointer", fontWeight: 600,
            background: "var(--accent)", color: "var(--text-inverse)", border: "none", opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "Creating…" : "Create (paused)"}
        </button>
        <button onClick={onDone} disabled={submitting}
          style={{ ...inputStyle, width: "auto", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
      </div>
    </div>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color, background: `${color}18`,
      padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.04em",
    }}>{label}</span>
  );
}

/* Meta returns budgets as minor units (cents) in a string. */
function centsToCurrency(s: string | undefined, currency = "USD"): string {
  if (!s) return "—";
  const v = Number(s) / 100;
  if (Number.isNaN(v)) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

export function MetaPanel() {
  const { data: status, isLoading: statusLoading } = useMetaStatus();
  const connected = !!status?.configured;
  const [showCreate, setShowCreate] = useState(false);

  const { data: account } = useMetaAccount(connected);
  const { data: campaignsResp, isLoading: campaignsLoading, isError, error } = useMetaCampaigns(connected);
  const { data: insightsResp } = useMetaInsights("campaign", "last_7d", connected);

  const currency = account?.currency ?? "USD";
  const campaigns = useMemo<MetaCampaign[]>(() => campaignsResp?.data ?? [], [campaignsResp]);
  const insights = useMemo<Record<string, MetaInsightRow>>(() => {
    const map: Record<string, MetaInsightRow> = {};
    for (const row of insightsResp?.data ?? []) {
      if (row.campaign_name) map[row.campaign_name] = row;
    }
    return map;
  }, [insightsResp]);

  if (statusLoading) {
    return <div className="card fade-in" style={{ padding: 24, color: "var(--text-secondary)" }}>Checking Meta connection…</div>;
  }

  if (!connected) {
    return (
      <div className="card fade-in" style={{ padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Meta not connected</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Set <code>META_ACCESS_TOKEN</code> and <code>META_AD_ACCOUNT_ID</code> on the backend to connect.
        </div>
      </div>
    );
  }

  const acctActive = account?.account_status === 1;

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Connection / account card */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{account?.name ?? "Meta Ad Account"}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
              {status?.ad_account_id}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatusPill
              label={acctActive ? "Active" : `Status ${account?.account_status ?? "?"}`}
              color={acctActive ? "var(--success)" : "var(--warning)"}
            />
            <button onClick={() => setShowCreate((v) => !v)}
              style={{ background: "var(--accent)", color: "var(--text-inverse)", border: "none",
                borderRadius: "var(--radius-sm)", padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {showCreate ? "Close" : "+ Create Campaign"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
          <div><div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Currency</div><div style={{ fontWeight: 600 }}>{currency}</div></div>
          <div><div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Timezone</div><div style={{ fontWeight: 600 }}>{account?.timezone_name ?? "—"}</div></div>
          <div><div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Spent (lifetime)</div><div style={{ fontWeight: 600 }}>{centsToCurrency(account?.amount_spent, currency)}</div></div>
        </div>
      </div>

      {showCreate && (
        <CreateMetaCampaignForm currency={currency} onDone={() => setShowCreate(false)} />
      )}

      {/* Campaigns + 7d insights */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }}>Campaigns</span>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Spend/clicks = last 7 days</span>
        </div>

        {campaignsLoading ? (
          <div style={{ padding: 24, color: "var(--text-secondary)" }}>Loading campaigns…</div>
        ) : isError ? (
          <div style={{ padding: 24, color: "var(--danger)" }}>Failed to load: {(error as Error)?.message}</div>
        ) : campaigns.length === 0 ? (
          <div style={{ padding: 24, color: "var(--text-secondary)" }}>No campaigns on this account yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-name">Campaign</th>
                <th style={{ width: 90 }}>Status</th>
                <th className="col-hide-mobile" style={{ width: 110 }}>Objective</th>
                <th className="col-hide-mobile" style={{ width: 90 }}>Budget/d</th>
                <th style={{ width: 90 }}>7d Spend</th>
                <th className="col-hide-mobile" style={{ width: 70 }}>Clicks</th>
                <th className="col-hide-mobile" style={{ width: 64 }}>CTR</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const ins = insights[c.name];
                const active = c.status === "ACTIVE";
                return (
                  <tr key={c.id}>
                    <td className="col-name">{c.name}</td>
                    <td><StatusPill label={c.status} color={active ? "var(--success)" : "var(--text-tertiary)"} /></td>
                    <td className="col-hide-mobile" style={{ fontSize: 12 }}>{c.objective ?? "—"}</td>
                    <td className="col-hide-mobile">{centsToCurrency(c.daily_budget, currency)}</td>
                    <td>{ins?.spend ? `${Number(ins.spend).toFixed(2)} ${currency}` : "—"}</td>
                    <td className="col-hide-mobile">{ins?.clicks ?? "—"}</td>
                    <td className="col-hide-mobile">{ins?.ctr ? `${Number(ins.ctr).toFixed(2)}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
