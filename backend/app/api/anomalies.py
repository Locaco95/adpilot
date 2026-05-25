from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user
from app.models import Anomaly, Platform
from app.schemas.overview import AnomalyOut

router = APIRouter(prefix="/anomalies", tags=["anomalies"])


@router.get("", response_model=list[AnomalyOut])
async def list_anomalies(
    status: str = Query("active"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    pmap = {p.id: p.slug for p in (await db.execute(select(Platform))).scalars().all()}
    q = select(Anomaly).order_by(Anomaly.created_at.desc()).limit(50)
    if status == "active":
        q = q.where(Anomaly.resolved_at.is_(None))
    rows = (await db.execute(q)).scalars().all()
    return [
        AnomalyOut(
            id=a.id, severity=a.severity,
            platform=pmap.get(a.platform_id, "unknown"),
            timestamp=a.created_at,
            title=a.title, detail=a.detail,
            metric=a.metric, value=a.value, baseline=a.baseline,
            zScore=float(a.z_score) if a.z_score is not None else None,
        )
        for a in rows
    ]
