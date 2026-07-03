"use client";
import { useEffect, useState } from "react";
import {
  getOptimizerConfig, setOptimizerConfig, runAiMediaBuyer,
  getAiMemory, runAiSelfReview,
  type OptimizerConfig, type AiRecommendation, type AiMemory,
} from "@/services/meta.service";

const ACTION_COLOR: Record<string, string> = {
  KILL: "var(--danger)", DECREASE: "var(--warning)", SCALE: "var(--success)",
  DUPLICATE_WINNER: "var(--success)", ROTATE_CREATIVE: "oklch(0.75 0.14 75)",
  FLAG_FUNNEL: "oklch(0.7 0.15 250)", HOLD: "var(--text-tertiary)",
};

const CONF_COLOR: Record<string, string> = {
  high: "var(--success)", medium: "var(--warning)", low: "var(--text-tertiary)",
};

export function AiMediaBuyerPanel() {
  const [cfg, setCfg] = useState<OptimizerConfig | null>(null);
  const [recs, setRecs] = useState<AiRecommendation[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [memory, setMemory] = useState<AiMemory | null>(null);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => { getOptimizerConfig().then(setCfg).catch((e) => setError((e as Error).message)); }, []);
  useEffect(() => { getAiMemory().then(setMemory).catch(() => {}); }, []);

  async function selfReview() {
    setReviewing(true); setError(null);
    try { await runAiSelfReview(); setMemory(await getAiMemory()); }
    catch (e) { setError((e as Error).message); }
    finally { setReviewing(false); }
  }

  async function patch(p: Partial<OptimizerConfig>) {
    if (!cfg) return;
    setCfg({ ...cfg, ...p });
    try { setCfg(await setOptimizerConfig(p)); }
    catch (e) { setError((e as Error).message); }
  }

  async function run() {
    setRunning(true); setError(null); setSummary(null);
    try {
      const res = await runAiMediaBuyer();
      if (!res.ran) { setSummary(res.reason ?? "AI is disabled."); setRecs([]); }
      else {
        setRecs(res.recommendations);
        setSummary(`Analyzed ${res.evaluated} · executed ${res.executed} · queued ${res.queued}`);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setRunning(false); }
  }

  if (!cfg) return <div className="card" style={{ padding: 18, color: "var(--text-secondary)" }}>Loading AI Media Buyer…</div>;
  const cur = cfg.currency;

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>AI Media Buyer</div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Senior-buyer analysis · diagnoses metrics, then decides</div>
        </div>
        <button onClick={run} disabled={running}
          style={{ background: "var(--accent)", color: "var(--text-inverse)", border: "none",
            borderRadius: "var(--radius-sm)", padding: "8px 16px", fontSize: 13, fontWeight: 700,
            cursor: running ? "default" : "pointer", opacity: running ? 0.6 : 1 }}>
          {running ? "Analyzing…" : "Run AI analysis"}
        </button>
      </div>

      {/* your business numbers */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "14px 0 8px" }}>Your targets — fill these in</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <Num label={`Target CPA (${cur})`} value={cfg.target_cpa} onSave={(v) => patch({ target_cpa: v })} />
        <Num label="Breakeven ROAS" value={cfg.breakeven_roas} onSave={(v) => patch({ breakeven_roas: v })} step={0.1} />
        <Num label={`Avg order value (${cur})`} value={cfg.avg_order_value} onSave={(v) => patch({ avg_order_value: v })} />
        <Num label="Max frequency" value={cfg.max_frequency} onSave={(v) => patch({ max_frequency: v })} step={0.5} />
        <Num label="Min days before judging" value={cfg.min_days_before_judgment} onSave={(v) => patch({ min_days_before_judgment: v })} />
        <Select label="Aggressiveness" value={cfg.aggressiveness}
          options={["conservative", "balanced", "aggressive"]} onSave={(v) => patch({ aggressiveness: v as OptimizerConfig["aggressiveness"] })} />
      </div>

      {/* auto-execute controls */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "16px 0 8px" }}>Autonomy — what the AI may do on its own</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <Toggle label="AI enabled" hint="run every hour" on={cfg.ai_enabled} onChange={(v) => patch({ ai_enabled: v })} />
        <Toggle label="Auto-execute" hint="OFF = propose only" on={cfg.auto_execute} onChange={(v) => patch({ auto_execute: v })} danger />
        <Toggle label="Auto-kill/pause" hint="stop losers on its own" on={cfg.auto_kill} onChange={(v) => patch({ auto_kill: v })} />
        <Toggle label="Auto-decrease" hint="cut budget on its own" on={cfg.auto_decrease} onChange={(v) => patch({ auto_decrease: v })} />
        <Toggle label="Auto-scale" hint="raise budget on its own" on={cfg.auto_scale} onChange={(v) => patch({ auto_scale: v })} danger />
        <Num label="Scale step %" value={cfg.scale_step_pct} onSave={(v) => patch({ scale_step_pct: v })} />
        <Num label="Decrease step %" value={cfg.decrease_step_pct} onSave={(v) => patch({ decrease_step_pct: v })} />
        <Num label="Max auto change %" value={cfg.max_auto_budget_change_pct} onSave={(v) => patch({ max_auto_budget_change_pct: v })} />
      </div>

      {cfg.ai_enabled && cfg.auto_execute && (
        <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 12, fontWeight: 600 }}>
          ⚠ AI + Auto-execute are ON — it will act on live ad sets hourly within your limits.
        </div>
      )}

      {/* learning / memory */}
      <div style={{ marginTop: 16, padding: 12, background: "var(--bg-input)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Learning memory</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {memory ? `${memory.decision_count} decisions remembered · ${memory.lessons.length} lessons` : "…"} · auto-reviews weekly
            </div>
          </div>
          <button onClick={selfReview} disabled={reviewing}
            style={{ background: "transparent", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
              padding: "6px 12px", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: reviewing ? "default" : "pointer" }}>
            {reviewing ? "Reviewing…" : "Review now"}
          </button>
        </div>
        {memory && memory.lessons.length > 0 && (
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
            {memory.lessons.map((l, i) => <li key={i} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{l}</li>)}
          </ul>
        )}
        {memory && memory.lessons.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
            No lessons yet — the AI accumulates them from decisions + outcomes over time. Value grows with data.
          </div>
        )}
      </div>

      {summary && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 12 }}>{summary}</div>}
      {error && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 12 }}>{error}</div>}

      {/* AI reasoning per ad set */}
      {recs && recs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {recs.map((r) => (
            <div key={r.entity_id} style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{r.entity_name}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: CONF_COLOR[r.confidence], fontWeight: 700, textTransform: "uppercase" }}>{r.confidence}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: ACTION_COLOR[r.action], background: `${ACTION_COLOR[r.action]}18`, padding: "3px 10px", borderRadius: 4 }}>
                    {r.action.replace("_", " ")}
                  </span>
                  {r.executed && <span style={{ fontSize: 10, color: "var(--success)", fontWeight: 700 }}>✓ done</span>}
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.55, marginBottom: 4 }}>
                <strong style={{ color: "var(--text-secondary)" }}>Diagnosis:</strong> {r.diagnosis}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                <strong>Why:</strong> {r.reasoning}
              </div>
              {r.result && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6, fontFamily: "var(--font-mono)" }}>{r.result}</div>}
            </div>
          ))}
        </div>
      )}
      {recs && recs.length === 0 && summary && (
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 12 }}>No active ad sets to analyze.</div>
      )}
    </div>
  );
}

/* ── small fields ── */
function Num({ label, value, onSave, step }: { label: string; value: number; onSave: (v: number) => void; step?: number }) {
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  return (
    <div>
      <label style={lblStyle}>{label}</label>
      <input type="number" step={step ?? 1} value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => { const n = Number(v); if (!Number.isNaN(n) && n !== value) onSave(n); }} style={inStyle} />
    </div>
  );
}

function Select({ label, value, options, onSave }: { label: string; value: string; options: string[]; onSave: (v: string) => void }) {
  return (
    <div>
      <label style={lblStyle}>{label}</label>
      <select value={value} onChange={(e) => onSave(e.target.value)} style={inStyle}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Toggle({ label, hint, on, onChange, danger }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <button onClick={() => onChange(!on)}
      style={{ textAlign: "left", padding: "8px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer",
        background: on ? (danger ? "var(--danger)" : "var(--success)") : "var(--bg-input)",
        color: on ? "var(--text-inverse)" : "var(--text-primary)",
        border: `1px solid ${on ? "transparent" : "var(--border-subtle)"}` }}>
      <div style={{ fontSize: 12, fontWeight: 700 }}>{label}: {on ? "ON" : "OFF"}</div>
      <div style={{ fontSize: 10, opacity: 0.85 }}>{hint}</div>
    </button>
  );
}

const lblStyle: React.CSSProperties = { fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, display: "block", marginBottom: 4 };
const inStyle: React.CSSProperties = { width: "100%", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "8px 10px", color: "var(--text-primary)", fontSize: 13, outline: "none" };
