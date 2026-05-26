"use client";
import { useAuditLog } from "@/hooks/useAudit";
import { TierBadge, SkeletonGenericPage } from "@/components/ui";
import type { AuditAction } from "@/types";

const ACTION_ICONS: Record<AuditAction | string, string> = {
  action_proposed:    "📋",
  anomaly_detected:   "🚨",
  budget_realloc:     "💰",
  creative_generated: "✦",
  data_pull:          "⟳",
  reconciliation:     "⟳",
  action_approved:    "✅",
  campaign_paused:    "⏸",
  digest_sent:        "📨",
  action_rejected:    "❌",
};

export function AuditPage() {
  const { data: entries, isLoading, isError, error } = useAuditLog(50, 0);

  if (isLoading) return <SkeletonGenericPage title="Audit Log" />;
  if (isError) return (
    <div style={{ padding: "24px", color: "var(--danger)" }}>Failed to load: {(error as Error)?.message}</div>
  );

  const all = entries ?? [];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Audit Log</div>
          <div className="page-subtitle">Immutable record of all system actions · 90-day retention</div>
        </div>
        <button className="btn btn-ghost btn-sm">Export CSV</button>
      </div>

      <div className="card fade-in">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th>Timestamp</th>
              <th>Action</th>
              <th>Tier</th>
              <th>Detail</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            {all.map((entry) => (
              <tr key={entry.id}>
                <td style={{ fontSize: 14, textAlign: "center" }}>
                  {ACTION_ICONS[entry.action] ?? "·"}
                </td>
                <td className="mono" style={{ whiteSpace: "nowrap", fontSize: 11, color: "var(--text-secondary)" }}>
                  {new Date(entry.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 500 }}>
                    {entry.action.replace(/_/g, " ")}
                  </span>
                </td>
                <td><TierBadge tier={entry.tier} /></td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 400 }} className="truncate">
                  {entry.detail}
                </td>
                <td>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: entry.actor === "operator" ? "var(--accent)" : "var(--text-tertiary)" }}>
                    {entry.actor}
                  </span>
                </td>
              </tr>
            ))}
            {all.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-tertiary)", fontSize: 13 }}>
                  No audit entries
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
