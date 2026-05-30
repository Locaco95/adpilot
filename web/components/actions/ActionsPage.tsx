"use client";
import { useState } from "react";
import { useActions, useDecideAction, useRevokeAction } from "@/hooks/useActions";
import { TierBadge, PlatformTag, StatusBadge, SkeletonGenericPage } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import type { Action } from "@/types";

/* ── timeAgo local util ─── */
function ago(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.round(diff / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/* ── Action Summary Card ─────────────────────────────────── */
function ActionSummaryCard({ label, count, color, icon }: { label: string; count: number; color: string; icon: string }) {
  return (
    <div className="card" style={{ flex: 1, borderLeft: `3px solid ${color}` }}>
      <div className="flex items-center gap-8" style={{ gap: 10 }}>
        <span style={{ fontSize: 16, color }}>{icon}</span>
        <div>
          <div className="text-mono" style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Rule Card ───────────────────────────────────────────── */
function RuleCard({ title, color, rules }: { title: string; color: string; rules: string[] }) {
  return (
    <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", padding: "12px 14px", border: `1px solid ${color}22` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 8 }}>{title}</div>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
        {rules.map((r, i) => (
          <li key={i} style={{ fontSize: 11.5, color: "var(--text-secondary)", paddingLeft: 12, position: "relative" }}>
            <span style={{ position: "absolute", left: 0, color }}>·</span>
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Action Card ─────────────────────────────────────────── */
function ActionCard({ action }: { action: Action }) {
  const [expanded, setExpanded] = useState(false);
  const decideMut = useDecideAction();
  const revokeMut = useRevokeAction();

  const isResolved =
    action.status === "approved" ||
    action.status === "rejected" ||
    action.status === "auto_approved" ||
    action.status === "revoked";

  const impactColors: Record<string, string> = {
    high: "var(--accent)",
    medium: "var(--info)",
    low: "var(--text-tertiary)",
  };

  const tierColor = action.tier === 3 ? "var(--danger)" : action.tier === 2 ? "var(--warning)" : "var(--success)";

  return (
    <div className="card" style={{ borderLeft: `3px solid ${tierColor}`, opacity: isResolved ? 0.7 : 1 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <div className="flex items-center gap-8" style={{ gap: 10 }}>
          <TierBadge tier={action.tier} />
          <PlatformTag platform={action.platform} />
          <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", color: impactColors[action.impact], textTransform: "uppercase" }}>
            {action.impact} impact
          </span>
        </div>
        <div className="flex items-center gap-8" style={{ gap: 8 }}>
          {action.status === "auto_approved" && <StatusBadge status="auto_approved" />}
          <span className="text-xs text-tertiary">{ago(action.createdAt)}</span>
        </div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{action.description}</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>{action.campaign}</div>

      <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12, fontFamily: "var(--font-body)", fontWeight: 500, padding: "4px 0" }}>
        {expanded ? "▾ Hide rationale" : "▸ Show rationale"}
      </button>

      {expanded && (
        <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", padding: "10px 12px", marginTop: 6, marginBottom: 8, fontSize: 12.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          {action.rationale}
          {action.estimatedGain && (
            <div style={{ marginTop: 6, color: "var(--success)", fontWeight: 600 }}>
              Est. impact: {action.estimatedGain}
            </div>
          )}
        </div>
      )}

      {/* Tier 3 approval buttons */}
      {!isResolved && action.tier === 3 && (
        <div className="flex gap-8 mt-8" style={{ gap: 8, marginTop: 10 }}>
          <button className="btn btn-success btn-sm"
            disabled={decideMut.isPending}
            onClick={() => decideMut.mutate({ id: action.id, payload: { decision: "approved" } })}>
            ✓ Approve
          </button>
          <button className="btn btn-danger btn-sm"
            disabled={decideMut.isPending}
            onClick={() => decideMut.mutate({ id: action.id, payload: { decision: "rejected" } })}>
            ✗ Reject
          </button>
          <button className="btn btn-ghost btn-sm">⏸ Defer 6h</button>
        </div>
      )}

      {/* Tier 2 revoke */}
      {action.status === "auto_approved" && !isResolved && (
        <div className="flex items-center gap-8 mt-8" style={{ gap: 8, marginTop: 10 }}>
          <button className="btn btn-danger btn-sm"
            disabled={revokeMut.isPending}
            onClick={() => revokeMut.mutate(action.id)}>
            ⏪ Revoke
          </button>
          {action.autoWindow && (
            <span className="text-xs text-tertiary">{action.autoWindow}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */
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
      <div className="flex gap-12 mb-16 fade-in" style={{ gap: 12, marginBottom: 16 }}>
        <ActionSummaryCard label="Tier 3 — Awaiting" count={all.filter((a) => a.tier === 3 && !a.status).length} color="var(--danger)" icon="⬤" />
        <ActionSummaryCard label="Tier 2 — Auto-executed" count={all.filter((a) => a.tier === 2).length} color="var(--warning)" icon="◐" />
        <ActionSummaryCard label="Tier 1 — Autonomous" count={4} color="var(--success)" icon="●" />
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

      {/* Action cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }} className="fade-in fade-in-2">
        {all.map((action) => <ActionCard key={action.id} action={action} />)}
        {all.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-tertiary)", fontSize: 13 }}>
            No actions found
          </div>
        )}
      </div>

      {/* Decision rules */}
      <div className="card fade-in fade-in-3" style={{ marginTop: 16 }}>
        <div className="card-header">
          <span className="card-title">Decision Rules Reference</span>
        </div>
        <div className="grid-3" style={{ marginBottom: 0 }}>
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
      </div>
    </div>
  );
}
