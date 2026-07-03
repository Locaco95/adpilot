"""Settings endpoints — LLM model + optimizer config/kill-switch."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user
from app.services import llm_models, optimizer_config

router = APIRouter(prefix="/settings", tags=["settings"])


class LLMModelOut(BaseModel):
    current: str
    options: list[dict]


class SetLLMModel(BaseModel):
    model: str


@router.get("/llm", response_model=LLMModelOut)
async def get_llm_model(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    current = await llm_models.get_current_model(db)
    return LLMModelOut(current=current, options=llm_models.MODEL_OPTIONS)


@router.post("/llm", response_model=LLMModelOut)
async def set_llm_model(
    body: SetLLMModel,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    if body.model not in llm_models.VALID_IDS:
        raise HTTPException(422, f"Unknown model: {body.model}")
    await llm_models.set_current_model(db, body.model, actor=user.get("sub", "operator"))
    return LLMModelOut(current=body.model, options=llm_models.MODEL_OPTIONS)


# ── optimizer config + master kill switch ────────────────────────────────────
class OptimizerConfigPatch(BaseModel):
    enabled: bool | None = None
    auto_execute: bool | None = None
    breakeven_roas: float | None = None
    target_cpa: float | None = None
    human_approval_spend_threshold: float | None = None
    selected_metrics: list[str] | None = None
    # AI media buyer
    ai_enabled: bool | None = None
    avg_order_value: float | None = None
    min_days_before_judgment: int | None = None
    min_daily_spend_per_adset: float | None = None
    max_frequency: float | None = None
    aggressiveness: str | None = None
    scale_step_pct: int | None = None
    decrease_step_pct: int | None = None
    max_auto_budget_change_pct: int | None = None
    auto_kill: bool | None = None
    auto_scale: bool | None = None
    auto_decrease: bool | None = None


@router.get("/optimizer")
async def get_optimizer_config(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    return await optimizer_config.get_config(db)


@router.post("/optimizer")
async def update_optimizer_config(
    body: OptimizerConfigPatch,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(422, "No fields to update.")
    return await optimizer_config.set_config(db, patch, actor=user.get("sub", "operator"))


@router.post("/optimizer/run")
async def run_optimizer_now(_user=Depends(get_current_user)):
    """Trigger one optimizer pass immediately (respects enabled + kill switch)."""
    from app.services.optimizer_runner import run_once
    return await run_once()


@router.post("/ai-media-buyer/run")
async def run_ai_media_buyer_now(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Run one AI Media Buyer analysis pass now, using the operator's chosen model.
    Returns per-ad-set diagnosis + action + reasoning (and executes within limits)."""
    from app.services.ai_media_buyer_runner import run_once
    model = await llm_models.get_current_model(db)
    return await run_once(model=model)


@router.get("/ai-media-buyer/memory")
async def ai_media_buyer_memory(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """The AI's accumulated lessons + recent decision→outcome history."""
    from app.services import ai_memory
    mem = await ai_memory._load(db)
    return {"lessons": mem.get("lessons", []),
            "decision_count": sum(len(v) for v in mem.get("decisions", {}).values())}


@router.post("/ai-media-buyer/self-review")
async def ai_media_buyer_self_review(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Run the weekly self-review now — distill lessons from past outcomes."""
    from app.services.ai_media_buyer_runner import run_self_review
    model = await llm_models.get_current_model(db)
    return await run_self_review(model=model)
