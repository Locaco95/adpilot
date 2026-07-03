"use client";
import { useEffect, useMemo, useState } from "react";
import {
  getOptimizerMetricsCatalog, getOptimizerMetrics,
  type MetricDef, type EntityMetrics,
} from "@/services/meta.service";

const REQUIRES_LABEL: Record<string, string> = {
  pixel: "needs pixel", video: "video only", history: "coming soon",
};

/* Grouped metric picker + live values per ad set. `selected` + onToggle come
   from the parent (persisted in optimizer config). */
export function MetricsSelector({
  selected, onToggle,
}: {
  selected: string[]; onToggle: (key: string, on: boolean) => void;
}) {
  const [catalog, setCatalog] = useState<MetricDef[] | null>(null);
  const [entities, setEntities] = useState<EntityMetrics[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, m] = await Promise.all([getOptimizerMetricsCatalog(), getOptimizerMetrics()]);
        setCatalog(c.metrics);
        setEntities(m.entities);
      } catch (e) { setError((e as Error).message); }
    })();
  }, []);

  const groups = useMemo(() => {
    const g: Record<string, MetricDef[]> = {};
    for (const m of catalog ?? []) (g[m.group] ??= []).push(m);
    return g;
  }, [catalog]);

  // which selected metrics actually have data on ANY ad set right now
  const hasData = useMemo(() => {
    const s = new Set<string>();
    for (const e of entities ?? [])
      for (const [k, v] of Object.entries(e.metrics)) if (v !== null && v !== undefined) s.add(k);
    return s;
  }, [entities]);

  if (error) return <div style={{ color: "var(--danger)", fontSize: 12 }}>{error}</div>;
  if (!catalog) return <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>Loading metrics…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {Object.entries(groups).map(([group, metrics]) => (
        <div key={group}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{group}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {metrics.map((m) => {
              const on = selected.includes(m.key);
              const dormant = m.requires !== "" && !hasData.has(m.key);
              return (
                <button key={m.key} onClick={() => onToggle(m.key, !on)} title={m.desc}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 16,
                    fontSize: 12, cursor: "pointer", fontFamily: "var(--font-body)",
                    background: on ? "var(--accent)" : "var(--bg-input)",
                    color: on ? "var(--text-inverse)" : "var(--text-secondary)",
                    border: `1px solid ${on ? "var(--accent)" : "var(--border-subtle)"}`,
                    opacity: dormant ? 0.6 : 1,
                  }}>
                  {on ? "✓ " : ""}{m.label}
                  {dormant && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 8,
                      background: "var(--warning)", color: "var(--text-inverse)" }}>
                      {REQUIRES_LABEL[m.requires] ?? "no data"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
        Tap to include a metric in the optimizer. Tags mark metrics that need the pixel, video ads,
        or upcoming history storage before they carry data.
      </div>
    </div>
  );
}
