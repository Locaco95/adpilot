from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import csv
import io

from app.deps import get_db, get_current_user
from app.models import AuditLog
from app.schemas.audit import AuditLogPage, AuditLogOut

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/log", response_model=AuditLogPage)
async def list_audit(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    total = (await db.execute(select(func.count(AuditLog.id)))).scalar() or 0
    rows = (
        await db.execute(
            select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).offset(offset)
        )
    ).scalars().all()
    items = [
        AuditLogOut(
            id=r.id, timestamp=r.timestamp,
            action=r.action, tier=r.tier, detail=r.detail, actor=r.actor,
        )
        for r in rows
    ]
    return AuditLogPage(items=items, total=total, has_more=offset + len(items) < total)


@router.get("/log/export")
async def export_audit(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    rows = (await db.execute(select(AuditLog).order_by(AuditLog.timestamp.desc()))).scalars().all()

    def csv_iter():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["timestamp", "action", "tier", "actor", "entity_type", "entity_id", "detail"])
        yield buf.getvalue()
        buf.seek(0); buf.truncate()
        for r in rows:
            writer.writerow([
                r.timestamp.isoformat(), r.action, r.tier or "",
                r.actor, r.entity_type or "", str(r.entity_id) if r.entity_id else "",
                r.detail or "",
            ])
            yield buf.getvalue()
            buf.seek(0); buf.truncate()

    return StreamingResponse(
        csv_iter(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
    )
