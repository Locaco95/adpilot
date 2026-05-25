from datetime import datetime, timezone, timedelta
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user, get_config
from app.models import Action, Platform, Campaign, AuditLog
from app.schemas.action import ActionOut, ActionDecision

router = APIRouter(prefix="/actions", tags=["actions"])


def _to_out(a: Action, platform_slug: str | None, campaign_name: str | None) -> ActionOut:
    return ActionOut(
        id=a.id, tier=a.tier, type=a.type,
        platform=platform_slug, campaign=campaign_name,
        description=a.description, rationale=a.rationale,
        impact=a.impact, risk=a.risk, estimated_gain=a.estimated_gain,
        status=a.status, created_at=a.created_at,
        expires_at=a.expires_at, revoke_deadline=a.revoke_deadline,
    )


@router.get("", response_model=list[ActionOut])
async def list_actions(
    filter: str = Query("all"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    q = select(Action).order_by(Action.created_at.desc()).limit(50)
    if filter == "pending":
        q = q.where(Action.status == "pending")
    elif filter == "tier3":
        q = q.where(Action.tier == 3)
    elif filter == "tier2":
        q = q.where(Action.tier == 2)
    actions = (await db.execute(q)).scalars().all()

    pmap = {p.id: p.slug for p in (await db.execute(select(Platform))).scalars().all()}
    cmap = {c.id: c.name for c in (await db.execute(select(Campaign))).scalars().all()}

    return [
        _to_out(a, pmap.get(a.platform_id), cmap.get(a.campaign_id))
        for a in actions
    ]


@router.post("/{action_id}/decide")
async def decide_action(
    action_id: UUID,
    decision: ActionDecision,
    db: AsyncSession = Depends(get_db),
    config: dict = Depends(get_config),
    user=Depends(get_current_user),
):
    # SELECT FOR UPDATE to prevent race with expiry job
    q = select(Action).where(Action.id == action_id).with_for_update()
    action = (await db.execute(q)).scalar_one_or_none()
    if not action:
        raise HTTPException(404, "Action not found")
    if action.status != "pending":
        raise HTTPException(409, f"Action already {action.status}")
    if action.expires_at and action.expires_at < datetime.now(timezone.utc):
        action.status = "expired"
        await db.commit()
        raise HTTPException(409, "Action expired")

    now = datetime.now(timezone.utc)
    if decision.decision == "deferred":
        hours = decision.defer_hours or 6
        action.expires_at = now + timedelta(hours=hours)
        action.status = "deferred"
    elif decision.decision == "rejected":
        action.status = "rejected"
        action.decision_at = now
        action.decision_actor = user.get("sub", "operator")
    elif decision.decision == "approved":
        action.status = "approved"
        action.decision_at = now
        action.decision_actor = user.get("sub", "operator")
        # Tier 2: set revoke window before final execution
        if action.tier == 2:
            window = int(config.get("tier2_limits", {}).get("revoke_window_seconds", 300))
            action.revoke_deadline = now + timedelta(seconds=window)
        # Week 5: hand off to executor here

    # Audit log entry (append-only)
    audit = AuditLog(
        action="action_decided",
        tier=action.tier,
        detail=f"{action.type} -> {decision.decision}",
        actor=user.get("sub", "operator"),
        entity_type="action",
        entity_id=action.id,
        params_snapshot={"decision": decision.decision, "defer_hours": decision.defer_hours},
    )
    db.add(audit)
    await db.commit()

    return {"id": str(action.id), "status": action.status, "executed_at": action.executed_at}


@router.post("/{action_id}/revoke")
async def revoke_action(
    action_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    action = await db.get(Action, action_id)
    if not action:
        raise HTTPException(404, "Action not found")
    if action.tier != 2:
        raise HTTPException(400, "Only Tier 2 actions are revocable")
    if action.status not in ("approved", "executed"):
        raise HTTPException(409, f"Cannot revoke action in status {action.status}")
    if not action.revoke_deadline or action.revoke_deadline < datetime.now(timezone.utc):
        raise HTTPException(409, "Revoke window has expired")

    action.status = "revoked"
    audit = AuditLog(
        action="action_revoked", tier=2,
        detail=action.type, actor=user.get("sub", "operator"),
        entity_type="action", entity_id=action.id,
    )
    db.add(audit)
    await db.commit()
    return {"id": str(action.id), "status": "revoked"}
