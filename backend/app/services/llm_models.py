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

# OpenRouter slugs grouped by provider. Every id verified against the live
# OpenRouter /models list (2026-06-15). Tool-calling-capable models only.
MODEL_OPTIONS = [
    # ---- OpenAI ----
    {"provider": "OpenAI", "id": "openai/gpt-4o-mini", "label": "GPT-4o mini (fast, cheap)"},
    {"provider": "OpenAI", "id": "openai/gpt-4o", "label": "GPT-4o"},
    {"provider": "OpenAI", "id": "openai/gpt-4o-2024-11-20", "label": "GPT-4o (Nov 2024)"},
    {"provider": "OpenAI", "id": "openai/gpt-4.1", "label": "GPT-4.1"},
    {"provider": "OpenAI", "id": "openai/gpt-4.1-mini", "label": "GPT-4.1 mini"},
    {"provider": "OpenAI", "id": "openai/gpt-4.1-nano", "label": "GPT-4.1 nano"},
    {"provider": "OpenAI", "id": "openai/gpt-4-turbo", "label": "GPT-4 Turbo"},
    {"provider": "OpenAI", "id": "openai/o3", "label": "o3 (reasoning)"},
    {"provider": "OpenAI", "id": "openai/o3-mini", "label": "o3-mini (reasoning)"},
    {"provider": "OpenAI", "id": "openai/o4-mini", "label": "o4-mini (reasoning)"},
    # ---- Anthropic ----
    {"provider": "Anthropic", "id": "anthropic/claude-3-haiku", "label": "Claude 3 Haiku"},
    {"provider": "Anthropic", "id": "anthropic/claude-3.5-haiku", "label": "Claude 3.5 Haiku"},
    {"provider": "Anthropic", "id": "anthropic/claude-haiku-4.5", "label": "Claude Haiku 4.5"},
    {"provider": "Anthropic", "id": "anthropic/claude-sonnet-4", "label": "Claude Sonnet 4"},
    {"provider": "Anthropic", "id": "anthropic/claude-sonnet-4.5", "label": "Claude Sonnet 4.5"},
    {"provider": "Anthropic", "id": "anthropic/claude-sonnet-4.6", "label": "Claude Sonnet 4.6"},
    {"provider": "Anthropic", "id": "anthropic/claude-opus-4", "label": "Claude Opus 4"},
    {"provider": "Anthropic", "id": "anthropic/claude-opus-4.1", "label": "Claude Opus 4.1"},
    {"provider": "Anthropic", "id": "anthropic/claude-opus-4.5", "label": "Claude Opus 4.5"},
    {"provider": "Anthropic", "id": "anthropic/claude-opus-4.6", "label": "Claude Opus 4.6"},
    {"provider": "Anthropic", "id": "anthropic/claude-opus-4.7", "label": "Claude Opus 4.7"},
    {"provider": "Anthropic", "id": "anthropic/claude-opus-4.8", "label": "Claude Opus 4.8 (latest)"},
    {"provider": "Anthropic", "id": "anthropic/claude-fable-5", "label": "Claude Fable 5"},
    # ---- Google ----
    {"provider": "Google", "id": "google/gemini-2.5-flash-lite", "label": "Gemini 2.5 Flash Lite"},
    {"provider": "Google", "id": "google/gemini-2.5-flash", "label": "Gemini 2.5 Flash"},
    {"provider": "Google", "id": "google/gemini-2.5-pro", "label": "Gemini 2.5 Pro"},
    {"provider": "Google", "id": "google/gemini-3.1-flash-lite", "label": "Gemini 3.1 Flash Lite"},
    {"provider": "Google", "id": "google/gemini-3.5-flash", "label": "Gemini 3.5 Flash"},
    {"provider": "Google", "id": "google/gemini-3.1-pro-preview", "label": "Gemini 3.1 Pro (preview)"},
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
