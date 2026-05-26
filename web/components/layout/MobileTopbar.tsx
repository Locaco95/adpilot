"use client";
import { usePathname } from "next/navigation";

const PAGE_LABELS: Record<string, string> = {
  "/overview":  "Overview",
  "/actions":   "Actions",
  "/campaigns": "Campaigns",
  "/creative":  "Creative Hub",
  "/telegram":  "Telegram",
  "/audit":     "Audit Log",
};

interface MobileTopbarProps {
  onMenuClick: () => void;
}

export function MobileTopbar({ onMenuClick }: MobileTopbarProps) {
  const pathname = usePathname();
  const label =
    Object.entries(PAGE_LABELS).find(([path]) =>
      pathname.startsWith(path)
    )?.[1] ?? "AdPilot";

  return (
    <div className="mobile-topbar">
      <button
        className="hamburger-btn"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <span />
        <span />
        <span />
      </button>
      <div className="mobile-topbar-logo">
        <div className="mobile-topbar-logo-mark">▲</div>
        <span className="mobile-topbar-page">{label}</span>
      </div>
      <div className="mobile-topbar-right">
        <span className="mobile-status-dot" title="System healthy" />
      </div>
    </div>
  );
}
