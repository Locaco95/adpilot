"""Settings endpoints — currently the LLM model the Telegram agent uses."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user
from app.services import llm_models

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
