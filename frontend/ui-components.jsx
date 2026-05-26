const { useState, useEffect, useRef, useMemo } = React;

/* ── Nav config ───────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'overview',  icon: '◫', label: 'Overview' },
  { id: 'actions',   icon: '⚡', label: 'Actions',     badge: 3 },
  { id: 'campaigns', icon: '◩', label: 'Campaigns' },
  { id: 'creative',  icon: '✦', label: 'Creative Hub' },
  { id: 'telegram',  icon: '▷', label: 'Telegram' },
  { id: 'audit',     icon: '☰', label: 'Audit Log' },
];

const PAGE_LABELS = {
  overview: 'Overview', actions: 'Actions', campaigns: 'Campaigns',
  creative: 'Creative Hub', telegram: 'Telegram', audit: 'Audit Log',
};

/* ── Mobile Topbar ────────────────────────────────────── */
function MobileTopbar({ activePage, onMenuClick }) {
  return (
    <div className="mobile-topbar">
      <button className="hamburger-btn" onClick={onMenuClick} aria-label="Open menu">
        <span /><span /><span />
      </button>
      <div className="mobile-topbar-logo">
        <div className="mobile-topbar-logo-mark">▲</div>
        <span className="mobile-topbar-page">{PAGE_LABELS[activePage] || 'AdPilot'}</span>
      </div>
      <div className="mobile-topbar-right">
        <span className="mobile-status-dot" title="System healthy" />
      </div>
    </div>
  );
}

/* ── Sidebar Runtime Status ───────────────────────────── */
function SidebarRuntime() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = tick % 60;
  const lastUpdate = secs === 0 ? 'just now' : `${secs}s ago`;

  const syncs = [
    { label: 'Meta',     status: 'healthy' },
    { label: 'TikTok',   status: 'delayed' },
    { label: 'Snapchat', status: 'healthy' },
  ];
  const statusColor = { healthy: 'var(--success)', delayed: 'var(--warning)', degraded: 'var(--danger)' };

  return (
    <div style={{
      background: 'oklch(0.16 0.012 260)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 10,
      padding: '10px 12px',
      marginBottom: 8,
      transition: 'box-shadow 0.2s ease',
      cursor: 'default',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 0 1px oklch(0.75 0.14 75 / 0.15), 0 4px 16px oklch(0.75 0.14 75 / 0.06)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--success)',
            display: 'inline-block',
            boxShadow: '0 0 0 2px oklch(0.72 0.17 145 / 0.25)',
            animation: 'pulse-dot 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>AI Runtime</span>
        </div>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{lastUpdate}</span>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 8px', marginBottom: 8 }}>
        {[
          { label: 'Agents', value: '5', color: 'var(--accent)' },
          { label: 'Pending', value: `${(PENDING_ACTIONS || []).filter(a => a.status === 'pending').length || 3}`, color: 'var(--warning)' },
          { label: 'Latency', value: '1.2s', color: 'var(--text-primary)' },
          { label: 'API', value: 'OK', color: 'var(--success)' },
        ].map(m => (
          <div key={m.label}>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>{m.label}</div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Platform sync row */}
      <div style={{ display: 'flex', gap: 6 }}>
        {syncs.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor[s.status], flexShrink: 0 }} />
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Operator Identity Card ───────────────────────────── */
function OperatorCard() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, oklch(0.18 0.015 260) 0%, oklch(0.16 0.012 240) 100%)',
      border: '1px solid oklch(0.75 0.14 75 / 0.18)',
      borderRadius: 10,
      padding: '10px 12px',
      marginBottom: 8,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Amber accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, var(--accent) 0%, oklch(0.65 0.16 55) 100%)',
        borderRadius: '10px 10px 0 0',
      }} />

      {/* Avatar + name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 4 }}>
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg, var(--accent) 0%, oklch(0.65 0.16 55) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: 'var(--text-inverse)',
            fontFamily: 'var(--font-display)',
            boxShadow: '0 2px 8px oklch(0.75 0.14 75 / 0.3)',
          }}>AG</div>
          {/* Online dot */}
          <span style={{
            position: 'absolute', bottom: -1, right: -1,
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--success)',
            border: '1.5px solid oklch(0.16 0.012 240)',
          }} />
        </div>

        {/* Name + role */}
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{
            fontSize: 12, fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>Ahmed Galal</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1, whiteSpace: 'nowrap' }}>Lead Media Operator</div>
        </div>
      </div>

      {/* Workspace + session row */}
      <div style={{
        marginTop: 9, paddingTop: 8,
        borderTop: '1px solid oklch(0.75 0.14 75 / 0.1)',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {[
          { label: 'Workspace', value: 'KSA DTC Beauty' },
          { label: 'Session',   value: 'Active' },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.label}</span>
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)',
              color: row.label === 'Session' ? 'var(--success)' : 'var(--text-secondary)',
              fontWeight: 600,
            }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Sidebar ──────────────────────────────────────────── */
function Sidebar({ activePage, onNavigate, onLogout, isOpen, onClose }) {
  // Close drawer on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && isOpen) onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  return (
    <>
      {/* Backdrop overlay — mobile only */}
      <div
        className={`sidebar-overlay ${isOpen ? 'overlay-visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
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
                onClick={() => { onNavigate(item.id); onClose?.(); }}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
                {item.badge > 0 && <span className="sidebar-badge">{item.badge}</span>}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Bottom operator block ── */}
        <div className="sidebar-footer" style={{ paddingTop: 12 }}>
          <SidebarRuntime />
          <OperatorCard />

          {/* Sign out — low emphasis */}
          {onLogout && (
            <button onClick={onLogout} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: '7px 10px',
              background: 'none', border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-tertiary)', fontSize: 11,
              fontFamily: 'var(--font-body)', cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'oklch(0.22 0.01 260)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          )}
        </div>

        <style>{`
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; box-shadow: 0 0 0 2px oklch(0.72 0.17 145 / 0.25); }
            50%       { opacity: 0.7; box-shadow: 0 0 0 4px oklch(0.72 0.17 145 / 0.1); }
          }
        `}</style>
      </aside>
    </>
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
