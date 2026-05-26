"use client";
import type { Platform, ActionTier, CampaignStatus, ActionStatus, TrendDirection } from "@/types";

/* ── Skeleton Block ────────────────────────────────────────── */
interface SkeletonBlockProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}

export function SkeletonBlock({ width = "100%", height = 16, radius = 5, style }: SkeletonBlockProps) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
    />
  );
}

/* ── Sync Spinner ──────────────────────────────────────────── */
export function SyncSpinner({ size = 12 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        border: `2px solid var(--accent)`,
        borderTopColor: "transparent",
        borderRadius: "50%",
        display: "inline-block",
        animation: "adp-spin 0.6s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

/* ── Status Badge ──────────────────────────────────────────── */
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active:       { label: "Active",        cls: "badge badge-success" },
  paused:       { label: "Paused",        cls: "badge badge-neutral" },
  warning:      { label: "Warning",       cls: "badge badge-warning" },
  ended:        { label: "Ended",         cls: "badge badge-neutral" },
  draft:        { label: "Draft",         cls: "badge badge-neutral" },
  approved:     { label: "Approved",      cls: "badge badge-success" },
  rejected:     { label: "Rejected",      cls: "badge badge-danger" },
  live:         { label: "Live",          cls: "badge badge-success" },
  pending:      { label: "Pending",       cls: "badge badge-warning" },
  auto_approved:{ label: "Auto-Approved", cls: "badge badge-info" },
  deferred:     { label: "Deferred",      cls: "badge badge-neutral" },
  revoked:      { label: "Revoked",       cls: "badge badge-danger" },
};

export function StatusBadge({ status }: { status: CampaignStatus | ActionStatus | string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: "badge badge-neutral" };
  return <span className={s.cls}>{s.label}</span>;
}

/* ── Tier Badge ────────────────────────────────────────────── */
export function TierBadge({ tier }: { tier: ActionTier }) {
  return (
    <span className={`badge-tier badge-tier-${tier}`}>T{tier}</span>
  );
}

/* ── Trend Arrow ───────────────────────────────────────────── */
export function TrendArrow({ trend }: { trend: TrendDirection }) {
  if (trend === "up")   return <span style={{ color: "var(--success)", fontSize: 14 }}>↑</span>;
  if (trend === "down") return <span style={{ color: "var(--danger)",  fontSize: 14 }}>↓</span>;
  return <span style={{ color: "var(--text-tertiary)", fontSize: 14 }}>→</span>;
}

/* ── Platform Tag ──────────────────────────────────────────── */
const PLATFORM_LABELS: Record<Platform, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  snapchat: "Snapchat",
};

export function PlatformTag({ platform }: { platform: Platform }) {
  return (
    <span className={`platform-tag ${platform}`}>
      <span className={`platform-dot ${platform}`} />
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

/* ── Skeleton KPI Card ─────────────────────────────────────── */
export function SkeletonKPI() {
  return (
    <div className="kpi-card">
      <SkeletonBlock width={80} height={11} style={{ marginBottom: 8 }} />
      <SkeletonBlock width={120} height={24} style={{ marginBottom: 6 }} />
      <SkeletonBlock width={60} height={11} />
    </div>
  );
}

/* ── Skeleton Chart ────────────────────────────────────────── */
export function SkeletonChart({ height = 200 }: { height?: number }) {
  return (
    <div className="skeleton" style={{ height, borderRadius: "var(--radius-md)", width: "100%" }} />
  );
}

/* ── Skeleton Table ────────────────────────────────────────── */
export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  const cols = [10, 140, 54, 62, 26, 44, 44, 34, 26, 14];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderBottom: "1px solid oklch(0.20 0.01 260)",
          }}
        >
          {cols.map((w, j) => (
            <SkeletonBlock key={j} width={w} height={12} style={{ flexShrink: 0 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Skeleton Card List ────────────────────────────────────── */
export function SkeletonCardList({ count = 3, height = 100 }: { count?: number; height?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card skeleton"
          style={{ height, borderRadius: "var(--radius-md)" }}
        />
      ))}
    </div>
  );
}

/* ── Skeleton Donut ────────────────────────────────────────── */
export function SkeletonDonut({ size = 120 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `conic-gradient(
          oklch(0.24 0.012 260) 0deg,
          oklch(0.19 0.012 260) 120deg,
          oklch(0.24 0.012 260) 240deg,
          oklch(0.19 0.012 260) 360deg
        )`,
        animation: "skeleton-shimmer 2s ease-in-out infinite",
        backgroundSize: "300% 100%",
        flexShrink: 0,
      }}
    />
  );
}

/* ── Skeleton Overview Page ────────────────────────────────── */
export function SkeletonOverview() {
  return (
    <div className="skeleton-page">
      {/* Page header */}
      <div className="page-header">
        <div>
          <SkeletonBlock width={160} height={28} style={{ marginBottom: 8 }} />
          <SkeletonBlock width={260} height={13} />
        </div>
        <SkeletonBlock width={120} height={32} radius={6} />
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonKPI key={i} />)}
      </div>

      {/* Chart row */}
      <div className="grid-2-1">
        <div className="card">
          <SkeletonBlock width={140} height={13} style={{ marginBottom: 16 }} />
          <SkeletonChart height={180} />
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SkeletonBlock width={100} height={13} style={{ marginBottom: 4 }} />
          {["Meta", "TikTok", "Snapchat"].map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SkeletonBlock width={28} height={28} radius={4} />
              <div style={{ flex: 1 }}>
                <SkeletonBlock width="60%" height={11} style={{ marginBottom: 6 }} />
                <SkeletonBlock width="100%" height={6} radius={3} />
              </div>
              <SkeletonBlock width={40} height={11} />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid-2">
        <div className="card">
          <SkeletonBlock width={120} height={13} style={{ marginBottom: 14 }} />
          <SkeletonTable rows={4} />
        </div>
        <div className="card">
          <SkeletonBlock width={120} height={13} style={{ marginBottom: 14 }} />
          <SkeletonCardList count={2} height={60} />
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton Generic Page ─────────────────────────────────── */
export function SkeletonGenericPage({ title = "" }: { title?: string }) {
  return (
    <div className="skeleton-page">
      <div className="page-header">
        <div>
          {title ? (
            <div className="page-title">{title}</div>
          ) : (
            <SkeletonBlock width={160} height={28} style={{ marginBottom: 8 }} />
          )}
          <SkeletonBlock width={280} height={13} />
        </div>
      </div>
      <SkeletonCardList count={4} height={90} />
    </div>
  );
}
