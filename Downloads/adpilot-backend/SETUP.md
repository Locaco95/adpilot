# AdPilot Setup Guide

Step-by-step setup once you have credentials. **Estimated time: 30 minutes.**

---

## 1. Create the Supabase project (free tier is fine)

1. Go to https://supabase.com → **New project**
2. Region: **Europe (Frankfurt) `eu-central-1`** (closest to KSA)
3. Note down:
   - **Project URL** → `https://<ref>.supabase.co`
   - **Settings → API → `service_role` key** (keep secret)
   - **Settings → Database → Connection string → URI** → "Transaction" pooler mode
   - **Settings → API → JWT Secret** (under "JWT Settings")

## 2. Get a Claude API key

1. https://console.anthropic.com → **API Keys → Create Key**
2. Copy the `sk-ant-...` key

## 3. Create a Telegram bot (optional for Week 1 — needed Week 5)

1. Open Telegram, search `@BotFather`, send `/newbot`
2. Pick a name and username → bot token returned
3. Message your new bot once, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` to find your `chat_id`

## 4. Configure environment

```powershell
cd C:\Users\galal\Downloads\adpilot-backend
copy .env.example .env
```

Edit `.env` with the values from steps 1-3. The two required fields for Week 1:
- `DATABASE_URL` — from Supabase pooler URI
- `JWT_SECRET` — generate with `python -c "import secrets; print(secrets.token_urlsafe(64))"`

Platform API keys (Meta, TikTok, Snapchat, Shopify) can stay blank until Week 3.

## 5. Run database migrations + seed mock data

```powershell
# Install Python deps (one time)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Apply schema
alembic upgrade head

# Seed mock data (9 campaigns, 14 days of metrics, anomalies, actions, drafts)
python seed.py
```

You should see:
```
Seeded: 4 platforms, 9 campaigns, 126 daily metrics, 3 anomalies, 4 actions, 5 creative drafts, 10 audit entries.
```

## 6. Run the backend locally (no Docker)

```powershell
uvicorn app.main:app --reload --port 8000
```

Visit http://localhost:8000/api/docs for the Swagger UI.

Test the login (default operator credentials):
- **Email:** `operator@adpilot.local`
- **Password:** `changeme123`

> ⚠️ Change these in `app/api/auth.py` before production deployment.

## 7. Run the frontend

The frontend is just static HTML. Open it with any local server pointing at the `adpilot/` directory:

```powershell
cd C:\Users\galal\Downloads\adpilot
python -m http.server 5500
```

Visit http://localhost:5500/AdPilot%20Dashboard.html, log in with the credentials above. The dashboard pulls live data from `http://localhost:8000/api/v1/...`.

> If you serve frontend and backend on different ports, the API client uses the same origin by default. To point at a different backend URL, set `window.ADPILOT_API_BASE = 'http://localhost:8000'` in the HTML before loading `api.js`.

## 8. Run with Docker Compose (production-like)

```powershell
docker compose up -d --build
```

Services:
- `caddy` → http://localhost (serves frontend + proxies /api/* to backend)
- `api` → backend on internal port 8000
- `telegram_bot` → idle until token provided

Watch logs:
```powershell
docker compose logs -f api
```

## 9. Deploy to a VPS (Week 6)

For Hetzner CX22 or similar:

```bash
# On the VPS
git clone <your-repo> adpilot && cd adpilot/adpilot-backend
cp .env.example .env  # fill in production values
# Edit Caddyfile: change `:80` to `your.domain.com` for auto-HTTPS
docker compose up -d --build
```

DNS: point `your.domain.com` A record at the VPS IP. Caddy auto-issues a TLS cert on first request.

---

## Verifying Week 1 is done

1. Frontend loads at http://localhost or http://localhost:5500
2. Login with `operator@adpilot.local` / `changeme123` works
3. Overview page shows real KPI numbers (not the same as mock-data — slight variance from seeded random)
4. Campaigns page shows 9 rows, sortable
5. Actions page shows 4 actions (3 Tier 3 pending, 1 Tier 2 approved)
6. Approving/rejecting a Tier 3 action returns 200 and updates the row
7. Audit log shows 10 seed entries + new entries from any decisions you made
8. Network tab shows `/api/v1/...` calls with `Authorization: Bearer eyJ...` header

## What's left (Weeks 3-6)

- Week 3: Meta Insights ingestion via `facebook-business` SDK
- Week 4: TikTok + Snapchat ingestion, deterministic kill/scale planner
- Week 5: Telegram HITL approval flow, action executor (real platform writes)
- Week 6: Shopify webhooks + attribution, Claude-powered creative generator, prod hardening
