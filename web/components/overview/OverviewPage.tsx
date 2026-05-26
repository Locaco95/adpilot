"use client";
import { useState, useEffect } from "react";
import { useOverviewSummary, useOverviewDaily, useAnomalies } from "@/hooks/useOverview";
import { useCampaigns } from "@/hooks/useCampaigns";
import { TARGET_CPA, TARGET_ROAS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { StatusBadge, TrendArrow, PlatformTag, SkeletonOverview, SyncSpinner } from "@/components/ui";
import type { Anomaly, DailyMetrics, DailyMetricDay, OverviewSummary, Campaign } from "@/types";

/* ── Helpers ─────────────────────────────────────────────── */
function safeNum(n: unknown): number {
  const v = Number(n);
  return isFinite(v) ? v : 0;
}

function formatNum(n: unknown): string {
  const v = safeNum(n);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 10_000) return (v / 1_000).toFixed(1) + "K";
  if (v >= 1_000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

function formatCompact(n: unknown): string {
  const v = safeNum(n);
  if (v >= 1000) return (v / 1000).toFixed(0) + "K";
  return v.toFixed(0);
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.round(diff / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/* ── Sparkline ───────────────────────────────────────────── */
function Sparkline({ data, color = "var(--accent)", height = 28 }: { data: number[]; color?: string; height?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const svgW = 120;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * svgW;
      const y = height - 2 - ((v - min) / range) * (height - 4);
      return `${x},${y}`;
    })
    .join(" ");
  const areaPoints = points + ` ${svgW},${height} 0,${height}`;
  const safeColor = color.replace(/[^a-z0-9]/gi, "");
  return (
    <svg viewBox={`0 0 ${svgW} ${height}`} style={{ width: "100%", height, marginTop: 6, display: "block" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${safeColor}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${safeColor})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── KPI Card ────────────────────────────────────────────── */
function KPICard({
  label, value, delta, prefix = "", suffix = "",
  sparkData, accentColor,
}: {
  label: string; value: number | string | null | undefined; delta: number | null | undefined;
  prefix?: string; suffix?: string; sparkData?: number[]; accentColor?: string;
}) {
  const d = safeNum(delta);
  const deltaClass = d > 0.5 ? "positive" : d < -0.5 ? "negative" : "neutral";
  const arrow = d > 0.5 ? "↑" : d < -0.5 ? "↓" : "→";
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={accentColor ? { color: accentColor } : {}}>
        {prefix}{(value == null) ? "—" : typeof value === "number" ? formatNum(value) : value}{suffix}
      </div>
      <div className={`kpi-delta ${deltaClass}`}>
        {arrow} {Math.abs(d).toFixed(1)}% vs prev 7d
      </div>
      {sparkData && <Sparkline data={sparkData} color={accentColor ?? "var(--accent)"} />}
    </div>
  );
}

/* ── Area Chart ──────────────────────────────────────────── */
function AreaChart({
  data, keys, colors, height = 160,
}: {
  data: Record<string, string | number>[];
  keys: string[];
  colors: string[];
  labels: string[];
  height?: number;
}) {
  const svgW = 500;
  const svgH = height;
  const pad = { top: 8, right: 8, bottom: 24, left: 48 };
  const chartW = svgW - pad.left - pad.right;
  const chartH = svgH - pad.top - pad.bottom;
  const totals = data.map((d) => keys.reduce((s, k) => s + ((d[k] as number) ?? 0), 0));
  const maxVal = (Math.max(...totals) || 1) * 1.1;
  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height }}>
      {yTicks.map((t, i) => {
        const y = pad.top + chartH - (t / maxVal) * chartH;
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={svgW - pad.right} y2={y} stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="3,3" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" fill="var(--text-tertiary)" fontSize="9" fontFamily="var(--font-mono)">
              ${formatCompact(t)}
            </text>
          </g>
        );
      })}
      {keys.map((key, ki) => {
        const prevKeys = keys.slice(0, ki);
        const pts = data.map((d, i) => {
          const x = pad.left + (i / (data.length - 1)) * chartW;
          const base = prevKeys.reduce((s, pk) => s + ((d[pk] as number) ?? 0), 0);
          const val = base + ((d[key] as number) ?? 0);
          const y = pad.top + chartH - (val / maxVal) * chartH;
          return { x, y };
        });
        const basePts = data.map((d, i) => {
          const x = pad.left + (i / (data.length - 1)) * chartW;
          const base = prevKeys.reduce((s, pk) => s + ((d[pk] as number) ?? 0), 0);
          const y = pad.top + chartH - (base / maxVal) * chartH;
          return { x, y };
        }).reverse();
        const allPts = [...pts, ...basePts];
        const pathD = allPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";
        return <path key={key} d={pathD} fill={colors[ki]} opacity={0.7} />;
      })}
      {data.map((d, i) => {
        if (i % 2 !== 0 && data.length > 8) return null;
        const x = pad.left + (i / (data.length - 1)) * chartW;
        return (
          <text key={i} x={x} y={svgH - 4} textAnchor="middle" fill="var(--text-tertiary)" fontSize="9" fontFamily="var(--font-mono)">
            {String(d.label ?? "")}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Donut Chart ─────────────────────────────────────────── */
function DonutChart({
  segments, size = 100, thickness = 14, centerLabel, centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number; thickness?: number; centerLabel?: string; centerValue?: string;
}) {
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dashLen = pct * circumference;
          const dashOff = -offset * circumference;
          offset += pct;
          return (
            <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={seg.color} strokeWidth={thickness}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`} strokeDashoffset={dashOff}
              transform={`rotate(-90 ${c} ${c})`} style={{ transition: "all 0.6s ease" }} />
          );
        })}
        <text x={c} y={c - 5} textAnchor="middle" fill="var(--text-tertiary)" fontSize="9" fontFamily="var(--font-body)">{centerLabel}</text>
        <text x={c} y={c + 10} textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontWeight="700" fontFamily="var(--font-mono)">{centerValue}</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-8" style={{ gap: 8 }}>
            <span className="platform-dot" style={{ background: seg.color }} />
            <span style={{ fontSize: 12 }}>{seg.label}</span>
            <span className="text-mono" style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: "auto" }}>
              {((seg.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── HBar ────────────────────────────────────────────────── */
function HBar({ items, maxValue }: { items: { label: string; value: number; display: string; color: string }[]; maxValue?: number }) {
  const mv = maxValue ?? Math.max(...items.map((i) => i.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{item.label}</span>
            <span className="text-mono" style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.display}</span>
          </div>
          <div style={{ height: 6, background: "var(--bg-surface)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${(item.value / mv) * 100}%`, height: "100%", background: item.color, borderRadius: 3, transition: "width 0.6s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Anomaly Row ─────────────────────────────────────────── */
function AnomalyRow({ anomaly }: { anomaly: Anomaly }) {
  const sevColors: Record<string, { bg: string; color: string }> = {
    critical: { bg: "var(--danger-bg)",  color: "var(--danger)" },
    warning:  { bg: "var(--warning-bg)", color: "var(--warning)" },
    info:     { bg: "var(--info-bg)",    color: "var(--info)" },
  };
  const sev = sevColors[anomaly.severity] ?? sevColors.info;
  return (
    <div style={{ background: sev.bg, border: `1px solid ${sev.color}22`, borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <div className="flex items-center gap-8" style={{ gap: 8 }}>
          <PlatformTag platform={anomaly.platform} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{anomaly.metric}</span>
        </div>
        <span className="text-xs text-tertiary">{timeAgo(anomaly.timestamp)}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{anomaly.detail || anomaly.title}</div>
      <div className="flex items-center gap-8 mt-8" style={{ gap: 12, marginTop: 8 }}>
        <span className="text-mono text-xs">Value: <strong style={{ color: sev.color }}>{anomaly.value}</strong></span>
        <span className="text-mono text-xs">Baseline: {anomaly.baseline}</span>
        <span className="text-mono text-xs">z={safeNum(anomaly.zScore).toFixed(1)}</span>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */
export function OverviewPage() {
  const [selectedWindow, setSelectedWindow] = useState(7);
  const [showWindowMenu, setShowWindowMenu] = useState(false);

  const summaryQ = useOverviewSummary(selectedWindow);
  const dailyQ = useOverviewDaily(selectedWindow);
  const anomaliesQ = useAnomalies("active");
  const campaignsQ = useCampaigns();

  useEffect(() => {
    if (!showWindowMenu) return;
    const handler = () => setShowWindowMenu(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showWindowMenu]);

  if (summaryQ.isLoading || dailyQ.isLoading) return <SkeletonOverview />;
  if (summaryQ.isError || dailyQ.isError) return (
    <div style={{ padding: "24px", color: "var(--danger)" }}>
      Failed to load overview data:{" "}
      {(summaryQ.error ?? dailyQ.error)?.message ?? "Unknown error"}
    </div>
  );
  if (!summaryQ.data || !dailyQ.data) return <SkeletonOverview />;

  const summary: OverviewSummary = summaryQ.data!;
  const daily: DailyMetrics = dailyQ.data ?? [];
  const anomalies: Anomaly[] = anomaliesQ.data ?? [];
  const campaigns: Campaign[] = campaignsQ.data ?? [];

  // Build spark arrays from daily metrics (API returns array of day objects)
  const spendSparkData = daily.map((d: DailyMetricDay) => d.spend.total);
  const convSparkData  = daily.map((d: DailyMetricDay) => d.conversions.total);
  const roasSparkData  = daily.map((d: DailyMetricDay) => d.roas);
  const cpaSparkData   = daily.map((d: DailyMetricDay) => d.cpa);

  // Chart data for stacked area
  const chartData = daily.map((d: DailyMetricDay) => ({
    label: d.label,
    meta: d.spend.meta,
    tiktok: d.spend.tiktok,
    snapchat: d.spend.snapchat,
  }));

  const platformSpendData = [
    { label: "Meta",     value: daily.reduce((s, d) => s + d.spend.meta, 0),     color: "var(--meta)" },
    { label: "TikTok",   value: daily.reduce((s, d) => s + d.spend.tiktok, 0),   color: "var(--tiktok)" },
    { label: "Snapchat", value: daily.reduce((s, d) => s + d.spend.snapchat, 0), color: "var(--snapchat)" },
  ];

  // Compute per-platform average ROAS from campaigns
  const platformRoas = (["meta", "tiktok", "snapchat"] as const).map((p) => {
    const plat = campaigns.filter((c) => c.platform === p);
    const avgRoas = plat.length
      ? plat.reduce((s, c) => s + safeNum(c.roas), 0) / plat.length
      : 0;
    return {
      label: p.charAt(0).toUpperCase() + p.slice(1),
      color: `var(--${p})`,
      value: avgRoas,
      display: safeNum(avgRoas).toFixed(2) + "×",
    };
  });

  const topCampaigns = [...campaigns].sort((a, b) => b.roas - a.roas).slice(0, 6);

  return (
    <div className="content-ready">
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Overview</div>
          <div className="page-subtitle">
            {selectedWindow}-day rolling performance ·{" "}
            {summaryQ.isFetching && <SyncSpinner size={10} />}
            {!summaryQ.isFetching && "Last sync 2 min ago"}
          </div>
        </div>
        <div className="flex gap-8" style={{ gap: 8, alignItems: "center" }}>
          <button className="btn btn-ghost btn-sm">Export</button>
          <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowWindowMenu((v) => !v)}
              style={{ minWidth: 56, display: "flex", alignItems: "center", gap: 4 }}
            >
              {selectedWindow}d ▾
            </button>
            {showWindowMenu && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", right: 0,
                background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)", overflow: "hidden", zIndex: 200,
                boxShadow: "0 4px 16px oklch(0 0 0 / 0.35)", minWidth: 80,
              }}>
                {[7, 14, 30].map((d) => (
                  <button key={d} onClick={() => { setSelectedWindow(d); setShowWindowMenu(false); }}
                    style={{
                      display: "block", width: "100%", padding: "9px 16px",
                      background: selectedWindow === d ? "var(--accent-bg)" : "transparent",
                      color: selectedWindow === d ? "var(--accent)" : "var(--text-primary)",
                      border: "none", cursor: "pointer", fontSize: 13,
                      fontFamily: "var(--font-body)", textAlign: "left",
                      fontWeight: selectedWindow === d ? 700 : 400,
                    }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid fade-in">
        <KPICard label="Total Spend" value={summary.spend} delta={summary.spendDelta} prefix="$" sparkData={spendSparkData} />
        <KPICard label="Conversions" value={summary.conversions} delta={summary.convDelta} sparkData={convSparkData} accentColor="var(--success)" />
        <KPICard label="Revenue" value={summary.revenue} delta={summary.revDelta} prefix="$" accentColor="var(--success)" />
        <KPICard label="Blended ROAS" value={safeNum(summary.roas).toFixed(2)} delta={summary.roasDelta} suffix="×" sparkData={roasSparkData} accentColor="var(--accent)" />
        <KPICard label="Blended CPA" value={safeNum(summary.cpa).toFixed(2)} delta={-safeNum(summary.cpaDelta)} prefix="$" sparkData={cpaSparkData}
          accentColor={safeNum(summary.cpa) > TARGET_CPA ? "var(--danger)" : "var(--success)"} />
      </div>

      {/* Charts row */}
      <div className="grid-2-1 fade-in fade-in-1">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Daily Spend by Platform</span>
            <span className="text-xs text-tertiary">{selectedWindow}-day view</span>
          </div>
          {chartData.length > 0 && (
            <AreaChart data={chartData} keys={["snapchat", "tiktok", "meta"]}
              colors={["var(--snapchat)", "var(--tiktok)", "var(--meta)"]}
              labels={["Snapchat", "TikTok", "Meta"]} height={170} />
          )}
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Spend Distribution</span>
          </div>
          <DonutChart segments={platformSpendData} centerLabel={`${selectedWindow}d total`}
            centerValue={formatCurrency(summary.spend)} size={110} />
        </div>
      </div>

      {/* Anomalies + Platform ROAS */}
      <div className="grid-2 fade-in fade-in-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Active Anomalies</span>
            <span className="badge badge-danger">
              {anomalies.filter((a) => a.severity === "critical").length} critical
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {anomalies.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "20px 0" }}>No active anomalies</div>
            ) : (
              anomalies.map((a) => <AnomalyRow key={a.id} anomaly={a} />)
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Platform ROAS</span>
            <span className="text-xs text-tertiary">7-day</span>
          </div>
          <HBar items={platformRoas} maxValue={4} />
          <div style={{ marginTop: 12, padding: "8px 0", borderTop: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Target ROAS</span>
              <span className="text-mono" style={{ fontSize: 12, color: "var(--accent)" }}>{TARGET_ROAS.toFixed(1)}×</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Campaigns Table */}
      <div className="card fade-in fade-in-3" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Top Campaigns by ROAS</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 30 }} />
              <th>Campaign</th>
              <th>Status</th>
              <th>7d Spend</th>
              <th>Conv</th>
              <th>CPA</th>
              <th>ROAS</th>
              <th>CTR</th>
              <th>Freq</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {topCampaigns.map((c) => (
              <tr key={c.id}>
                <td><span className={`platform-dot ${c.platform}`} /></td>
                <td style={{ maxWidth: 240 }} className="truncate">{c.name}</td>
                <td><StatusBadge status={c.status} /></td>
                <td className="mono">{formatCurrency(c.spend7d)}</td>
                <td className="mono">{c.conv7d}</td>
                <td className="mono" style={{ color: safeNum(c.cpa) > TARGET_CPA ? "var(--danger)" : "var(--success)" }}>${safeNum(c.cpa).toFixed(2)}</td>
                <td className="mono" style={{ color: safeNum(c.roas) >= TARGET_ROAS ? "var(--success)" : safeNum(c.roas) >= 1.5 ? "var(--warning)" : "var(--danger)" }}>{safeNum(c.roas).toFixed(2)}×</td>
                <td className="mono">{(safeNum(c.ctr) * 100).toFixed(2)}%</td>
                <td className="mono">{safeNum(c.freq).toFixed(1)}</td>
                <td><TrendArrow trend={c.trend} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
