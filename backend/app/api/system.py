from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_config, get_current_user
from app.scheduler import scheduler

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    db_ok = True
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "db_ok": db_ok,
        "scheduler_ok": scheduler.running,
        "platforms": {
            "meta": "not_configured",
            "tiktok": "not_configured",
            "snapchat": "not_configured",
            "shopify": "not_configured",
        },
    }


@router.get("/config")
async def get_system_config(
    config: dict = Depends(get_config),
    _user=Depends(get_current_user),
):
    return config
