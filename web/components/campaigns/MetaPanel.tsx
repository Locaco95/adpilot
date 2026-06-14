"use client";
import { useMemo } from "react";
import { useMetaStatus, useMetaAccount, useMetaCampaigns, useMetaInsights } from "@/hooks/useMeta";
import type { MetaCampaign, MetaInsightRow } from "@/types/meta";

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
          <StatusPill
            label={acctActive ? "Active" : `Status ${account?.account_status ?? "?"}`}
            color={acctActive ? "var(--success)" : "var(--warning)"}
          />
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
          <div><div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Currency</div><div style={{ fontWeight: 600 }}>{currency}</div></div>
          <div><div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Timezone</div><div style={{ fontWeight: 600 }}>{account?.timezone_name ?? "—"}</div></div>
          <div><div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Spent (lifetime)</div><div style={{ fontWeight: 600 }}>{centsToCurrency(account?.amount_spent, currency)}</div></div>
        </div>
      </div>

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
