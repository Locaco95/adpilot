// AdPilot API client — replaces mock-data.js with real backend calls.
// Populates the same window globals consumed by the JSX components.

(function () {
  const API_BASE = (window.ADPILOT_API_BASE || '') + '/api/v1';
  const TOKEN_KEY = 'adpilot_token';
  const REFRESH_KEY = 'adpilot_refresh';

  // ── Auth helpers ────────────────────────────────────────
  const auth = {
    getToken: () => localStorage.getItem(TOKEN_KEY),
    setToken: (t, r) => {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      if (r) localStorage.setItem(REFRESH_KEY, r);
    },
    clear: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    },
    isAuthed: () => !!localStorage.getItem(TOKEN_KEY),
  };

  async function login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    auth.setToken(data.access_token, data.refresh_token);
    return data;
  }

  async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Authorization': `Bearer ${auth.getToken()}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.status === 401) {
      auth.clear();
      window.location.reload();
      return null;
    }
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `POST ${path} -> ${res.status}`);
    }
    return res.json();
  }

  async function apiPatch(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${auth.getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error(`PATCH ${path} -> ${res.status}`);
    return res.json();
  }

  // ── Bootstrap: load everything the dashboard needs into window globals ──
  async function loadDashboardData() {
    const [summary, daily, campaigns, anomalies, actions, drafts, audit] = await Promise.all([
      apiGet('/overview/summary?window=7d'),
      apiGet('/overview/daily?days=14'),
      apiGet('/campaigns?platform=all&status=all'),
      apiGet('/overview/anomalies?status=active'),
      apiGet('/actions?filter=all'),
      apiGet('/creative/drafts?hook=all&status=all'),
      apiGet('/audit/log?limit=50'),
    ]);

    // Platform constants (still client-side for color/icon — server-side via /system/config in future)
    const PLATFORMS = {
      meta:     { name: 'Meta',     color: '#1877F2', icon: 'M', share: 0.60 },
      tiktok:   { name: 'TikTok',   color: '#00D4AA', icon: 'T', share: 0.25 },
      snapchat: { name: 'Snapchat', color: '#FFFC00', icon: 'S', share: 0.15 },
    };

    Object.assign(window, {
      PLATFORMS,
      TARGET_CPA:   summary.target_cpa,
      TARGET_ROAS:  summary.target_roas,
      DAILY_BUDGET: summary.daily_budget,
      DAILY_METRICS: daily,
      SUMMARY_KPIS:  summary,
      CAMPAIGNS:     campaigns,
      PENDING_ACTIONS: actions,
      ANOMALIES:     anomalies,
      CREATIVE_DRAFTS: drafts,
      AUDIT_LOG:     audit.items || audit,
      TELEGRAM_MESSAGES: [],  // Wired in Week 5 from /telegram/messages
    });
  }

  // ── Expose API surface ──────────────────────────────────
  window.AdPilotAPI = {
    auth, login, apiGet, apiPost, apiPatch,
    loadDashboardData,

    // Action helpers
    decideAction: (id, decision, deferHours) =>
      apiPost(`/actions/${id}/decide`, { decision, defer_hours: deferHours }),
    revokeAction: (id) => apiPost(`/actions/${id}/revoke`),

    // Creative helpers
    decideDraft: (id, decision) => apiPost(`/creative/drafts/${id}/decide`, { decision }),
    generateCreative: (req) => apiPost('/creative/generate', req),

    // Campaign manual override
    patchCampaign: (id, patch) => apiPatch(`/campaigns/${id}`, patch),
  };
})();
