"""OpenRouter chat-completions client (OpenAI-compatible, with tool calling).

Model comes from settings.llm_model; key from settings.openrouter_api_key.
"""
from __future__ import annotations

from typing import Any

import httpx

from app.settings import get_settings

API_URL = "https://openrouter.ai/api/v1/chat/completions"


class LLMError(RuntimeError):
    pass


async def chat(
    messages: list[dict],
    tools: list[dict] | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    """Returns the assistant message dict (may contain tool_calls).

    `model` overrides the configured default (the DB-selected model is passed
    in by the agent); falls back to settings.llm_model.
    """
    s = get_settings()
    if not s.openrouter_api_key:
        raise LLMError("OPENROUTER_API_KEY not configured.")
    payload: dict[str, Any] = {
        "model": model or s.llm_model,
        "messages": messages,
    }
    if tools:
        payload["tools"] = tools
    async with httpx.AsyncClient(timeout=60) as h:
        r = await h.post(
            API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {s.openrouter_api_key}",
                "HTTP-Referer": "https://adpilot-ten-olive.vercel.app",
                "X-Title": "AdPilot",
            },
        )
    if r.status_code != 200:
        raise LLMError(f"OpenRouter HTTP {r.status_code}: {r.text[:400]}")
    body = r.json()
    choices = body.get("choices") or []
    if not choices:
        raise LLMError(f"OpenRouter returned no choices: {body}")
    return choices[0]["message"]
