import os
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_config, get_current_user
from app.scheduler import scheduler
from app.settings import get_settings

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    db_ok = True
    db_error = None
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_ok = False
        db_error = f"{type(e).__name__}: {str(e)[:300]}"
    return {
        "status": "ok" if db_ok else "degraded",
        "db_ok": db_ok,
        "db_error": db_error,
        "scheduler_ok": scheduler.running,
        "platforms": {
            "meta": "not_configured",
            "tiktok": "not_configured",
            "snapchat": "not_configured",
            "shopify": "not_configured",
        },
    }


@router.get("/diag")
async def diag():
    """TEMP diagnostic — shows what DATABASE_URL the app actually sees.
    Password is masked. Remove after debugging."""
    settings = get_settings()
    url = settings.database_url or os.environ.get("DATABASE_URL", "")
    masked = url
    if "@" in url and ":" in url.split("@")[0]:
        # mask password
        head, tail = url.rsplit("@", 1)
        scheme_user = head.rsplit(":", 1)[0]
        masked = f"{scheme_user}:***@{tail}"
    return {
        "database_url_seen": masked,
        "scheme_ok": url.startswith("postgresql+asyncpg://"),
        "is_empty": not bool(url),
        "env_keys_present": [k for k in os.environ.keys() if "DATABASE" in k.upper() or "POSTGRES" in k.upper() or "SUPABASE" in k.upper()],
    }


@router.get("/config")
async def get_system_config(
    config: dict = Depends(get_config),
    _user=Depends(get_current_user),
):
    return config
