"use client";
import { Fragment, useState } from "react";
import { useMetaAudit } from "@/hooks/useMeta";
import type { KpiGrade } from "@/types/meta";

const GRADE_COLOR: Record<KpiGrade, string> = {
  "Excellent": "var(--success)",
  "Good": "var(--success)",
  "Average": "var(--warning)",
  "Below Average": "var(--danger)",
  "Poor": "var(--danger)",
};

const PRESETS: { value: string; label: string }[] = [
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_14d", label: "Last 14 days" },
  { value: "last_30d", label: "Last 30 days" },
];

function scoreColor(score: number): string {
  if (score >= 80) return "var(--success)";
  if (score >= 60) return "oklch(0.75 0.14 75)"; // amber/accent
  if (score >= 40) return "var(--warning)";
  return "var(--danger)";
}

export function MetaAuditPanel() {
  const [preset, setPreset] = useState("last_7d");
  const { data, isLoading, isError, error } = useMetaAudit(preset);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Performance Audit</div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>KPIs graded against Meta benchmarks</div>
        </div>
        <select value={preset} onChange={(e) => setPreset(e.target.value)}
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)",
            padding: "7px 10px", color: "var(--text-primary)", fontSize: 12, outline: "none" }}>
          {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {isLoading && <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>Analyzing…</div>}
      {isError && <div style={{ color: "var(--danger)", fontSize: 13 }}>Failed to run audit: {(error as Error)?.message}</div>}
      {data && !data.available && (
        <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{data.message ?? "No data for this period yet."}</div>
      )}

      {data && data.available && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Score + assessment */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{
              width: 74, height: 74, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `conic-gradient(${scoreColor(data.score!)} ${data.score! * 3.6}deg, var(--bg-elevated) 0deg)`,
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%", background: "var(--bg-card)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, fontWeight: 800, fontFamily: "var(--font-mono)", color: scoreColor(data.score!),
              }}>
                {data.score}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: scoreColor(data.score!) }}>{data.assessment}</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                Score out of 100 · spend {data.spend?.toFixed(2)} this period
              </div>
            </div>
          </div>

          {/* KPI table */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "6px 14px", fontSize: 13 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>KPI</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>Value</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>Grade</div>
            {data.kpis!.map((k) => (
              <Fragment key={k.key}>
                <div style={{ color: "var(--text-secondary)" }}>{k.label}</div>
                <div style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{k.display}</div>
                <div style={{ textAlign: "right", fontWeight: 600, color: k.grade ? GRADE_COLOR[k.grade] : "var(--text-tertiary)" }}>
                  {k.grade ?? "—"}
                </div>
              </Fragment>
            ))}
          </div>

          {/* Recommendations */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <RecTier title="Do this week" items={data.recommendations!.tier1} color="var(--danger)" />
            <RecTier title="Next 2 weeks" items={data.recommendations!.tier2} color="var(--warning)" />
            <RecTier title="Next 30 days" items={data.recommendations!.tier3} color="var(--text-secondary)" />
          </div>
        </div>
      )}
    </div>
  );
}

function RecTier({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
        {items.map((r, i) => <li key={i} style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{r}</li>)}
      </ul>
    </div>
  );
}
