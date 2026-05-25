# AdPilot Backend

AI Media Buyer command center backend for KSA e-commerce. Pulls ad performance from Meta / TikTok / Snapchat, joins Shopify revenue, runs deterministic kill/scale logic, generates Khaliji Arabic ad copy via Claude, and routes high-risk actions through a Telegram HITL approval flow.

**Status:** Week 1 of 6 — API + auth + seeded mock data wired to existing frontend.

## Stack

- Python 3.11, FastAPI, APScheduler, httpx
- Supabase managed Postgres
- Docker Compose on a single VPS (Hetzner CX22)
- Claude API (Sonnet for reasoning, Opus for creative)
- Telegram Bot API for operator approvals
- Caddy for TLS / reverse proxy

## Quickstart

See [SETUP.md](./SETUP.md) for full instructions. TL;DR:

```powershell
copy .env.example .env  # fill in DATABASE_URL + JWT_SECRET
pip install -r requirements.txt
alembic upgrade head
python seed.py
uvicorn app.main:app --reload
```

Then open `../adpilot/AdPilot Dashboard.html` with any local web server. Login: `operator@adpilot.local` / `changeme123`.

## Architecture

```
APScheduler (in-process)
    ↓
Ingestor (Meta/TikTok/Snapchat/Shopify) → daily_metrics
    ↓
Analyst (KPI rollups, EWMA, z-score, fatigue) → anomalies
    ↓
Planner (deterministic kill/scale rules) → actions
    ↓
Broker (tier routing)
   ├── Tier 1: auto-execute
   ├── Tier 2: execute + 5-min revoke window via Telegram
   └── Tier 3: Telegram HITL approval before execute
    ↓
Executor + Notifier (platform API writes + audit log + Telegram)
```

**Hard rule:** `app/analytics/` contains zero LLM imports. All thresholds and decisions are deterministic Python.

## Build status

| Week | Scope | Status |
|---|---|---|
| 1 | API + auth + seeded data + Docker | ✅ done |
| 2 | All read endpoints, action decide/revoke writes | ✅ done |
| 3 | Meta ingestion + analyst | pending |
| 4 | TikTok + Snapchat + planner | pending |
| 5 | Executor + Telegram HITL | pending |
| 6 | Shopify + Claude creative + prod hardening | pending |

## Project layout

See the plan file at `~/.claude/plans/i-have-already-created-peppy-whisper.md` for the canonical structure and design rationale.
