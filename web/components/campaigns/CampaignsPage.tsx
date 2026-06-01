"use client";
import React, { useState } from "react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { TARGET_CPA, TARGET_ROAS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { StatusBadge, TrendArrow, SkeletonGenericPage } from "@/components/ui";
import type { Campaign } from "@/types";
import { SnapchatPanel } from "./SnapchatPanel";

function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "10px 14px", flex: 1, textAlign: "center" }}>
      <div className="text-mono" style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export function CampaignsPage() {
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortBy, setSortBy] = useState<keyof Campaign>("roas");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const isSnap = platformFilter === "snapchat";
  const { data: campaigns, isLoading, isError, error } = useCampaigns(platformFilter);

  if (!isSnap && isLoading) return <SkeletonGenericPage title="Campaigns" />;
  if (!isSnap && isError) return (
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

      {/* Snapchat tab: swap to live API data instead of the seeded DB table */}
      {platformFilter === "snapchat" ? (
        <SnapchatPanel />
      ) : (
      <>
      {/* Summary bar */}
      <div className="stat-strip fade-in fade-in-1" style={{ marginBottom: 16 }}>
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
        <table className="data-table data-table-expandable">
          <thead>
            <tr>
              <th style={{ width: 30 }} />
              <th>Campaign</th>
              <th className="col-hide-mobile" style={{ width: 80 }}>Status</th>
              <th className="col-hide-mobile" style={{ width: 76, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("budget")}>Budget/d {sortBy === "budget" ? (sortDir === "desc" ? "↓" : "↑") : ""}</th>
              <th className="col-hide-mobile" style={{ width: 76, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("spend7d")}>7d Spend {sortBy === "spend7d" ? (sortDir === "desc" ? "↓" : "↑") : ""}</th>
              <th className="col-hide-mobile" style={{ width: 52, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("conv7d")}>Conv {sortBy === "conv7d" ? (sortDir === "desc" ? "↓" : "↑") : ""}</th>
              <th className="col-hide-mobile" style={{ width: 68, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("cpa")}>CPA {sortBy === "cpa" ? (sortDir === "desc" ? "↓" : "↑") : ""}</th>
              <th style={{ width: 68, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("roas")}>ROAS {sortBy === "roas" ? (sortDir === "desc" ? "↓" : "↑") : ""}</th>
              <th className="col-hide-mobile" style={{ width: 52 }}>CTR</th>
              <th className="col-hide-mobile" style={{ width: 48 }}>Freq</th>
              <th className="col-hide-mobile" style={{ width: 52 }}>Trend</th>
              <th className="col-expand-indicator" style={{ width: 28 }} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const isExpanded = expandedRow === c.id;
              const cpaColor = (Number(c.cpa)||0) > TARGET_CPA * 1.5 ? "var(--danger)" : (Number(c.cpa)||0) > TARGET_CPA ? "var(--warning)" : "var(--success)";
              const roasColor = (Number(c.roas)||0) >= TARGET_ROAS ? "var(--success)" : (Number(c.roas)||0) >= 1.5 ? "var(--warning)" : "var(--danger)";
              const freqColor = (Number(c.freq)||0) > 6 ? "var(--danger)" : (Number(c.freq)||0) > 4 ? "var(--warning)" : "var(--text-secondary)";
              return (
                <React.Fragment key={c.id}>
                  <tr className="row-expandable" onClick={() => setExpandedRow(isExpanded ? null : c.id)}>
                    <td><span className={`platform-dot ${c.platform}`} /></td>
                    <td style={{ maxWidth: 240 }}>
                      <span className="truncate" style={{ fontWeight: 500, display: "block" }}>{c.name}</span>
                      <span className="mobile-row-sub" style={{ fontSize: 11, color: roasColor, fontFamily: "var(--font-mono)" }}>
                        {(Number(c.roas)||0).toFixed(2)}× ROAS
                      </span>
                    </td>
                    <td className="col-hide-mobile"><StatusBadge status={c.status} /></td>
                    <td className="mono col-hide-mobile">${c.budget}</td>
                    <td className="mono col-hide-mobile">{formatCurrency(c.spend7d)}</td>
                    <td className="mono col-hide-mobile">{c.conv7d}</td>
                    <td className="mono col-hide-mobile" style={{ color: cpaColor }}>${(Number(c.cpa)||0).toFixed(2)}</td>
                    <td className="mono" style={{ color: roasColor }}>{(Number(c.roas)||0).toFixed(2)}×</td>
                    <td className="mono col-hide-mobile">{((Number(c.ctr)||0) * 100).toFixed(2)}%</td>
                    <td className="mono col-hide-mobile" style={{ color: freqColor }}>{(Number(c.freq)||0).toFixed(1)}</td>
                    <td className="col-hide-mobile"><TrendArrow trend={c.trend} /></td>
                    <td className="col-expand-indicator">
                      <span style={{ color: "var(--text-tertiary)", fontSize: 12, display: "inline-block", transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "none" }}>›</span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="row-detail-row">
                      <td colSpan={12} className="row-detail-cell">
                        <div className="row-detail-panel">
                          <div className="row-detail-item">
                            <span className="row-detail-label">Status</span>
                            <span className="row-detail-value" style={{ fontSize: 12 }}><StatusBadge status={c.status} /></span>
                          </div>
                          <div className="row-detail-item">
                            <span className="row-detail-label">Budget/d</span>
                            <span className="row-detail-value">${c.budget}</span>
                          </div>
                          <div className="row-detail-item">
                            <span className="row-detail-label">7d Spend</span>
                            <span className="row-detail-value">{formatCurrency(c.spend7d)}</span>
                          </div>
                          <div className="row-detail-item">
                            <span className="row-detail-label">Conv</span>
                            <span className="row-detail-value">{c.conv7d}</span>
                          </div>
                          <div className="row-detail-item">
                            <span className="row-detail-label">CPA</span>
                            <span className="row-detail-value" style={{ color: cpaColor }}>${(Number(c.cpa)||0).toFixed(2)}</span>
                          </div>
                          <div className="row-detail-item">
                            <span className="row-detail-label">CTR</span>
                            <span className="row-detail-value">{((Number(c.ctr)||0) * 100).toFixed(2)}%</span>
                          </div>
                          <div className="row-detail-item">
                            <span className="row-detail-label">Freq</span>
                            <span className="row-detail-value" style={{ color: freqColor }}>{(Number(c.freq)||0).toFixed(1)}</span>
                          </div>
                          <div className="row-detail-item">
                            <span className="row-detail-label">Trend</span>
                            <span className="row-detail-value"><TrendArrow trend={c.trend} /></span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Threshold reference */}
      <div className="stat-strip stat-strip-4 fade-in fade-in-3" style={{ marginTop: 16, marginBottom: 24 }}>
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
      </>
      )}
    </div>
  );
}
