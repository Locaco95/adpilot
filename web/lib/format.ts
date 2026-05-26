/* ── AdPilot — Formatting Utilities ────────────────────────────── */

function safe(n: unknown): number {
  const v = Number(n);
  return isFinite(v) ? v : 0;
}

export function formatCurrency(value: unknown): string {
  const v = safe(value);
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export function formatNumber(value: unknown): string {
  const v = safe(value);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatPercent(value: unknown, decimals = 1): string {
  return `${safe(value).toFixed(decimals)}%`;
}

export function formatRoas(value: unknown): string {
  return `${safe(value).toFixed(2)}×`;
}

export function formatDelta(value: unknown, suffix = "%"): string {
  const v = safe(value);
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}${suffix}`;
}
