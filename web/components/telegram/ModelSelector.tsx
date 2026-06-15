"use client";
import { useEffect, useState } from "react";
import { getLLMModel, setLLMModel, type LLMModelOption } from "@/services/settings.service";

/* Picks the AI model the Telegram agent uses. Persisted on the backend. */
export function ModelSelector() {
  const [options, setOptions] = useState<LLMModelOption[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLLMModel()
      .then((s) => { setOptions(s.options); setCurrent(s.current); })
      .catch((e) => setError((e as Error)?.message ?? "Failed to load models"));
  }, []);

  async function onChange(id: string) {
    setCurrent(id);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await setLLMModel(id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // group options by provider for the <optgroup>s
  const byProvider = options.reduce<Record<string, LLMModelOption[]>>((acc, o) => {
    (acc[o.provider] ??= []).push(o);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600 }}>AI model</span>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        disabled={saving || options.length === 0}
        style={{
          background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)", padding: "6px 10px", color: "var(--text-primary)",
          fontSize: 12, outline: "none", minWidth: 200, cursor: "pointer",
        }}
      >
        {options.length === 0 && <option>Loading…</option>}
        {Object.entries(byProvider).map(([provider, opts]) => (
          <optgroup key={provider} label={provider}>
            {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </optgroup>
        ))}
      </select>
      {saving && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>saving…</span>}
      {saved && <span style={{ fontSize: 11, color: "var(--success)" }}>✓ saved</span>}
      {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
