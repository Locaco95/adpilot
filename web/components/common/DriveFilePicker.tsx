"use client";
import { useEffect, useState } from "react";
import {
  getDriveStatus,
  getDriveFolder,
  type DriveFile,
} from "@/services/settings.service";

/* Reusable Google Drive media picker, shared by Snap / Meta / TikTok create forms.
   Connect Drive → paste a folder link → Load files → pick one → onSelect(fileId).
   No public links: the selected file is downloaded server-side via OAuth. */

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

/* Map raw backend errors to friendly copy. */
function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("not connected")) return "Google Drive is not connected. Connect your account first.";
  if (m.includes("access") || m.includes("403")) return "Access denied to that folder. Check sharing/permissions.";
  return "Unable to load folder. Check the folder link or ID.";
}

export function DriveFilePicker({
  selectedFileId,
  onSelect,
}: {
  selectedFileId: string | null;
  onSelect: (fileId: string, file: DriveFile) => void;
}) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [folderUrl, setFolderUrl] = useState("");
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDriveStatus()
      .then((s) => setConnected(s.connected))
      .catch(() => setConnected(false));
  }, []);

  async function loadFiles() {
    if (!folderUrl.trim() || loading) return;
    setLoading(true);
    setError(null);
    setFiles([]);
    setLoaded(false);
    try {
      const res = await getDriveFolder(folderUrl.trim());
      setFiles(res.files);
      setLoaded(true);
    } catch (e) {
      setError(friendlyError((e as Error)?.message ?? ""));
    } finally {
      setLoading(false);
    }
  }

  const selectedFile = files.find((f) => f.id === selectedFileId) ?? null;

  /* ── Drive not connected ── */
  if (connected === false) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Google Drive is not connected</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Connect your account on the <strong>Telegram</strong> page (Connect Google Drive), then return to pick a creative.
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {/* Folder input + Load */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={inputStyle}
          value={folderUrl}
          onChange={(e) => setFolderUrl(e.target.value)}
          placeholder="Folder link or ID"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); loadFiles(); } }}
        />
        <button
          type="button"
          onClick={loadFiles}
          disabled={loading || !folderUrl.trim() || connected === null}
          style={{ ...loadBtnStyle, opacity: loading || !folderUrl.trim() ? 0.55 : 1 }}
        >
          {loading ? <><Spinner /> Loading…</> : "Load files"}
        </button>
      </div>

      {/* Selected creative summary */}
      {selectedFile && (
        <div style={selectedBlockStyle}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 6 }}>
            Selected Creative
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{fileIcon(selectedFile.mimeType)}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>{selectedFile.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                {kindLabel(selectedFile.mimeType)} • {fmtSize(selectedFile.size) || "—"}
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success)", whiteSpace: "nowrap" }}>✓ Ready</span>
          </div>
        </div>
      )}

      {/* States */}
      {loading && (
        <div style={stateStyle}>
          <Spinner /> Loading files from Google Drive…
        </div>
      )}

      {!loading && error && (
        <div style={errStyle}>{error}</div>
      )}

      {!loading && !error && loaded && files.length === 0 && (
        <div style={stateStyle}>No images or videos found in this folder.</div>
      )}

      {!loading && !error && !loaded && (
        <div style={stateStyle}>
          <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>No files loaded yet</div>
          <div style={{ fontSize: 11.5 }}>Paste a Google Drive folder link or ID and click “Load files”.</div>
        </div>
      )}

      {/* Loaded file cards */}
      {!loading && files.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600 }}>
            Loaded {files.length} file{files.length === 1 ? "" : "s"}
          </div>
          <div style={listStyle}>
            {files.map((f) => {
              const active = f.id === selectedFileId;
              return (
                <label key={f.id} style={{ ...fileCardStyle, ...(active ? fileCardActiveStyle : {}) }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--bg-card-hover)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "var(--bg-card)"; }}
                >
                  <input
                    type="radio"
                    name="drive-file"
                    checked={active}
                    onChange={() => onSelect(f.id, f)}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <span style={{ fontSize: 17 }}>{fileIcon(f.mimeType)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="truncate" style={{ fontSize: 13, fontWeight: active ? 600 : 500 }}>{f.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                      {kindLabel(f.mimeType)} • {fmtSize(f.size) || "—"}
                    </div>
                  </div>
                  {active && <span style={{ color: "var(--accent)", fontWeight: 700 }}>✓</span>}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 12, height: 12,
        border: "2px solid var(--border-default)",
        borderTopColor: "var(--accent)",
        borderRadius: "50%",
        animation: "adp-spin 0.7s linear infinite",
        verticalAlign: "-2px",
        marginRight: 6,
      }}
    />
  );
}

const cardStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  padding: 12,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "var(--bg-input)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-sm)",
  padding: "8px 10px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "var(--font-body)",
  outline: "none",
};

const loadBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 14px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-default)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const selectedBlockStyle: React.CSSProperties = {
  background: "var(--accent-bg)",
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
  padding: "10px 12px",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  maxHeight: 240,
  overflowY: "auto",
};

const fileCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 10px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-subtle)",
  background: "var(--bg-card)",
  cursor: "pointer",
  transition: "background 0.12s ease, border-color 0.12s ease",
};

const fileCardActiveStyle: React.CSSProperties = {
  border: "1px solid var(--accent)",
  background: "var(--accent-bg)",
};

const stateStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  textAlign: "center",
  padding: "16px 12px",
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
  lineHeight: 1.5,
};
