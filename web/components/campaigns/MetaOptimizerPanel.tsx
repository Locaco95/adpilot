"use client";
import { Fragment, useEffect, useState } from "react";
import {
  getOptimizerRecs, getOptimizerConfig, setOptimizerConfig, runOptimizerNow,
  type OptimizerRec, type OptimizerConfig,
} from "@/services/meta.service";

const ACTION_COLOR: Record<string, string> = {
  KILL: "var(--danger)", PAUSE: "var(--warning)", SCALE: "var(--success)",
  REFRESH_CREATIVE: "oklch(0.75 0.14 75)", DUPLICATE_WINNER: "var(--success)",
  HOLD: "var(--text-tertiary)",
};

function ActionBadge({ action }: { action: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color: ACTION_COLOR[action] ?? "var(--text-secondary)",
      background: `${ACTION_COLOR[action] ?? "var(--text-tertiary)"}18`,
      padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap",
    }}>{action.replace("_", " ")}</span>
  );
}

export function MetaOptimizerPanel() {
  const [cfg, setCfg] = useState<OptimizerConfig | null>(null);
  const [recs, setRecs] = useState<OptimizerRec[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [c, r] = await Promise.all([getOptimizerConfig(), getOptimizerRecs()]);
      setCfg(c);
      setRecs(r.recommendations);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function patch(p: Partial<OptimizerConfig>) {
    if (!cfg) return;
    setCfg({ ...cfg, ...p }); // optimistic
    try { setCfg(await setOptimizerConfig(p)); }
    catch (e) { setError((e as Error).message); load(); }
  }

  async function runNow() {
    setRunning(true); setMsg(null); setError(null);
    try {
      const res = await runOptimizerNow();
      setMsg(`Pass complete: ${JSON.stringify(res)}`);
      load();
    } catch (e) { setError((e as Error).message); }
    finally { setRunning(false); }
  }

  const actionable = (recs ?? []).filter((r) => r.recommended_action !== "HOLD");

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>AI Optimizer</div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Deterministic rules decide · runs hourly when enabled</div>
        </div>
        <button onClick={runNow} disabled={running}
          style={{ background: "var(--accent)", color: "var(--text-inverse)", border: "none",
            borderRadius: "var(--radius-sm)", padding: "7px 14px", fontSize: 12, fontWeight: 600,
            cursor: running ? "default" : "pointer", opacity: running ? 0.6 : 1 }}>
          {running ? "Running…" : "Run now"}
        </button>
      </div>

      {/* config + kill switch */}
      {cfg && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
          <Toggle label="Loop enabled" hint="run every hour" on={cfg.enabled} onChange={(v) => patch({ enabled: v })} />
          <Toggle label="Auto-execute" hint="OFF = propose only" on={cfg.auto_execute} onChange={(v) => patch({ auto_execute: v })} danger />
          <NumField label={`Breakeven ROAS`} value={cfg.breakeven_roas} onSave={(v) => patch({ breakeven_roas: v })} />
          <NumField label={`Target CPA (${cfg.currency})`} value={cfg.target_cpa} onSave={(v) => patch({ target_cpa: v })} />
          <NumField label={`Approval threshold (${cfg.currency})`} value={cfg.human_approval_spend_threshold} onSave={(v) => patch({ human_approval_spend_threshold: v })} />
        </div>
      )}

      {cfg && cfg.auto_execute && (
        <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 12, fontWeight: 600 }}>
          ⚠ Auto-execute is ON — the loop will pause/scale live ad sets on its own within your thresholds.
        </div>
      )}

      {msg && <div style={{ fontSize: 12, color: "var(--success)", marginBottom: 10, wordBreak: "break-all" }}>{msg}</div>}
      {error && <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 10 }}>{error}</div>}
      {loading && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Loading recommendations…</div>}

      {recs && (
        <div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>
            {actionable.length} actionable · {recs.length - actionable.length} holding
          </div>
          {recs.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>No active ad sets to evaluate.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "8px 14px", fontSize: 13, alignItems: "center" }}>
              <div style={hdr}>Ad set</div><div style={{ ...hdr, textAlign: "right" }}>Action</div><div style={{ ...hdr, textAlign: "right" }}>Approval</div>
              {recs.map((r) => (
                <Fragment key={r.entity_id}>
                  <div>
                    <div style={{ color: "var(--text-primary)" }}>{r.entity_name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{r.diagnosis || r.matched_rule}</div>
                  </div>
                  <div style={{ textAlign: "right" }}><ActionBadge action={r.recommended_action} /></div>
                  <div style={{ textAlign: "right", fontSize: 11, color: r.human_approval_required ? "var(--warning)" : "var(--success)", fontWeight: 600 }}>
                    {r.recommended_action === "HOLD" ? "—" : r.human_approval_required ? "needs you" : "auto"}
                  </div>
                </Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const hdr: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" };

function Toggle({ label, hint, on, onChange, danger }: {
  label: string; hint: string; on: boolean; onChange: (v: boolean) => void; danger?: boolean;
}) {
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

function NumField({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  return (
    <div>
      <label style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, display: "block", marginBottom: 4 }}>{label}</label>
      <input type="number" value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => { const n = Number(v); if (!Number.isNaN(n) && n !== value) onSave(n); }}
        style={{ width: "100%", background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)", padding: "8px 10px", color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
    </div>
  );
}
