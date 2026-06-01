"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useOverviewSummary, useOverviewDaily, useAnomalies } from "@/hooks/useOverview";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useActions } from "@/hooks/useActions";
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
  if (v >= 10_000)    return (v / 1_000).toFixed(1) + "K";
  if (v >= 1_000)     return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 100)       return v.toFixed(0);
  if (v >= 10)        return v.toFixed(1);
  return v.toFixed(2);
}
function formatCompact(n: unknown): string {
  const v = safeNum(n);
  if (v >= 1000) return (v / 1000).toFixed(0) + "K";
  return v.toFixed(0);
}
function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)  return "just now";
  const mins = Math.floor(diff / 60);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/* ── CSV Export ──────────────────────────────────────────── */
function exportCampaignsCSV(campaigns: Campaign[], windowDays: number) {
  const headers = ["Campaign", "Platform", "Status", `${windowDays}d Spend`, "Conversions", "CPA", "ROAS", "CTR %", "Frequency", "Trend"];
  const rows = campaigns.map((c) => [
    `"${c.name.replace(/"/g, '""')}"`,
    c.platform, c.status,
    safeNum(c.spend7d).toFixed(2),
    c.conv7d,
    safeNum(c.cpa).toFixed(2),
    safeNum(c.roas).toFixed(3),
    (safeNum(c.ctr) * 100).toFixed(2),
    safeNum(c.freq).toFixed(1),
    c.trend,
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `adpilot-campaigns-${windowDays}d-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Insight Chip ────────────────────────────────────────── */
type InsightType = "danger" | "warning" | "success" | "info";
function InsightChip({ type, text }: { type: InsightType; text: string }) {
  const p: Record<InsightType, { bg: string; color: string; icon: string }> = {
    danger:  { bg: "var(--danger-bg)",  color: "var(--danger)",  icon: "▲" },
    warning: { bg: "var(--warning-bg)", color: "var(--warning)", icon: "△" },
    success: { bg: "var(--success-bg)", color: "var(--success)", icon: "↑" },
    info:    { bg: "var(--info-bg)",    color: "var(--info)",    icon: "·" },
  };
  const { bg, color, icon } = p[type];
  return (
    <div className="insight-chip" style={{
      background: bg, color,
      border: `1px solid ${color}35`,
      borderRadius: "var(--radius-sm)",
      padding: "5px 10px",
      fontSize: 12, fontWeight: 500,
      display: "inline-flex", alignItems: "center", gap: 5,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 9, lineHeight: 1 }}>{icon}</span>
      {text}
    </div>
  );
}

/* ── Sparkline ───────────────────────────────────────────── */
function Sparkline({ data, color = "var(--accent)", height = 40 }: {
  data: number[]; color?: string; height?: number;
}) {
  const gradId = useRef(`sg-${Math.random().toString(36).slice(2, 8)}`).current;
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
  return (
    <svg viewBox={`0 0 ${svgW} ${height}`} style={{ width: "100%", height, marginTop: 6, display: "block" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── KPI Card ────────────────────────────────────────────── */
function KPICard({
  label, value, delta, prefix = "", suffix = "", sparkData, accentColor,
}: {
  label: string; value: number | string | null | undefined; delta: number | null | undefined;
  prefix?: string; suffix?: string; sparkData?: number[]; accentColor?: string;
}) {
  const d = safeNum(delta);
  const isNeutral = Math.abs(d) <= 0.5;
  const deltaClass = isNeutral ? "neutral" : d > 0 ? "positive" : "negative";
  const arrow = isNeutral ? null : d > 0 ? "↑" : "↓";
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={accentColor ? { color: accentColor } : {}}>
        {prefix}{value == null ? "—" : typeof value === "number" ? formatNum(value) : value}{suffix}
      </div>
      <div className={`kpi-delta ${deltaClass}`}>
        {isNeutral ? "—" : `${arrow} ${Math.abs(d).toFixed(1)}%`}
      </div>
      {sparkData
        ? <Sparkline data={sparkData} color={accentColor ?? "var(--accent)"} />
        : <div style={{ height: 46 }} />
      }
    </div>
  );
}

/* ── Area Chart ──────────────────────────────────────────── */
type TooltipState = { col: number; pct: number } | null;

function AreaChart({ data, keys, colors, height = 160 }: {
  data: Record<string, string | number>[];
  keys: string[];
  colors: string[];
  labels: string[];
  height?: number;
}) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const svgW = 500;
  const pad = { top: 8, right: 8, bottom: 24, left: 48 };
  const chartW = svgW - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const totals = data.map((d) => keys.reduce((s, k) => s + ((d[k] as number) ?? 0), 0));
  const maxVal = (Math.max(...totals) || 1) * 1.1;
  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];
  const keyLabels: Record<string, string> = { meta: "Meta", tiktok: "TikTok", snapchat: "Snapchat" };

  function getColFromClientX(clientX: number): TooltipState {
    const svg = svgRef.current;
    if (!svg || data.length < 2) return null;
    const rect = svg.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    const chartX = relX * svgW - pad.left;
    if (chartX < 0 || chartX > chartW) return null;
    const col = Math.max(0, Math.min(data.length - 1, Math.round((chartX / chartW) * (data.length - 1))));
    return { col, pct: relX };
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    setTooltip(getColFromClientX(e.clientX));
  }

  function handleTouchStart(e: React.TouchEvent<SVGSVGElement>) {
    clearTimeout(touchTimer.current);
    const touch = e.touches[0];
    if (touch) setTooltip(getColFromClientX(touch.clientX));
  }

  function handleTouchEnd() {
    touchTimer.current = setTimeout(() => setTooltip(null), 1800);
  }

  const hoveredX = tooltip != null ? pad.left + (tooltip.col / (data.length - 1)) * chartW : null;

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} viewBox={`0 0 ${svgW} ${height}`}
        style={{ width: "100%", height, cursor: "crosshair" }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

        {/* Grid lines */}
        {yTicks.map((t, i) => {
          const y = pad.top + chartH - (t / maxVal) * chartH;
          return (
            <g key={i}>
              <line x1={pad.left} y1={y} x2={svgW - pad.right} y2={y}
                stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={pad.left - 6} y={y + 3} textAnchor="end"
                fill="var(--text-tertiary)" fontSize="9" fontFamily="var(--font-mono)">
                ${formatCompact(t)}
              </text>
            </g>
          );
        })}

        {/* Stacked areas */}
        {keys.map((key, ki) => {
          const prevKeys = keys.slice(0, ki);
          const pts = data.map((d, i) => {
            const x = pad.left + (i / (data.length - 1)) * chartW;
            const base = prevKeys.reduce((s, pk) => s + ((d[pk] as number) ?? 0), 0);
            const val = base + ((d[key] as number) ?? 0);
            return { x, y: pad.top + chartH - (val / maxVal) * chartH };
          });
          const basePts = data.map((d, i) => {
            const x = pad.left + (i / (data.length - 1)) * chartW;
            const base = prevKeys.reduce((s, pk) => s + ((d[pk] as number) ?? 0), 0);
            return { x, y: pad.top + chartH - (base / maxVal) * chartH };
          }).reverse();
          const pathD = [...pts, ...basePts].map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";
          return <path key={key} d={pathD} fill={colors[ki]} opacity={0.7} />;
        })}

        {/* X-axis labels */}
        {data.map((d, i) => {
          if (i % 2 !== 0 && data.length > 8) return null;
          const x = pad.left + (i / (data.length - 1)) * chartW;
          return (
            <text key={i} x={x} y={height - 4} textAnchor="middle"
              fill="var(--text-tertiary)" fontSize="9" fontFamily="var(--font-mono)">
              {String(d.label ?? "")}
            </text>
          );
        })}

        {/* Hover vertical line */}
        {hoveredX != null && (
          <line x1={hoveredX} y1={pad.top} x2={hoveredX} y2={height - pad.bottom}
            stroke="var(--border-default)" strokeWidth="1" strokeDasharray="4,3" />
        )}

        {/* Hover dots */}
        {hoveredX != null && tooltip != null && keys.map((key, ki) => {
          const d = data[tooltip.col];
          const prevKeys = keys.slice(0, ki);
          const base = prevKeys.reduce((s, pk) => s + ((d[pk] as number) ?? 0), 0);
          const val = base + ((d[key] as number) ?? 0);
          const y = pad.top + chartH - (val / maxVal) * chartH;
          return <circle key={key} cx={hoveredX} cy={y} r={3.5}
            fill={colors[ki]} stroke="var(--bg-card)" strokeWidth="1.5" />;
        })}
      </svg>

      {/* Tooltip */}
      {tooltip != null && (
        <div style={{
          position: "absolute", top: 4, zIndex: 10, pointerEvents: "none",
          left: `clamp(4px, calc(${tooltip.pct * 100}% - 70px), calc(100% - 148px))`,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-sm)",
          padding: "8px 10px", minWidth: 140,
          fontSize: 12, fontFamily: "var(--font-mono)",
          boxShadow: "0 4px 16px oklch(0 0 0 / 0.4)",
        }}>
          <div style={{ color: "var(--text-tertiary)", marginBottom: 6, fontSize: 11 }}>
            {String(data[tooltip.col].label ?? "")}
          </div>
          {keys.map((key, ki) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: colors[ki], display: "inline-block", flexShrink: 0 }} />
              <span style={{ color: "var(--text-secondary)" }}>{keyLabels[key] ?? key}</span>
              <span style={{ marginLeft: "auto", paddingLeft: 10, color: "var(--text-primary)" }}>
                ${formatCompact(data[tooltip.col][key] as number)}
              </span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 5, paddingTop: 5, display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ color: "var(--text-tertiary)" }}>Total</span>
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>
              ${formatCompact(keys.reduce((s, k) => s + ((data[tooltip.col][k] as number) ?? 0), 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Donut Chart ─────────────────────────────────────────── */
function DonutChart({ segments, size = 100, thickness = 14, centerLabel, centerValue }: {
  segments: { label: string; value: number; color: string }[];
  size?: number; thickness?: number; centerLabel?: string; centerValue?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let offset = 0;

  const active = hovered !== null ? segments[hovered] : null;
  const displayLabel = active ? active.label : centerLabel;
  const displayValue = active ? formatCurrency(active.value) : centerValue;
  const displayColor = active ? active.color : "var(--text-primary)";

  return (
    <div className="donut-layout">
      <svg width={size} height={size} style={{ flexShrink: 0, cursor: "default" }}>
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dashLen = pct * circumference;
          const dashOff = -offset * circumference;
          offset += pct;
          return (
            <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={seg.color}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOff}
              transform={`rotate(-90 ${c} ${c})`}
              style={{
                transition: "opacity 0.15s, stroke-width 0.15s",
                cursor: "pointer",
                opacity: hovered !== null && hovered !== i ? 0.4 : 1,
                strokeWidth: hovered === i ? thickness + 2 : thickness,
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={(e) => { e.stopPropagation(); setHovered(hovered === i ? null : i); }}
            />
          );
        })}
        <text x={c} y={c - 5} textAnchor="middle" fill="var(--text-tertiary)" fontSize="9" fontFamily="var(--font-body)">{displayLabel}</text>
        <text x={c} y={c + 10} textAnchor="middle" fill={displayColor} fontSize="14" fontWeight="700" fontFamily="var(--font-mono)">{displayValue}</text>
      </svg>
      <div className="donut-legend">
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
            opacity: hovered !== null && hovered !== i ? 0.4 : 1, transition: "opacity 0.15s" }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            onTouchStart={(e) => { e.stopPropagation(); setHovered(hovered === i ? null : i); }}>
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

  // All hooks before any conditional returns
  const summaryQ   = useOverviewSummary(selectedWindow);
  const dailyQ     = useOverviewDaily(selectedWindow);
  const anomaliesQ = useAnomalies("active");
  const campaignsQ = useCampaigns();
  const actionsQ   = useActions("pending");

  useEffect(() => {
    if (!showWindowMenu) return;
    const handler = () => setShowWindowMenu(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showWindowMenu]);

  // Safe defaults (used in useMemo before conditionals)
  const anomalies      = anomaliesQ.data ?? [];
  const campaigns      = campaignsQ.data ?? [];
  const pendingActions = actionsQ.data ?? [];
  const summary        = summaryQ.data ?? ({} as OverviewSummary);

  const criticalCount = anomalies.filter((a) => a.severity === "critical").length;
  const warningCount  = anomalies.filter((a) => a.severity === "warning").length;

  const insights = useMemo((): { type: InsightType; text: string }[] => {
    if (!summaryQ.data) return [];
    const list: { type: InsightType; text: string }[] = [];
    if (pendingActions.length > 0)
      list.push({ type: "danger", text: `${pendingActions.length} action${pendingActions.length > 1 ? "s" : ""} pending approval` });
    if (criticalCount > 0)
      list.push({ type: "danger", text: `${criticalCount} critical anomal${criticalCount > 1 ? "ies" : "y"}` });
    else if (warningCount > 0)
      list.push({ type: "warning", text: `${warningCount} warning${warningCount > 1 ? "s" : ""} detected` });
    if (safeNum(summary.cpa) > TARGET_CPA * 1.8)
      list.push({ type: "danger", text: `CPA at kill threshold — $${safeNum(summary.cpa).toFixed(0)}` });
    else if (safeNum(summary.cpa) > TARGET_CPA)
      list.push({ type: "warning", text: `CPA above target — $${safeNum(summary.cpa).toFixed(0)}` });
    if (safeNum(summary.roas) >= TARGET_ROAS * 1.3)
      list.push({ type: "success", text: `ROAS ${safeNum(summary.roas).toFixed(2)}× — consider scaling` });
    return list;
  }, [pendingActions, criticalCount, warningCount, summary, summaryQ.data]);

  // Early returns after all hooks
  if (summaryQ.isLoading || dailyQ.isLoading) return <SkeletonOverview />;
  if (summaryQ.isError || dailyQ.isError) return (
    <div style={{ padding: "24px", color: "var(--danger)" }}>
      Failed to load overview data:{" "}
      {(summaryQ.error ?? dailyQ.error)?.message ?? "Unknown error"}
    </div>
  );
  if (!summaryQ.data || !dailyQ.data) return <SkeletonOverview />;

  const daily: DailyMetrics = dailyQ.data ?? [];

  // Dynamic sync timestamp from TanStack Query
  const lastSyncText = summaryQ.dataUpdatedAt
    ? timeAgo(new Date(summaryQ.dataUpdatedAt).toISOString())
    : "—";

  // Spark arrays
  const spendSparkData = daily.map((d: DailyMetricDay) => d.spend.total);
  const convSparkData  = daily.map((d: DailyMetricDay) => d.conversions.total);
  const roasSparkData  = daily.map((d: DailyMetricDay) => d.roas);
  const cpaSparkData   = daily.map((d: DailyMetricDay) => d.cpa);

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

  const platformRoas = (["meta", "tiktok", "snapchat"] as const).map((p) => {
    const plat = campaigns.filter((c) => c.platform === p);
    const avgRoas = plat.length ? plat.reduce((s, c) => s + safeNum(c.roas), 0) / plat.length : 0;
    return { label: p.charAt(0).toUpperCase() + p.slice(1), color: `var(--${p})`, value: avgRoas, display: avgRoas.toFixed(2) + "×" };
  });

  const topCampaigns = [...campaigns].sort((a, b) => safeNum(b.roas) - safeNum(a.roas)).slice(0, 6);

  return (
    <div className="content-ready">

      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Overview</div>
          <div className="page-subtitle">
            {selectedWindow}-day rolling performance ·{" "}
            {summaryQ.isFetching
              ? <SyncSpinner size={10} />
              : <span>Synced {lastSyncText}</span>
            }
          </div>
        </div>
        <div className="flex gap-8" style={{ gap: 8, alignItems: "center" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => exportCampaignsCSV(campaigns, selectedWindow)}>
            Export CSV
          </button>
          <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-ghost btn-sm"
              onClick={() => setShowWindowMenu((v) => !v)}
              style={{ minWidth: 56, display: "flex", alignItems: "center", gap: 4 }}>
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
                    }}>
                    {d}d
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase 3 — Needs Attention / Insights strip */}
      {insights.length > 0 && (
        <div className="insights-strip fade-in">
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginRight: 2, whiteSpace: "nowrap" }}>
            Needs attention
          </span>
          {insights.map((ins, i) => <InsightChip key={i} type={ins.type} text={ins.text} />)}
        </div>
      )}

      {/* KPI Grid */}
      <div className="kpi-grid fade-in">
        <KPICard label="Total Spend"  value={summary.spend}                     delta={summary.spendDelta}         prefix="$" sparkData={spendSparkData} />
        <KPICard label="Conversions"  value={summary.conversions}               delta={summary.convDelta}          sparkData={convSparkData}  accentColor="var(--success)" />
        <KPICard label="Revenue"      value={summary.revenue}                   delta={summary.revDelta}           prefix="$" accentColor="var(--success)" />
        <KPICard label="Blended ROAS" value={safeNum(summary.roas).toFixed(2)}  delta={summary.roasDelta}          suffix="×" sparkData={roasSparkData}  accentColor="var(--accent)" />
        <KPICard label="Blended CPA"  value={safeNum(summary.cpa).toFixed(2)}   delta={-safeNum(summary.cpaDelta)} prefix="$" sparkData={cpaSparkData}
          accentColor={safeNum(summary.cpa) > TARGET_CPA ? "var(--danger)" : "var(--success)"} />
      </div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: -12, marginBottom: 20, letterSpacing: "0.01em" }}>
        % vs previous {selectedWindow} days
      </div>

      {/* Charts row */}
      <div className="grid-2-1 fade-in fade-in-1" style={{ alignItems: "stretch" }}>
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
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <span className="card-title">Spend Distribution</span>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <DonutChart segments={platformSpendData} centerLabel={`${selectedWindow}d total`}
              centerValue={formatCurrency(summary.spend)} size={130} />
          </div>
        </div>
      </div>

      {/* Anomalies + Platform ROAS */}
      <div className="grid-2 fade-in fade-in-2" style={{ alignItems: "stretch" }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Active Anomalies</span>
            {criticalCount > 0
              ? <span className="badge badge-danger">{criticalCount} critical</span>
              : anomalies.length > 0
                ? <span className="badge badge-warning">{anomalies.length} warning</span>
                : <span className="badge badge-neutral">All clear</span>
            }
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {anomalies.length === 0
              ? <div style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "20px 0" }}>No active anomalies</div>
              : anomalies.map((a) => <AnomalyRow key={a.id} anomaly={a} />)
            }
          </div>
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div>
            <div className="card-header">
              <span className="card-title">Platform ROAS</span>
              <span className="text-xs text-tertiary">7-day avg</span>
            </div>
            <HBar items={platformRoas} maxValue={4} />
          </div>
          <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Target ROAS</span>
              <span className="text-mono" style={{ fontSize: 12, color: "var(--accent)" }}>{TARGET_ROAS.toFixed(1)}×</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Campaigns — 5-column summary view */}
      <div className="card fade-in fade-in-3" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">Top Campaigns by ROAS</span>
          <span className="text-xs text-tertiary">
            {topCampaigns.length} of {campaigns.length} · <a href="/campaigns" style={{ color: "var(--accent)", textDecoration: "none" }}>View all →</a>
          </span>
        </div>
        <table className="data-table data-table-compact">
          <thead>
            <tr>
              <th style={{ width: 30 }} />
              <th>Campaign</th>
              <th>ROAS</th>
              <th>CPA</th>
              <th style={{ width: 60 }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {topCampaigns.map((c) => (
              <tr key={c.id}>
                <td><span className={`platform-dot ${c.platform}`} /></td>
                <td style={{ maxWidth: 320 }}>
                  <span className="truncate" style={{ fontWeight: 500, display: "block" }}>{c.name}</span>
                  {c.status !== "active" && (
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.status}</span>
                  )}
                </td>
                <td className="mono" style={{ color: safeNum(c.roas) >= TARGET_ROAS ? "var(--success)" : safeNum(c.roas) >= 1.5 ? "var(--warning)" : "var(--danger)" }}>
                  {safeNum(c.roas).toFixed(2)}×
                </td>
                <td className="mono" style={{ color: safeNum(c.cpa) > TARGET_CPA ? "var(--danger)" : "var(--success)" }}>
                  ${safeNum(c.cpa).toFixed(2)}
                </td>
                <td><TrendArrow trend={c.trend} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
