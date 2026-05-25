/* Telegram Preview + Audit Log Pages */

/* ── Telegram Preview ─────────────────────────────────── */
function TelegramPage() {
  const [msgStates, setMsgStates] = useState({});

  const handleTgAction = (msgId, action) => {
    setMsgStates(prev => ({ ...prev, [msgId]: action }));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Telegram</div>
          <div className="page-subtitle">Approval workflow preview · Bot @adpilot_bot</div>
        </div>
      </div>

      <div className="grid-2 fade-in" style={{ alignItems: 'start' }}>
        {/* Chat mockup */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            background: 'oklch(0.22 0.02 240)',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), oklch(0.65 0.16 55))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: 'var(--text-inverse)',
            }}>▲</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>AdPilot Bot</div>
              <div style={{ fontSize: 11, color: 'var(--success)' }}>● online</div>
            </div>
          </div>

          <div style={{
            padding: '16px',
            display: 'flex', flexDirection: 'column', gap: 12,
            maxHeight: 520, overflowY: 'auto',
            background: 'oklch(0.14 0.012 260)',
          }}>
            {TELEGRAM_MESSAGES.map(msg => (
              <TelegramBubble key={msg.id} msg={msg}
                state={msgStates[msg.id]}
                onAction={handleTgAction} />
            ))}
          </div>

          {/* Input bar */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-surface)',
          }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>/</span>
            <input type="text" placeholder="Type a command... /status /digest /halt"
              style={{
                flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)', padding: '7px 10px', color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none',
              }} />
          </div>
        </div>

        {/* Commands reference */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Operator Commands</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { cmd: '/status', desc: 'Current system status and active campaigns' },
                { cmd: '/digest', desc: 'Trigger an immediate performance digest' },
                { cmd: '/halt', desc: 'Emergency stop — pause all write actions' },
                { cmd: '/resume', desc: 'Resume after halt' },
                { cmd: '/pause <id>', desc: 'Pause a specific campaign by ID' },
                { cmd: '/pending', desc: 'List all pending Tier 3 approvals' },
              ].map((c, i) => (
                <div key={i} className="flex items-center gap-8" style={{ gap: 10 }}>
                  <code style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    background: 'var(--bg-surface)', padding: '2px 8px',
                    borderRadius: 3, color: 'var(--accent)', minWidth: 100,
                  }}>{c.cmd}</code>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Automation Tiers</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TierExplainer tier={1} label="Autonomous"
                desc="Read-only analysis, draft generation, anomaly pauses, digests"
                color="var(--success)" />
              <TierExplainer tier={2} label="Auto + Notification"
                desc="Small budget shifts (<20%, <$200), fatigue pauses. 5-min revoke window"
                color="var(--warning)" />
              <TierExplainer tier={3} label="Human-in-the-Loop"
                desc="New campaigns, budget increases >20%, audience changes, creative publishing"
                color="var(--danger)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Telegram Bubble ──────────────────────────────────── */
function TelegramBubble({ msg, state, onAction }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '12px 12px 12px 4px',
      padding: '12px 14px',
      maxWidth: '100%',
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{
        fontSize: 12.5, lineHeight: 1.65, color: 'var(--text-primary)',
        whiteSpace: 'pre-line', fontFamily: 'var(--font-body)',
      }}>
        {msg.text.split('\n').map((line, i) => {
          let processed = line
            .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
            .replace(/•/g, '<span style="color:var(--accent)">•</span>');
          return <div key={i} dangerouslySetInnerHTML={{ __html: processed }} />;
        })}
      </div>

      {msg.buttons.length > 0 && !state && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {msg.buttons.map((btn, i) => (
            <button key={i} onClick={() => onAction(msg.id, btn)}
              style={{
                padding: '6px 14px', borderRadius: 6,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)', color: 'var(--text-primary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => e.target.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.target.style.background = 'var(--bg-surface)'}
            >{btn}</button>
          ))}
        </div>
      )}

      {state && (
        <div style={{
          marginTop: 8, fontSize: 11, fontWeight: 600,
          color: state.includes('Approve') ? 'var(--success)' : state.includes('Revoke') ? 'var(--danger)' : 'var(--warning)',
        }}>
          ✓ {state}
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'right' }}>
        {msg.time}
      </div>
    </div>
  );
}

/* ── Tier Explainer ───────────────────────────────────── */
function TierExplainer({ tier, label, desc, color }) {
  return (
    <div className="flex items-center gap-8" style={{ gap: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 'var(--radius-sm)',
        background: `${color}18`, color, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, flexShrink: 0,
      }}>T{tier}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{desc}</div>
      </div>
    </div>
  );
}

/* ── Audit Log Page ───────────────────────────────────── */
function AuditPage() {
  const actionIcons = {
    action_proposed: '📋', anomaly_detected: '🚨', budget_realloc: '💰',
    creative_generated: '✦', data_pull: '⟳', reconciliation: '⟳',
    action_approved: '✅', campaign_paused: '⏸', digest_sent: '📨', action_rejected: '❌',
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Audit Log</div>
          <div className="page-subtitle">Immutable record of all system actions · 90-day retention</div>
        </div>
        <button className="btn btn-ghost btn-sm">Export CSV</button>
      </div>

      <div className="card fade-in">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Tier</th>
              <th>Detail</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            {AUDIT_LOG.map(entry => (
              <tr key={entry.id}>
                <td style={{ fontSize: 14, textAlign: 'center' }}>{actionIcons[entry.action] || '·'}</td>
                <td className="mono" style={{ whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-secondary)' }}>
                  {new Date(entry.timestamp).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td>
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)', fontWeight: 500,
                  }}>{entry.action.replace(/_/g, ' ')}</span>
                </td>
                <td><TierBadge tier={entry.tier} /></td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 400 }} className="truncate">
                  {entry.detail}
                </td>
                <td>
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)',
                    color: entry.actor === 'operator' ? 'var(--accent)' : 'var(--text-tertiary)',
                  }}>{entry.actor}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { TelegramPage, TelegramBubble, TierExplainer, AuditPage });
