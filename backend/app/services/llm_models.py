"""Curated LLM model list + DB-backed selection for the Telegram agent.

The chosen model is stored in the SystemConfig table (key "llm_model") so it
survives backend redeploys. Falls back to settings.llm_model when unset.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SystemConfig
from app.settings import get_settings

CONFIG_KEY = "llm_model"

# OpenRouter slugs grouped by provider. Keep tool-calling-capable models.
MODEL_OPTIONS = [
    {"provider": "OpenAI", "id": "openai/gpt-4o-mini", "label": "GPT-4o mini (fast, cheap)"},
    {"provider": "OpenAI", "id": "openai/gpt-4o", "label": "GPT-4o"},
    {"provider": "OpenAI", "id": "openai/gpt-4.1", "label": "GPT-4.1"},
    {"provider": "OpenAI", "id": "openai/gpt-4.1-mini", "label": "GPT-4.1 mini"},
    {"provider": "Anthropic", "id": "anthropic/claude-3.5-sonnet", "label": "Claude 3.5 Sonnet"},
    {"provider": "Anthropic", "id": "anthropic/claude-3.5-haiku", "label": "Claude 3.5 Haiku"},
    {"provider": "Anthropic", "id": "anthropic/claude-3.7-sonnet", "label": "Claude 3.7 Sonnet"},
    {"provider": "Google", "id": "google/gemini-2.0-flash-001", "label": "Gemini 2.0 Flash"},
    {"provider": "Google", "id": "google/gemini-2.5-pro", "label": "Gemini 2.5 Pro"},
    {"provider": "Google", "id": "google/gemini-2.5-flash", "label": "Gemini 2.5 Flash"},
]

VALID_IDS = {m["id"] for m in MODEL_OPTIONS}


async def get_current_model(db: AsyncSession) -> str:
    """Selected model from DB, else the env default."""
    row = (await db.execute(select(SystemConfig).where(SystemConfig.key == CONFIG_KEY))).scalar_one_or_none()
    if row and isinstance(row.value, dict) and row.value.get("id"):
        return row.value["id"]
    return get_settings().llm_model


async def set_current_model(db: AsyncSession, model_id: str, actor: str | None = None) -> None:
    """Persist the selected model. Caller validates against VALID_IDS."""
    row = (await db.execute(select(SystemConfig).where(SystemConfig.key == CONFIG_KEY))).scalar_one_or_none()
    if row:
        row.value = {"id": model_id}
        row.updated_by = actor
    else:
        db.add(SystemConfig(key=CONFIG_KEY, value={"id": model_id}, updated_by=actor))
    await db.commit()
