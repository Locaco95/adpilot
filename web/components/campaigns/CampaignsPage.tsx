"use client";
import { useState } from "react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { TARGET_CPA, TARGET_ROAS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { StatusBadge, TrendArrow, SkeletonGenericPage } from "@/components/ui";
import type { Campaign } from "@/types";

function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "8px 14px", flex: 1, textAlign: "center" }}>
      <div className="text-mono" style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export function CampaignsPage() {
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortBy, setSortBy] = useState<keyof Campaign>("roas");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: campaigns, isLoading, isError, error } = useCampaigns(platformFilter);

  if (isLoading) return <SkeletonGenericPage title="Campaigns" />;
  if (isError) return (
    <div style={{ padding: "24px", color: "var(--danger)" }}>Failed to load: {(error as Error)?.message}</div>
  );

  const filtered = campaigns ?? [];
  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "desc" ? -1 : 1;
    const av = a[sortBy] as number;
    const bv = b[sortBy] as number;
    return mul * (av - bv);
  });

  const handleSort = (col: keyof Campaign) => {
    if (sortBy === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const SortHeader = ({ col, children }: { col: keyof Campaign; children: React.ReactNode }) => (
    <th onClick={() => handleSort(col)} style={{ cursor: "pointer", userSelect: "none" }}>
      {children} {sortBy === col ? (sortDir === "desc" ? "↓" : "↑") : ""}
    </th>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Campaigns</div>
          <div className="page-subtitle">All campaigns across Meta, TikTok, and Snapchat</div>
        </div>
      </div>

      {/* Platform filter */}
      <div className="tab-bar fade-in">
        {[
          { id: "all",      label: "All Platforms" },
          { id: "meta",     label: "Meta" },
          { id: "tiktok",   label: "TikTok" },
          { id: "snapchat", label: "Snapchat" },
        ].map((t) => (
          <button key={t.id} className={`tab-btn ${platformFilter === t.id ? "active" : ""}`}
            onClick={() => setPlatformFilter(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Summary bar */}
      <div className="flex gap-12 mb-16 fade-in fade-in-1" style={{ gap: 12, marginBottom: 16 }}>
        <MiniStat label="Active"  value={filtered.filter((c) => c.status === "active").length}  color="var(--success)" />
        <MiniStat label="Warning" value={filtered.filter((c) => c.status === "warning").length} color="var(--warning)" />
        <MiniStat label="Paused"  value={filtered.filter((c) => c.status === "paused").length}  color="var(--text-tertiary)" />
        <MiniStat label="Avg ROAS"
          value={(filtered.reduce((s, c) => s + (Number(c.roas) || 0), 0) / (filtered.length || 1)).toFixed(2) + "×"}
          color="var(--accent)" />
        <MiniStat label="Avg CPA"
          value={"$" + (filtered.reduce((s, c) => s + (Number(c.cpa) || 0), 0) / (filtered.length || 1)).toFixed(2)}
          color="var(--info)" />
      </div>

      {/* Campaign table */}
      <div className="card fade-in fade-in-2">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 30 }} />
              <th>Campaign</th>
              <th>Status</th>
              <SortHeader col="budget">Budget/d</SortHeader>
              <SortHeader col="spend7d">7d Spend</SortHeader>
              <SortHeader col="conv7d">Conv</SortHeader>
              <SortHeader col="cpa">CPA</SortHeader>
              <SortHeader col="roas">ROAS</SortHeader>
              <SortHeader col="ctr">CTR</SortHeader>
              <SortHeader col="freq">Freq</SortHeader>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.id}>
                <td><span className={`platform-dot ${c.platform}`} /></td>
                <td style={{ maxWidth: 260, fontWeight: 500 }} className="truncate">{c.name}</td>
                <td><StatusBadge status={c.status} /></td>
                <td className="mono">${c.budget}</td>
                <td className="mono">{formatCurrency(c.spend7d)}</td>
                <td className="mono">{c.conv7d}</td>
                <td className="mono" style={{ color: (Number(c.cpa)||0) > TARGET_CPA * 1.5 ? "var(--danger)" : (Number(c.cpa)||0) > TARGET_CPA ? "var(--warning)" : "var(--success)" }}>
                  ${(Number(c.cpa)||0).toFixed(2)}
                </td>
                <td className="mono" style={{ color: (Number(c.roas)||0) >= TARGET_ROAS ? "var(--success)" : (Number(c.roas)||0) >= 1.5 ? "var(--warning)" : "var(--danger)" }}>
                  {(Number(c.roas)||0).toFixed(2)}×
                </td>
                <td className="mono">{(Number(c.ctr)||0).toFixed(1)}%</td>
                <td className="mono" style={{ color: (Number(c.freq)||0) > 6 ? "var(--danger)" : (Number(c.freq)||0) > 4 ? "var(--warning)" : "var(--text-secondary)" }}>
                  {(Number(c.freq)||0).toFixed(1)}
                </td>
                <td><TrendArrow trend={c.trend} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Threshold reference */}
      <div className="flex gap-12 mt-16 fade-in fade-in-3" style={{ gap: 12, marginTop: 20 }}>
        {[
          { label: "Target CPA",  value: `$${TARGET_CPA}`,                             color: "var(--accent)" },
          { label: "Target ROAS", value: `${TARGET_ROAS}×`,                            color: "var(--accent)" },
          { label: "Kill CPA",    value: `$${(TARGET_CPA * 1.8).toFixed(0)}`,          color: "var(--danger)" },
          { label: "Kill ROAS",   value: "0.8×",                                       color: "var(--danger)" },
        ].map((item) => (
          <div key={item.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "10px 14px", flex: 1 }}>
            <span className="text-xs text-tertiary">{item.label}</span>
            <div className="text-mono" style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
