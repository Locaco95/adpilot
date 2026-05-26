const { useState, useEffect, useRef, useMemo } = React;

/* ── Sidebar ──────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'overview', icon: '◫', label: 'Overview' },
  { id: 'actions', icon: '⚡', label: 'Actions', badge: 3 },
  { id: 'campaigns', icon: '◩', label: 'Campaigns' },
  { id: 'creative', icon: '✦', label: 'Creative Hub' },
  { id: 'telegram', icon: '▷', label: 'Telegram', },
  { id: 'audit', icon: '☰', label: 'Audit Log' },
];

function Sidebar({ activePage, onNavigate, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">▲</div>
        <div className="sidebar-logo-text">ad<span>pilot</span></div>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-label">Command Center</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`sidebar-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {item.label}
              {item.badge > 0 && <span className="sidebar-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>
      </div>
      <div className="sidebar-footer">
        {onLogout && (
          <button onClick={onLogout} style={{
            marginTop: 10, background: 'none', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', padding: '5px 10px', color: 'var(--text-tertiary)',
            fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer', width: '100%',
            transition: 'all 0.15s ease',
          }}
            onMouseEnter={e => { e.target.style.color = 'var(--danger)'; e.target.style.borderColor = 'var(--danger)'; }}
            onMouseLeave={e => { e.target.style.color = 'var(--text-tertiary)'; e.target.style.borderColor = 'var(--border-subtle)'; }}
          >Sign Out</button>
        )}
      </div>
    </aside>
  );
}

/* ── KPI Card ─────────────────────────────────────────── */
function KPICard({ label, value, delta, prefix, suffix, sparkData, accentColor }) {
  const deltaClass = delta > 0.5 ? 'positive' : delta < -0.5 ? 'negative' : 'neutral';
  const arrow = delta > 0.5 ? '↑' : delta < -0.5 ? '↓' : '→';

  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={accentColor ? { color: accentColor } : {}}>
        {prefix}{typeof value === 'number' ? formatNum(value) : value}{suffix}
      </div>
      <div className={`kpi-delta ${deltaClass}`}>
        {arrow} {Math.abs(delta).toFixed(1)}% vs prev 7d
      </div>
      {sparkData && <Sparkline data={sparkData} color={accentColor || 'var(--accent)'} />}
    </div>
  );
}

/* ── Sparkline ────────────────────────────────────────── */
function Sparkline({ data, color = 'var(--accent)', height = 28, width = '100%' }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const svgW = 120;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * svgW;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = points + ` ${svgW},${height} 0,${height}`;

  return (
    <svg viewBox={`0 0 ${svgW} ${height}`} style={{ width, height, marginTop: 6, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Area Chart ───────────────────────────────────────── */
function AreaChart({ data, keys, colors, labels, height = 160 }) {
  const svgW = 500;
  const svgH = height;
  const pad = { top: 8, right: 8, bottom: 24, left: 48 };
  const chartW = svgW - pad.left - pad.right;
  const chartH = svgH - pad.top - pad.bottom;

  const totals = data.map(d => keys.reduce((s, k) => s + (d[k] || 0), 0));
  const maxVal = Math.max(...totals) * 1.1;

  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height }}>
      {/* Y-axis labels */}
      {yTicks.map((t, i) => {
        const y = pad.top + chartH - (t / maxVal) * chartH;
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={svgW - pad.right} y2={y}
              stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="3,3" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end"
              fill="var(--text-tertiary)" fontSize="9" fontFamily="var(--font-mono)">
              ${formatCompact(t)}
            </text>
          </g>
        );
      })}

      {/* Stacked areas */}
      {keys.map((key, ki) => {
        const prevKeys = keys.slice(0, ki);
        const pts = data.map((d, i) => {
          const x = pad.left + (i / (data.length - 1)) * chartW;
          const base = prevKeys.reduce((s, pk) => s + (d[pk] || 0), 0);
          const val = base + (d[key] || 0);
          const y = pad.top + chartH - (val / maxVal) * chartH;
          return { x, y };
        });
        const basePts = data.map((d, i) => {
          const x = pad.left + (i / (data.length - 1)) * chartW;
          const base = prevKeys.reduce((s, pk) => s + (d[pk] || 0), 0);
          const y = pad.top + chartH - (base / maxVal) * chartH;
          return { x, y };
        }).reverse();
        const allPts = [...pts, ...basePts];
        const pathD = allPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
        return <path key={key} d={pathD} fill={colors[ki]} opacity={0.7} />;
      })}

      {/* X-axis labels */}
      {data.map((d, i) => {
        if (i % 2 !== 0 && data.length > 8) return null;
        const x = pad.left + (i / (data.length - 1)) * chartW;
        return (
          <text key={i} x={x} y={svgH - 4} textAnchor="middle"
            fill="var(--text-tertiary)" fontSize="9" fontFamily="var(--font-mono)">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Horizontal Bar ───────────────────────────────────── */
function HBar({ items, maxValue }) {
  const mv = maxValue || Math.max(...items.map(i => i.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-4" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{item.label}</span>
            <span className="text-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.display}</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${(item.value / mv) * 100}%`, height: '100%',
              background: item.color, borderRadius: 3, transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Donut Chart ──────────────────────────────────────── */
function DonutChart({ segments, size = 100, thickness = 14, centerLabel, centerValue }) {
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let offset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dashLen = pct * circumference;
          const dashOff = -offset * circumference;
          offset += pct;
          return (
            <circle key={i} cx={c} cy={c} r={r}
              fill="none" stroke={seg.color} strokeWidth={thickness}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOff}
              transform={`rotate(-90 ${c} ${c})`}
              style={{ transition: 'all 0.6s ease' }}
            />
          );
        })}
        <text x={c} y={c - 5} textAnchor="middle" fill="var(--text-tertiary)" fontSize="9" fontFamily="var(--font-body)">{centerLabel}</text>
        <text x={c} y={c + 10} textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontWeight="700" fontFamily="var(--font-mono)">{centerValue}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-8" style={{ gap: 8 }}>
            <span className="platform-dot" style={{ background: seg.color }}></span>
            <span style={{ fontSize: 12 }}>{seg.label}</span>
            <span className="text-mono" style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
              {((seg.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Platform Tag ─────────────────────────────────────── */
function PlatformTag({ platform }) {
  const p = PLATFORMS[platform];
  if (!p) return null;
  return <span className={`platform-tag ${platform}`}>{p.icon} {p.name}</span>;
}

/* ── Tier Badge ───────────────────────────────────────── */
function TierBadge({ tier }) {
  const labels = { 1: 'T1 Auto', 2: 'T2 Notify', 3: 'T3 HITL' };
  return <span className={`badge-tier badge-tier-${tier}`}>{labels[tier]}</span>;
}

/* ── Status Badge ─────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    active: { cls: 'badge-success', label: '● Active' },
    warning: { cls: 'badge-warning', label: '▲ Warning' },
    paused: { cls: 'badge-neutral', label: '◼ Paused' },
    draft: { cls: 'badge-info', label: '◇ Draft' },
    approved: { cls: 'badge-success', label: '✓ Approved' },
    auto_approved: { cls: 'badge-warning', label: '⚡ Auto' },
    pending: { cls: 'badge-warning', label: '◌ Pending' },
  };
  const m = map[status] || map.active;
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

/* ── Trend Arrow ──────────────────────────────────────── */
function TrendArrow({ trend }) {
  if (trend === 'up') return <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 700 }}>↑</span>;
  if (trend === 'down') return <span style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 700 }}>↓</span>;
  return <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>→</span>;
}

/* ── Helpers ──────────────────────────────────────────── */
function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 10000) return (n / 1000).toFixed(1) + 'K';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function formatCompact(n) {
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toFixed(0);
}

function formatCurrency(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function timeAgo(isoStr) {
  const d = new Date(isoStr);
  const now = new Date('2026-05-25T09:00:00Z');
  const mins = Math.round((now - d) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/* ── Export ────────────────────────────────────────────── */
Object.assign(window, {
  Sidebar, KPICard, Sparkline, AreaChart, HBar, DonutChart,
  PlatformTag, TierBadge, StatusBadge, TrendArrow,
  formatNum, formatCompact, formatCurrency, timeAgo,
  NAV_ITEMS,
});
