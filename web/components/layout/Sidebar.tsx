"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";

/* SVG icons — no Unicode, renders on every OS/font */
const ICONS = {
  overview: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  actions: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  campaigns: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  creative: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  ),
  assistant: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  telegram: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.86 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.77 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  audit: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
};

const NAV_ITEMS = [
  { id: "assistant", icon: ICONS.assistant, label: "Assistant",    href: "/assistant" },
  { id: "overview",  icon: ICONS.overview,  label: "Overview",     href: "/overview" },
  { id: "actions",   icon: ICONS.actions,   label: "Actions",      href: "/actions",   badge: 3 },
  { id: "campaigns", icon: ICONS.campaigns, label: "Campaigns",    href: "/campaigns" },
  { id: "creative",  icon: ICONS.creative,  label: "Creative Hub", href: "/creative" },
  { id: "telegram",  icon: ICONS.telegram,  label: "Telegram",     href: "/telegram" },
  { id: "audit",     icon: ICONS.audit,     label: "Audit Log",    href: "/audit" },
] as const;

/* ── AI Runtime Widget ───────────────────────────────────── */
function SidebarRuntime() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = tick % 60;
  const lastUpdate = secs === 0 ? "just now" : `${secs}s ago`;
  const syncs = [
    { label: "Meta", status: "healthy" },
    { label: "TikTok", status: "delayed" },
    { label: "Snapchat", status: "healthy" },
  ] as const;
  const statusColor = {
    healthy: "var(--success)",
    delayed: "var(--warning)",
    degraded: "var(--danger)",
  };

  return (
    <div
      style={{
        background: "oklch(0.16 0.012 260)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        padding: "9px 11px",
        marginBottom: 6,
        transition: "box-shadow 0.2s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow =
          "0 0 0 1px oklch(0.75 0.14 75 / 0.15), 0 4px 16px oklch(0.75 0.14 75 / 0.06)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 7,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--success)",
              display: "inline-block",
              boxShadow: "0 0 0 2px oklch(0.72 0.17 145 / 0.25)",
              animation: "pulse-dot 2s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
            }}
          >
            AI Runtime
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)",
          }}
        >
          {lastUpdate}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "4px 8px",
          marginBottom: 7,
        }}
      >
        {[
          { label: "Agents",  value: "5",    color: "var(--accent)" },
          { label: "Pending", value: "3",    color: "var(--warning)" },
          { label: "Latency", value: "1.2s", color: "var(--text-primary)" },
          { label: "API",     value: "OK",   color: "var(--success)" },
        ].map((m) => (
          <div key={m.label}>
            <div
              style={{
                fontSize: 9,
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 1,
              }}
            >
              {m.label}
            </div>
            <div
              style={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                color: m.color,
              }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {syncs.map((s) => (
          <div
            key={s.label}
            style={{ display: "flex", alignItems: "center", gap: 3, flex: 1 }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: statusColor[s.status],
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                color: "var(--text-tertiary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Operator Card ───────────────────────────────────────── */
function OperatorCard() {
  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, oklch(0.18 0.015 260) 0%, oklch(0.16 0.012 240) 100%)",
        border: "1px solid oklch(0.75 0.14 75 / 0.18)",
        borderRadius: 8,
        padding: "9px 11px",
        marginBottom: 6,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background:
            "linear-gradient(90deg, var(--accent) 0%, oklch(0.65 0.16 55) 100%)",
          borderRadius: "10px 10px 0 0",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginTop: 4,
        }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background:
                "linear-gradient(135deg, var(--accent) 0%, oklch(0.65 0.16 55) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text-inverse)",
              fontFamily: "var(--font-display)",
              boxShadow: "0 2px 8px oklch(0.75 0.14 75 / 0.3)",
            }}
          >
            AG
          </div>
          <span
            style={{
              position: "absolute",
              bottom: -1,
              right: -1,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--success)",
              border: "1.5px solid oklch(0.16 0.012 240)",
            }}
          />
        </div>
        <div style={{ overflow: "hidden", flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Ahmed Galal
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              marginTop: 1,
              whiteSpace: "nowrap",
            }}
          >
            Lead Media Operator
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          paddingTop: 7,
          borderTop: "1px solid oklch(0.75 0.14 75 / 0.1)",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        {[
          { label: "Workspace", value: "KSA DTC Beauty" },
          { label: "Session",   value: "Active" },
        ].map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 9,
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color:
                  row.label === "Session"
                    ? "var(--success)"
                    : "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Sidebar ─────────────────────────────────────────────── */
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? "overlay-visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">▲</div>
          <div className="sidebar-logo-text">
            ad<span>pilot</span>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Command Center</div>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`sidebar-item ${active ? "active" : ""}`}
                  onClick={onClose}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  <span className="sidebar-label">{item.label}</span>
                  {"badge" in item && item.badge > 0 && (
                    <span className="sidebar-badge">{item.badge}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <SidebarRuntime />
          <OperatorCard />
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: "100%",
              padding: "7px 10px",
              background: "none",
              border: "none",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-tertiary)",
              fontSize: 11,
              fontFamily: "var(--font-body)",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "oklch(0.22 0.01 260)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.color = "var(--text-tertiary)";
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
