from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import yaml

from app.settings import get_settings
from app.database import engine, Base
from app.api import auth, overview, campaigns, actions, anomalies, creative, audit, system

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load thresholds.yaml into memory on startup
    try:
        with open(settings.config_path, "r", encoding="utf-8") as f:
            app.state.config = yaml.safe_load(f)
    except FileNotFoundError:
        app.state.config = {}

    # Start scheduler
    from app.scheduler import start_scheduler, stop_scheduler
    start_scheduler()

    yield

    stop_scheduler()
    await engine.dispose()


app = FastAPI(
    title="AdPilot API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth.router,      prefix=PREFIX)
app.include_router(overview.router,  prefix=PREFIX)
app.include_router(campaigns.router, prefix=PREFIX)
app.include_router(actions.router,   prefix=PREFIX)
app.include_router(anomalies.router, prefix=PREFIX)
app.include_router(creative.router,  prefix=PREFIX)
app.include_router(audit.router,     prefix=PREFIX)
app.include_router(system.router,    prefix=PREFIX)


@app.get("/health")
async def root_health():
    return {"status": "ok"}
