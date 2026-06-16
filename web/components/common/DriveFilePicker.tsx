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

function fileIcon(mime: string): string {
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("image/")) return "🖼";
  return "📄";
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
    if (!folderUrl.trim()) return;
    setLoading(true);
    setError(null);
    setFiles([]);
    setLoaded(false);
    try {
      const res = await getDriveFolder(folderUrl.trim());
      setFiles(res.files);
      setLoaded(true);
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to load folder");
    } finally {
      setLoading(false);
    }
  }

  if (connected === false) {
    return (
      <div style={hintStyle}>
        Google Drive isn’t connected. Open the <strong>Telegram</strong> page and click
        <strong> Connect Google Drive</strong>, then come back to pick a creative.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={inputStyle}
          value={folderUrl}
          onChange={(e) => setFolderUrl(e.target.value)}
          placeholder="Paste a Google Drive folder link or id"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); loadFiles(); } }}
        />
        <button
          type="button"
          onClick={loadFiles}
          disabled={loading || !folderUrl.trim() || connected === null}
          style={loadBtnStyle}
        >
          {loading ? "Loading…" : "Load files"}
        </button>
      </div>

      {error && <div style={errStyle}>{error}</div>}

      {loaded && files.length === 0 && !error && (
        <div style={hintStyle}>No images or videos found in that folder.</div>
      )}

      {files.length > 0 && (
        <div style={listStyle}>
          {files.map((f) => {
            const active = f.id === selectedFileId;
            return (
              <label key={f.id} style={{ ...rowStyle, ...(active ? rowActiveStyle : {}) }}>
                <input
                  type="radio"
                  name="drive-file"
                  checked={active}
                  onChange={() => onSelect(f.id, f)}
                  style={{ accentColor: "var(--accent)" }}
                />
                <span style={{ fontSize: 15 }}>{fileIcon(f.mimeType)}</span>
                <span className="truncate" style={{ flex: 1, fontSize: 13 }}>{f.name}</span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                  {fmtSize(f.size)}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  padding: "8px 14px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-default)",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  maxHeight: 220,
  overflowY: "auto",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-sm)",
  padding: 4,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "7px 8px",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
};

const rowActiveStyle: React.CSSProperties = {
  background: "var(--accent-bg)",
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-sm)",
  padding: "10px 12px",
  lineHeight: 1.5,
};

const errStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--danger)",
  background: "var(--danger-bg)",
  padding: "8px 10px",
  borderRadius: "var(--radius-sm)",
};
