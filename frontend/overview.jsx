/* Overview Dashboard Page */
function OverviewPage() {
  const spendSparkData = DAILY_METRICS.map(d => d.spend.total);
  const convSparkData = DAILY_METRICS.map(d => d.conversions.total);
  const revSparkData = DAILY_METRICS.map(d => d.revenue.total);
  const roasSparkData = DAILY_METRICS.map(d => d.roas);
  const cpaSparkData = DAILY_METRICS.map(d => d.cpa);

  const chartData = DAILY_METRICS.map(d => ({
    label: d.label,
    meta: d.spend.meta,
    tiktok: d.spend.tiktok,
    snapchat: d.spend.snapchat,
  }));

  const totalSpend7d = SUMMARY_KPIS.spend;
  const platformSpendData = [
    { label: 'Meta', value: DAILY_METRICS.slice(-7).reduce((s, d) => s + d.spend.meta, 0), color: 'var(--meta)' },
    { label: 'TikTok', value: DAILY_METRICS.slice(-7).reduce((s, d) => s + d.spend.tiktok, 0), color: 'var(--tiktok)' },
    { label: 'Snapchat', value: DAILY_METRICS.slice(-7).reduce((s, d) => s + d.spend.snapchat, 0), color: 'var(--snapchat)' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Overview</div>
          <div className="page-subtitle">7-day rolling performance · Last sync 2 min ago</div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost btn-sm">Export</button>
          <button className="btn btn-ghost btn-sm">7d ▾</button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid fade-in">
        <KPICard label="Total Spend" value={SUMMARY_KPIS.spend} delta={SUMMARY_KPIS.spendDelta}
          prefix="$" sparkData={spendSparkData} />
        <KPICard label="Conversions" value={SUMMARY_KPIS.conversions} delta={SUMMARY_KPIS.convDelta}
          sparkData={convSparkData} accentColor="var(--success)" />
        <KPICard label="Revenue" value={SUMMARY_KPIS.revenue} delta={SUMMARY_KPIS.revDelta}
          prefix="$" sparkData={revSparkData} accentColor="var(--success)" />
        <KPICard label="Blended ROAS" value={SUMMARY_KPIS.roas.toFixed(2)} delta={SUMMARY_KPIS.roasDelta}
          suffix="×" sparkData={roasSparkData} accentColor="var(--accent)" />
        <KPICard label="Blended CPA" value={SUMMARY_KPIS.cpa.toFixed(2)} delta={-SUMMARY_KPIS.cpaDelta}
          prefix="$" sparkData={cpaSparkData}
          accentColor={SUMMARY_KPIS.cpa > TARGET_CPA ? 'var(--danger)' : 'var(--success)'} />
      </div>

      {/* Charts row */}
      <div className="grid-2-1 fade-in fade-in-1">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Daily Spend by Platform</span>
            <span className="text-xs text-tertiary">14-day view</span>
          </div>
          <AreaChart
            data={chartData}
            keys={['snapchat', 'tiktok', 'meta']}
            colors={['var(--snapchat)', 'var(--tiktok)', 'var(--meta)']}
            labels={['Snapchat', 'TikTok', 'Meta']}
            height={170}
          />
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Spend Distribution</span>
          </div>
          <DonutChart
            segments={platformSpendData}
            centerLabel="7d total"
            centerValue={formatCurrency(totalSpend7d)}
            size={110}
          />
        </div>
      </div>

      {/* Anomalies + Top campaigns */}
      <div className="grid-2 fade-in fade-in-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Active Anomalies</span>
            <span className="badge badge-danger">{ANOMALIES.filter(a => a.severity === 'critical').length} critical</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ANOMALIES.map(anomaly => (
              <AnomalyRow key={anomaly.id} anomaly={anomaly} />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Platform ROAS</span>
            <span className="text-xs text-tertiary">7-day</span>
          </div>
          <HBar items={[
            {
              label: 'Meta', color: 'var(--meta)',
              value: DAILY_METRICS.slice(-7).reduce((s, d) => s + d.revenue.meta, 0) / DAILY_METRICS.slice(-7).reduce((s, d) => s + d.spend.meta, 0),
              display: (DAILY_METRICS.slice(-7).reduce((s, d) => s + d.revenue.meta, 0) / DAILY_METRICS.slice(-7).reduce((s, d) => s + d.spend.meta, 0)).toFixed(2) + '×',
            },
            {
              label: 'TikTok', color: 'var(--tiktok)',
              value: DAILY_METRICS.slice(-7).reduce((s, d) => s + d.revenue.tiktok, 0) / DAILY_METRICS.slice(-7).reduce((s, d) => s + d.spend.tiktok, 0),
              display: (DAILY_METRICS.slice(-7).reduce((s, d) => s + d.revenue.tiktok, 0) / DAILY_METRICS.slice(-7).reduce((s, d) => s + d.spend.tiktok, 0)).toFixed(2) + '×',
            },
            {
              label: 'Snapchat', color: 'var(--snapchat)',
              value: DAILY_METRICS.slice(-7).reduce((s, d) => s + d.revenue.snapchat, 0) / DAILY_METRICS.slice(-7).reduce((s, d) => s + d.spend.snapchat, 0),
              display: (DAILY_METRICS.slice(-7).reduce((s, d) => s + d.revenue.snapchat, 0) / DAILY_METRICS.slice(-7).reduce((s, d) => s + d.spend.snapchat, 0)).toFixed(2) + '×',
            },
          ]} maxValue={4} />
          <div style={{ marginTop: 12, padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Target ROAS</span>
              <span className="text-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{TARGET_ROAS.toFixed(1)}×</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top campaigns */}
      <div className="card fade-in fade-in-3" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Top Campaigns by ROAS</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}></th>
              <th>Campaign</th>
              <th>Status</th>
              <th>7d Spend</th>
              <th>Conv</th>
              <th>CPA</th>
              <th>ROAS</th>
              <th>CTR</th>
              <th>Freq</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...CAMPAIGNS].sort((a, b) => b.roas - a.roas).slice(0, 6).map(c => (
              <tr key={c.id}>
                <td><span className={`platform-dot ${c.platform}`}></span></td>
                <td style={{ maxWidth: 240 }} className="truncate">{c.name}</td>
                <td><StatusBadge status={c.status} /></td>
                <td className="mono">{formatCurrency(c.spend7d)}</td>
                <td className="mono">{c.conv7d}</td>
                <td className="mono" style={{ color: c.cpa > TARGET_CPA ? 'var(--danger)' : 'var(--success)' }}>
                  ${c.cpa.toFixed(2)}
                </td>
                <td className="mono" style={{ color: c.roas >= TARGET_ROAS ? 'var(--success)' : c.roas >= 1.5 ? 'var(--warning)' : 'var(--danger)' }}>
                  {c.roas.toFixed(2)}×
                </td>
                <td className="mono">{c.ctr.toFixed(1)}%</td>
                <td className="mono">{c.freq.toFixed(1)}</td>
                <td><TrendArrow trend={c.trend} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Anomaly Row ──────────────────────────────────────── */
function AnomalyRow({ anomaly }) {
  const sevColors = {
    critical: { bg: 'var(--danger-bg)', color: 'var(--danger)', icon: '🔴' },
    warning: { bg: 'var(--warning-bg)', color: 'var(--warning)', icon: '🟡' },
    info: { bg: 'var(--info-bg)', color: 'var(--info)', icon: '🔵' },
  };
  const sev = sevColors[anomaly.severity];

  return (
    <div style={{
      background: sev.bg, border: `1px solid ${sev.color}22`,
      borderRadius: 'var(--radius-sm)', padding: '10px 12px',
    }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <div className="flex items-center gap-8" style={{ gap: 8 }}>
          <PlatformTag platform={anomaly.platform} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{anomaly.title}</span>
        </div>
        <span className="text-xs text-tertiary">{timeAgo(anomaly.timestamp)}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
        {anomaly.detail}
      </div>
      <div className="flex items-center gap-8 mt-8" style={{ gap: 12, marginTop: 8 }}>
        <span className="text-mono text-xs">{anomaly.metric}: <strong style={{ color: sev.color }}>{anomaly.value}</strong></span>
        <span className="text-mono text-xs">Baseline: {anomaly.baseline}</span>
        <span className="text-mono text-xs">z={anomaly.zScore.toFixed(1)}</span>
      </div>
    </div>
  );
}

Object.assign(window, { OverviewPage, AnomalyRow });
