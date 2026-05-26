/* ── Login Page ────────────────────────────────────────── */
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    setLoading(true);
    try {
      await window.AdPilotAPI.login(email, password);
      onLogin();
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-root)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background grid pattern */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: `
          linear-gradient(var(--text-primary) 1px, transparent 1px),
          linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }}></div>

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, oklch(0.75 0.14 75 / 0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}></div>

      <div style={{
        position: 'relative', width: 400, padding: '0 20px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--accent), oklch(0.65 0.16 55))',
            borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: 'var(--text-inverse)',
            boxShadow: '0 8px 32px oklch(0.75 0.14 75 / 0.25)',
          }}>▲</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700,
            letterSpacing: '-0.03em',
          }}>
            ad<span style={{ color: 'var(--accent)' }}>pilot</span>
          </div>
          <div style={{
            color: 'var(--text-tertiary)', fontSize: 13, marginTop: 4,
          }}>AI Media Buyer Command Center</div>
        </div>

        {/* Login card */}
        <form onSubmit={handleSubmit} style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)', padding: '32px 28px',
          boxShadow: '0 4px 24px oklch(0 0 0 / 0.3)',
        }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
              marginBottom: 6, fontFamily: 'var(--font-body)',
            }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="operator@company.com"
              autoComplete="email"
              style={{
                width: '100%', padding: '10px 14px',
                background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none',
                transition: 'border-color 0.15s ease',
                boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
              marginBottom: 6, fontFamily: 'var(--font-body)',
            }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••"
              autoComplete="current-password"
              style={{
                width: '100%', padding: '10px 14px',
                background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none',
                transition: 'border-color 0.15s ease',
                boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
            />
          </div>

          {error && (
            <div style={{
              background: 'var(--danger-bg)', color: 'var(--danger)',
              padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              fontSize: 12, fontWeight: 500, marginBottom: 16,
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '11px 20px',
            background: loading ? 'var(--accent-dim)' : 'var(--accent)',
            color: 'var(--text-inverse)', border: 'none',
            borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700,
            fontFamily: 'var(--font-body)', cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.15s ease',
            letterSpacing: '-0.01em',
          }}
            onMouseEnter={e => { if (!loading) e.target.style.filter = 'brightness(1.1)'; }}
            onMouseLeave={e => e.target.style.filter = 'none'}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 14, height: 14, border: '2px solid var(--text-inverse)',
                  borderTopColor: 'transparent', borderRadius: '50%',
                  display: 'inline-block', animation: 'spin 0.6s linear infinite',
                }}></span>
                Authenticating...
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-tertiary)', fontSize: 11 }}>
          Single-client deployment · KSA region
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/* ── Main App Shell ───────────────────────────────────── */
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    window.AdPilotAPI && window.AdPilotAPI.auth.isAuthed()
  );
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [activePage, setActivePage] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    setDataReady(false);
    setLoadError('');
    window.AdPilotAPI.loadDashboardData()
      .then(() => setDataReady(true))
      .catch((err) => setLoadError(err.message || 'Failed to load dashboard'));
  }, [isLoggedIn]);

  const handleLogin = () => setIsLoggedIn(true);
  const handleLogout = () => {
    window.AdPilotAPI.auth.clear();
    setIsLoggedIn(false);
    setDataReady(false);
    setLoadError('');
  };

  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} />;

  const renderPage = () => {
    switch (activePage) {
      case 'overview':  return <OverviewPage />;
      case 'actions':   return <ActionsPage />;
      case 'campaigns': return <CampaignsPage />;
      case 'creative':  return <CreativePage />;
      case 'telegram':  return <TelegramPage />;
      case 'audit':     return <AuditPage />;
      default:          return <OverviewPage />;
    }
  };

  const navigate = (page) => { setActivePage(page); setSidebarOpen(false); };

  // Skeleton loading — sidebar shows instantly, content area shows shimmer cards
  const mainContent = () => {
    if (loadError) return (
      <div style={{ margin: '24px', padding: '14px 18px', background: 'var(--danger-bg)',
        border: '1px solid oklch(0.65 0.2 20 / 0.25)', borderRadius: 'var(--radius-sm)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--danger)' }}>⚠</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>Connection failed</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{loadError}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => {
            setLoadError(''); setDataReady(false);
            window.AdPilotAPI.loadDashboardData()
              .then(() => setDataReady(true))
              .catch((err) => setLoadError(err.message || 'Failed to load dashboard'));
          }}>Retry</button>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
            onClick={handleLogout}>Sign out</button>
        </div>
      </div>
    );
    if (!dataReady) return <SkeletonOverview />;
    return renderPage();
  };

  return (
    <div className="app-layout" style={{ animation: 'adp-dashboard-in 0.45s ease forwards' }}>
      <MobileTopbar activePage={activePage} onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar
        activePage={activePage}
        onNavigate={navigate}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="main-content" key={dataReady ? activePage : '__loading'}>
        {mainContent()}
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
