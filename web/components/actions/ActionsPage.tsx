"use client";
import { useState, useEffect } from "react";
import { useActions, useDecideAction, useRevokeAction } from "@/hooks/useActions";
import { TierBadge, PlatformTag, StatusBadge, SkeletonGenericPage } from "@/components/ui";
import type { Action } from "@/types";

/* ── relative time ─── */
function ago(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.round(diff / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const IMPACT_COLORS: Record<string, string> = {
  high: "var(--accent)",
  medium: "var(--info)",
  low: "var(--text-tertiary)",
};

function tierColor(tier: number) {
  return tier === 3 ? "var(--danger)" : tier === 2 ? "var(--warning)" : "var(--success)";
}

function isResolvedStatus(s?: string) {
  return s === "approved" || s === "rejected" || s === "auto_approved" || s === "revoked";
}

/* ── Summary stat ─────────────────────────────────────────── */
function ActionSummaryCard({ label, count, color, icon }: { label: string; count: number; color: string; icon: string }) {
  return (
    <div className="card" style={{ flex: 1, borderLeft: `3px solid ${color}`, padding: "10px 14px" }}>
      <div className="flex items-center gap-8" style={{ gap: 10 }}>
        <span style={{ fontSize: 15, color }}>{icon}</span>
        <div>
          <div className="text-mono" style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
          <div style={{ fontSize: 10.5, color: "var(--text-secondary)", marginTop: 2 }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Rule card (reference accordion) ──────────────────────── */
function RuleCard({ title, color, rules }: { title: string; color: string; rules: string[] }) {
  return (
    <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", padding: "12px 14px", border: `1px solid ${color}22` }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color, marginBottom: 8 }}>{title}</div>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
        {rules.map((r, i) => (
          <li key={i} style={{ fontSize: 11, color: "var(--text-secondary)", paddingLeft: 12, position: "relative" }}>
            <span style={{ position: "absolute", left: 0, color }}>·</span>
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Action buttons (shared by card footer + modal) ───────── */
function ActionButtons({ action, onActed }: { action: Action; onActed?: () => void }) {
  const decideMut = useDecideAction();
  const revokeMut = useRevokeAction();
  const resolved = isResolvedStatus(action.status);

  if (action.status === "auto_approved") {
    return (
      <>
        <button className="btn btn-danger btn-sm" disabled={revokeMut.isPending}
          onClick={() => { revokeMut.mutate(action.id); onActed?.(); }}>⏪ Revoke</button>
        {action.autoWindow && <span className="text-xs text-tertiary">{action.autoWindow}</span>}
      </>
    );
  }
  if (resolved) {
    return <StatusBadge status={action.status ?? "resolved"} />;
  }
  if (action.tier === 3) {
    return (
      <>
        <button className="btn btn-success btn-sm" disabled={decideMut.isPending}
          onClick={() => { decideMut.mutate({ id: action.id, payload: { decision: "approved" } }); onActed?.(); }}>✓ Approve</button>
        <button className="btn btn-danger btn-sm" disabled={decideMut.isPending}
          onClick={() => { decideMut.mutate({ id: action.id, payload: { decision: "rejected" } }); onActed?.(); }}>✗ Reject</button>
      </>
    );
  }
  return <span className="badge badge-neutral">{action.status ?? "pending"}</span>;
}

/* ── Detail modal ─────────────────────────────────────────── */
function ActionDetailModal({ action, onClose }: { action: Action; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12, gap: 12 }}>
          <div className="action-card__badges">
            <TierBadge tier={action.tier} />
            <PlatformTag platform={action.platform} />
            <span className="action-card__impact" style={{ color: IMPACT_COLORS[action.impact] }}>{action.impact} impact</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>{action.description}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>{action.campaign}</div>

        <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 6 }}>Rationale</div>
        <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text-secondary)", marginBottom: 14 }}>{action.rationale}</div>

        {action.estimatedGain && (
          <div style={{ background: "var(--success-bg)", color: "var(--success)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: 12.5, fontWeight: 600, marginBottom: 16 }}>
            Est. impact: {action.estimatedGain}
          </div>
        )}

        <div className="flex items-center gap-8" style={{ gap: 8, marginTop: 4 }}>
          <ActionButtons action={action} onActed={onClose} />
        </div>
      </div>
    </div>
  );
}

/* ── Action card (grid item) ──────────────────────────────── */
function ActionCard({ action }: { action: Action }) {
  const [showDetails, setShowDetails] = useState(false);
  const resolved = isResolvedStatus(action.status);

  return (
    <div className={`action-card ${resolved ? "is-resolved" : ""}`} style={{ ["--accent-bar" as string]: tierColor(action.tier) }}>
      <div className="action-card__head">
        <div className="action-card__badges">
          <TierBadge tier={action.tier} />
          <PlatformTag platform={action.platform} />
          <span className="action-card__impact" style={{ color: IMPACT_COLORS[action.impact] }}>{action.impact}</span>
        </div>
        <span className="text-xs text-tertiary" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{ago(action.createdAt)}</span>
      </div>

      <div className="action-card__title clamp-2">{action.description}</div>

      <div className="action-card__meta">
        <span className="truncate">{action.campaign}</span>
        {action.estimatedGain && (
          <><span className="meta-dot">·</span><span className="meta-gain">{action.estimatedGain}</span></>
        )}
      </div>

      <button className="action-card__details" onClick={() => setShowDetails(true)}>ⓘ Details</button>

      <div className="action-card__footer">
        <ActionButtons action={action} />
      </div>

      {showDetails && <ActionDetailModal action={action} onClose={() => setShowDetails(false)} />}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
export function ActionsPage() {
  const [filter, setFilter] = useState("all");
  const { data: actions, isLoading, isError, error } = useActions(filter);

  if (isLoading) return <SkeletonGenericPage title="Actions" />;
  if (isError) return (
    <div style={{ padding: "24px", color: "var(--danger)" }}>Failed to load: {(error as Error)?.message}</div>
  );

  const all = actions ?? [];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Actions</div>
          <div className="page-subtitle">Pending approvals and automated actions</div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="stat-strip fade-in" style={{ marginBottom: 12 }}>
        <ActionSummaryCard label="Tier 3 — Pending" count={all.filter((a) => a.tier === 3 && a.status === "pending").length} color="var(--danger)" icon="⬤" />
        <ActionSummaryCard label="Tier 2 — Auto-executed" count={all.filter((a) => a.tier === 2 && a.status != null && ["auto_approved", "approved"].includes(a.status)).length} color="var(--warning)" icon="◐" />
        <ActionSummaryCard label="Tier 1 — Autonomous" count={all.filter((a) => a.tier === 1).length} color="var(--success)" icon="●" />
      </div>

      {/* Filter tabs */}
      <div className="tab-bar fade-in fade-in-1">
        {[
          { id: "all",     label: "All Actions" },
          { id: "pending", label: "Pending Approval" },
          { id: "tier3",   label: "Tier 3 — HITL" },
          { id: "tier2",   label: "Tier 2 — Auto" },
        ].map((t) => (
          <button key={t.id} className={`tab-btn ${filter === t.id ? "active" : ""}`} onClick={() => setFilter(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Action cards — responsive grid */}
      <div className="actions-grid fade-in fade-in-2">
        {all.map((action) => <ActionCard key={action.id} action={action} />)}
      </div>
      {all.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-tertiary)", fontSize: 13 }}>
          No actions found
        </div>
      )}

      {/* Decision rules — collapsible reference */}
      <details className="card fade-in fade-in-3" style={{ marginTop: 16, marginBottom: 24 }}>
        <summary style={{ cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", listStyle: "none" }}>
          Decision Rules Reference
        </summary>
        <div className="grid-3" style={{ marginBottom: 0, marginTop: 12 }}>
          <RuleCard title="Kill Criteria" color="var(--danger)" rules={[
            "CPA > 1.8× target for 3d (≥30 conv)",
            "ROAS < 0.8 over 7d (≥$200 spent)",
            "Z-score CPA > 3 sustained 48h",
            "Frequency > 8 + CTR drop > 50%",
          ]} />
          <RuleCard title="Scale Criteria" color="var(--success)" rules={[
            "ROAS ≥ 1.3× target over 7d",
            "≥100 conversions in 7d window",
            "No fatigue signal (freq < 4)",
            "Live ≥ 5d, spend < 80% cap",
          ]} />
          <RuleCard title="Test / Refresh" color="var(--info)" rules={[
            "≥ 2 active ads per ad set",
            "Refresh at CTR -30% from peak",
            "Refresh at freq > 4.5 cold / 6 warm",
            "Max 4 variants parallel per ad set",
          ]} />
        </div>
      </details>
    </div>
  );
}
