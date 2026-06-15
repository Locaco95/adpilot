"use client";
import { useEffect, useRef, useState } from "react";
import { getLLMModel, setLLMModel, type LLMModelOption } from "@/services/settings.service";

/* Picks the AI model the Telegram agent uses. Persisted on the backend.
   Custom dropdown (not a native <select>) so the long list scrolls inside a
   fixed-height panel instead of overflowing off-screen. */
export function ModelSelector() {
  const [options, setOptions] = useState<LLMModelOption[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getLLMModel()
      .then((s) => { setOptions(s.options); setCurrent(s.current); })
      .catch((e) => setError((e as Error)?.message ?? "Failed to load models"));
  }, []);

  // close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function pick(id: string) {
    setOpen(false);
    if (id === current) return;
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

  const byProvider = options.reduce<Record<string, LLMModelOption[]>>((acc, o) => {
    (acc[o.provider] ??= []).push(o);
    return acc;
  }, {});
  const currentLabel = options.find((o) => o.id === current)?.label ?? "Loading…";

  return (
    <div ref={ref} style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600 }}>AI model</span>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving || options.length === 0}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)", padding: "6px 10px", color: "var(--text-primary)",
          fontSize: 12, cursor: "pointer", minWidth: 200,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentLabel}</span>
        <span style={{ color: "var(--text-tertiary)", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
            minWidth: 240, maxHeight: 360, overflowY: "auto",
            background: "var(--bg-elevated, var(--bg-card))", border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)", boxShadow: "0 8px 28px rgba(0,0,0,0.35)", padding: 4,
          }}
        >
          {Object.entries(byProvider).map(([provider, opts]) => (
            <div key={provider}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                color: "var(--text-tertiary)", padding: "8px 10px 4px",
              }}>{provider}</div>
              {opts.map((o) => {
                const active = o.id === current;
                return (
                  <div
                    key={o.id}
                    onClick={() => pick(o.id)}
                    style={{
                      padding: "7px 10px", fontSize: 12.5, borderRadius: 4, cursor: "pointer",
                      color: active ? "var(--accent)" : "var(--text-primary)",
                      background: active ? "var(--bg-surface)" : "transparent",
                      fontWeight: active ? 600 : 400,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--bg-surface)"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    {o.label}{active && <span style={{ fontSize: 11 }}>✓</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {saving && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>saving…</span>}
      {saved && <span style={{ fontSize: 11, color: "var(--success)" }}>✓ saved</span>}
      {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
