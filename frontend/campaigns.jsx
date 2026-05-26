/* Campaigns Explorer Page */
function CampaignsPage() {
  const [platformFilter, setPlatformFilter] = useState('all');
  const [sortBy, setSortBy] = useState('roas');
  const [sortDir, setSortDir] = useState('desc');

  const filtered = CAMPAIGNS.filter(c =>
    platformFilter === 'all' || c.platform === platformFilter
  );

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === 'desc' ? -1 : 1;
    return mul * (a[sortBy] - b[sortBy]);
  });

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortHeader = ({ col, children }) => (
    <th onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      {children} {sortBy === col ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </th>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Campaigns</div>
          <div className="page-subtitle">All campaigns across Meta, TikTok, and Snapchat</div>
        </div>
      </div>

      {/* Platform filter */}
      <div className="tab-bar fade-in">
        {[
          { id: 'all', label: 'All Platforms' },
          { id: 'meta', label: 'Meta' },
          { id: 'tiktok', label: 'TikTok' },
          { id: 'snapchat', label: 'Snapchat' },
        ].map(t => (
          <button key={t.id} className={`tab-btn ${platformFilter === t.id ? 'active' : ''}`}
            onClick={() => setPlatformFilter(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Summary bar */}
      <div className="flex gap-12 mb-16 fade-in fade-in-1" style={{ gap: 12, marginBottom: 16 }}>
        <MiniStat label="Active" value={filtered.filter(c => c.status === 'active').length} color="var(--success)" />
        <MiniStat label="Warning" value={filtered.filter(c => c.status === 'warning').length} color="var(--warning)" />
        <MiniStat label="Paused" value={filtered.filter(c => c.status === 'paused').length} color="var(--text-tertiary)" />
        <MiniStat label="Avg ROAS"
          value={(filtered.reduce((s, c) => s + c.roas, 0) / filtered.length).toFixed(2) + '×'}
          color="var(--accent)" />
        <MiniStat label="Avg CPA"
          value={'$' + (filtered.reduce((s, c) => s + c.cpa, 0) / filtered.length).toFixed(2)}
          color="var(--info)" />
      </div>

      {/* Campaign table */}
      <div className="card fade-in fade-in-2">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}></th>
              <th>Campaign</th>
              <th>Status</th>
              <SortHeader col="budget">Budget/d</SortHeader>
              <SortHeader col="spend7d">7d Spend</SortHeader>
              <SortHeader col="conv7d">Conv</SortHeader>
              <SortHeader col="cpa">CPA</SortHeader>
              <SortHeader col="roas">ROAS</SortHeader>
              <SortHeader col="ctr">CTR</SortHeader>
              <SortHeader col="freq">Freq</SortHeader>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => (
              <tr key={c.id}>
                <td><span className={`platform-dot ${c.platform}`}></span></td>
                <td style={{ maxWidth: 260, fontWeight: 500 }} className="truncate">{c.name}</td>
                <td><StatusBadge status={c.status} /></td>
                <td className="mono">${c.budget}</td>
                <td className="mono">{formatCurrency(c.spend7d)}</td>
                <td className="mono">{c.conv7d}</td>
                <td className="mono" style={{
                  color: c.cpa > TARGET_CPA * 1.5 ? 'var(--danger)' : c.cpa > TARGET_CPA ? 'var(--warning)' : 'var(--success)'
                }}>${c.cpa.toFixed(2)}</td>
                <td className="mono" style={{
                  color: c.roas >= TARGET_ROAS ? 'var(--success)' : c.roas >= 1.5 ? 'var(--warning)' : 'var(--danger)'
                }}>{c.roas.toFixed(2)}×</td>
                <td className="mono">{c.ctr.toFixed(1)}%</td>
                <td className="mono" style={{
                  color: c.freq > 6 ? 'var(--danger)' : c.freq > 4 ? 'var(--warning)' : 'var(--text-secondary)'
                }}>{c.freq.toFixed(1)}</td>
                <td><TrendArrow trend={c.trend} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Threshold reference */}
      <div className="flex gap-12 mt-16 fade-in fade-in-3" style={{ gap: 12, marginTop: 20 }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px', flex: 1,
        }}>
          <span className="text-xs text-tertiary">Target CPA</span>
          <div className="text-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>${TARGET_CPA}</div>
        </div>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px', flex: 1,
        }}>
          <span className="text-xs text-tertiary">Target ROAS</span>
          <div className="text-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{TARGET_ROAS}×</div>
        </div>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px', flex: 1,
        }}>
          <span className="text-xs text-tertiary">Kill CPA</span>
          <div className="text-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>${(TARGET_CPA * 1.8).toFixed(0)}</div>
        </div>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px', flex: 1,
        }}>
          <span className="text-xs text-tertiary">Kill ROAS</span>
          <div className="text-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>0.8×</div>
        </div>
      </div>
    </div>
  );
}

/* ── Mini Stat ────────────────────────────────────────── */
function MiniStat({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-sm)', padding: '8px 14px', flex: 1, textAlign: 'center',
    }}>
      <div className="text-mono" style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

Object.assign(window, { CampaignsPage, MiniStat });
