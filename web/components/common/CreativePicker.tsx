"use client";
import { useEffect, useRef, useState } from "react";
import {
  getDriveStatus,
  getDefaultCreatives,
  type DriveFile,
} from "@/services/settings.service";

/* Single, reusable creative picker — used by Snap / Meta / TikTok create forms.
   Auto-loads media from the shared Google Drive folder (server-configured) and
   presents a searchable dropdown. No folder URLs, no folder IDs, no Load button.
   Selecting a file yields its Drive file id; the backend downloads it via OAuth. */

function fmtSize(size?: string): string {
  const n = Number(size);
  if (!isFinite(n) || n <= 0) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} KB`;
  return `${n} B`;
}

function isVideo(mime: string) { return mime.startsWith("video/"); }
function fileIcon(mime: string): string {
  if (isVideo(mime)) return "🎬";
  if (mime.startsWith("image/")) return "🖼";
  return "📄";
}
function kindLabel(mime: string): string {
  if (isVideo(mime)) return "Video";
  if (mime.startsWith("image/")) return "Image";
  return "File";
}

export function CreativePicker({
  selectedFileId,
  onSelect,
}: {
  selectedFileId: string | null;
  onSelect: (fileId: string, file: DriveFile) => void;
}) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Auto-load creatives on mount (after confirming Drive is connected).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getDriveStatus();
        if (cancelled) return;
        setConnected(s.connected);
        if (!s.connected) { setLoading(false); return; }
        const res = await getDefaultCreatives();
        if (cancelled) return;
        setFiles(res.files);
      } catch {
        if (!cancelled) setError("Unable to load creatives.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Close dropdown on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const selected = files.find((f) => f.id === selectedFileId) ?? null;
  const filtered = query.trim()
    ? files.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()))
    : files;

  /* Drive not connected */
  if (connected === false) {
    return (
      <div style={stateStyle}>
        <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>Google Drive is not connected</div>
        <div style={{ fontSize: 11.5 }}>Connect it on the Telegram page (Connect Google Drive), then reopen this form.</div>
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ position: "relative", display: "grid", gap: 10 }}>
      {/* Combobox trigger */}
      <button
        type="button"
        onClick={() => !loading && !error && setOpen((v) => !v)}
        disabled={loading || !!error}
        style={triggerStyle}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {loading ? (
            <><Spinner /> <span style={{ color: "var(--text-secondary)" }}>Loading creatives…</span></>
          ) : selected ? (
            <>
              <span style={{ fontSize: 15 }}>{fileIcon(selected.mimeType)}</span>
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span style={{ color: "var(--text-tertiary)" }}>Select creative…</span>
          )}
        </span>
        <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>▾</span>
      </button>

      {/* Dropdown panel */}
      {open && !loading && !error && (
        <div style={panelStyle}>
          {files.length > 5 && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search creative…"
              style={searchStyle}
            />
          )}
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "12px", fontSize: 12, color: "var(--text-tertiary)", textAlign: "center" }}>
                No matches
              </div>
            ) : filtered.map((f) => {
              const active = f.id === selectedFileId;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => { onSelect(f.id, f); setOpen(false); setQuery(""); }}
                  style={{ ...optionStyle, ...(active ? { background: "var(--accent-bg)" } : {}) }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--bg-card-hover)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 16 }}>{fileIcon(f.mimeType)}</span>
                  <span className="truncate" style={{ flex: 1, fontSize: 13, textAlign: "left" }}>{f.name}</span>
                  <span style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{fmtSize(f.size)}</span>
                  {active && <span style={{ color: "var(--accent)", fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty / error states */}
      {!loading && error && <div style={errStyle}>{error}</div>}
      {!loading && !error && files.length === 0 && (
        <div style={stateStyle}>No creatives found in Google Drive.</div>
      )}

      {/* Selected creative summary */}
      {selected && (
        <div style={selectedBlockStyle}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 6 }}>
            Selected Creative
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{fileIcon(selected.mimeType)}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>{selected.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                {kindLabel(selected.mimeType)} • {fmtSize(selected.size) || "—"}
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success)", whiteSpace: "nowrap" }}>✓ Ready</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 12, height: 12,
      border: "2px solid var(--border-default)", borderTopColor: "var(--accent)",
      borderRadius: "50%", animation: "adp-spin 0.7s linear infinite", verticalAlign: "-2px",
    }} />
  );
}

const triggerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  width: "100%",
  background: "var(--bg-input)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-sm)",
  padding: "8px 10px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "var(--font-body)",
  cursor: "pointer",
  textAlign: "left",
};

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: 42,
  left: 0,
  right: 0,
  zIndex: 50,
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-sm)",
  boxShadow: "0 12px 32px oklch(0 0 0 / 0.4)",
  overflow: "hidden",
};

const searchStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-input)",
  border: "none",
  borderBottom: "1px solid var(--border-subtle)",
  padding: "9px 12px",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
};

const optionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "9px 12px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  transition: "background 0.1s ease",
};

const selectedBlockStyle: React.CSSProperties = {
  background: "var(--accent-bg)",
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
  padding: "10px 12px",
};

const stateStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  textAlign: "center",
  padding: "14px 12px",
  border: "1px dashed var(--border-subtle)",
  borderRadius: "var(--radius-sm)",
  lineHeight: 1.5,
};

const errStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--danger)",
  background: "var(--danger-bg)",
  padding: "10px 12px",
  borderRadius: "var(--radius-sm)",
};
