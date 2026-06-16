"use client";
import { useEffect, useState } from "react";
import { getDriveStatus, getDriveAuthUrl } from "@/services/settings.service";

/* Shows Google Drive connection status + a Connect button.
   Connect opens Google consent in a new tab; user returns and we re-check. */
export function DriveConnect() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const s = await getDriveStatus();
      setConnected(s.connected);
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to check Drive");
    }
  }

  useEffect(() => { refresh(); }, []);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await getDriveAuthUrl();
      window.open(url, "_blank", "noopener");
      // poll for the connection to land after the user finishes consent
      const started = Date.now();
      const timer = setInterval(async () => {
        const s = await getDriveStatus().catch(() => null);
        if (s?.connected || Date.now() - started > 120000) {
          if (s?.connected) setConnected(true);
          clearInterval(timer);
          setBusy(false);
        }
      }, 3000);
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to start Drive connection");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600 }}>Google Drive</span>
      {connected === null ? (
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>…</span>
      ) : connected ? (
        <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 600 }}>● Connected</span>
      ) : (
        <button
          type="button"
          onClick={connect}
          disabled={busy}
          style={{
            background: "var(--accent)", color: "var(--text-inverse)", border: "none",
            borderRadius: "var(--radius-sm)", padding: "6px 12px", fontSize: 12, fontWeight: 600,
            cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Waiting for Google…" : "Connect Google Drive"}
        </button>
      )}
      {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
