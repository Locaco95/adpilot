from uuid import UUID, uuid4
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user
from app.models import CreativeDraft, Platform, Campaign, AuditLog
from app.schemas.creative import CreativeDraftOut, CreativeDecision, CreativeGenerateRequest

router = APIRouter(prefix="/creative", tags=["creative"])

# In-memory job store for Week 1 — replaced with DB-backed queue in Week 6
_jobs: dict[str, dict] = {}


def _to_out(d: CreativeDraft, platform_slug: str, campaign_name: str | None) -> CreativeDraftOut:
    return CreativeDraftOut(
        id=d.id, platform=platform_slug, campaign=campaign_name,
        hook=d.hook, status=d.status,
        headline=d.headline, primaryText=d.primary_text, cta=d.cta,
        headlineEn=d.headline_en, primaryTextEn=d.primary_text_en,
        createdAt=d.created_at,
    )


@router.get("/drafts", response_model=list[CreativeDraftOut])
async def list_drafts(
    hook: str = Query("all"),
    status: str = Query("all"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    pmap = {p.id: p.slug for p in (await db.execute(select(Platform))).scalars().all()}
    cmap = {c.id: c.name for c in (await db.execute(select(Campaign))).scalars().all()}

    q = select(CreativeDraft).order_by(CreativeDraft.created_at.desc()).limit(50)
    if hook != "all":
        q = q.where(CreativeDraft.hook == hook)
    if status != "all":
        q = q.where(CreativeDraft.status == status)
    drafts = (await db.execute(q)).scalars().all()
    return [_to_out(d, pmap.get(d.platform_id, "unknown"), cmap.get(d.campaign_id)) for d in drafts]


@router.post("/drafts/{draft_id}/decide")
async def decide_draft(
    draft_id: UUID,
    decision: CreativeDecision,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    draft = await db.get(CreativeDraft, draft_id)
    if not draft:
        raise HTTPException(404, "Draft not found")
    if draft.status not in ("draft", "rejected"):
        raise HTTPException(409, f"Draft already {draft.status}")
    draft.status = decision.decision
    audit = AuditLog(
        action="creative_decided", tier=3,
        detail=f"{draft.hook} -> {decision.decision}",
        actor=user.get("sub", "operator"),
        entity_type="creative_draft", entity_id=draft.id,
    )
    db.add(audit)
    await db.commit()
    return {"id": str(draft.id), "status": draft.status}


@router.post("/generate")
async def generate_creative(
    req: CreativeGenerateRequest,
    _user=Depends(get_current_user),
):
    """Stub for Week 1 — full implementation in Week 6 (CreativeStrategist)."""
    job_id = str(uuid4())
    _jobs[job_id] = {
        "status": "pending", "started_at": datetime.now(timezone.utc).isoformat(),
        "request": req.model_dump(mode="json"), "drafts": [],
    }
    return {"job_id": job_id, "status": "pending"}


@router.get("/generate/{job_id}")
async def generate_status(job_id: str, _user=Depends(get_current_user)):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job
