"""Telegram Bot API client. Thin transport layer — no business logic.

Reference: https://core.telegram.org/bots/api
"""
from __future__ import annotations

from typing import Any

import httpx

from app.settings import get_settings


class TelegramError(RuntimeError):
    pass


class TelegramClient:
    def __init__(self) -> None:
        s = get_settings()
        self._token = s.telegram_bot_token

    def configured(self) -> bool:
        return bool(self._token)

    async def _call(self, method: str, payload: dict) -> dict[str, Any]:
        if not self._token:
            raise TelegramError("TELEGRAM_BOT_TOKEN not configured.")
        url = f"https://api.telegram.org/bot{self._token}/{method}"
        async with httpx.AsyncClient(timeout=30) as h:
            r = await h.post(url, json=payload)
        body = r.json()
        if not body.get("ok"):
            raise TelegramError(f"Telegram {method} failed: {body}")
        return body["result"]

    async def send_message(
        self,
        chat_id: int,
        text: str,
        buttons: list[list[dict]] | None = None,
    ) -> dict[str, Any]:
        """buttons: rows of {"text": ..., "callback_data": ...}."""
        payload: dict[str, Any] = {"chat_id": chat_id, "text": text}
        if buttons:
            payload["reply_markup"] = {"inline_keyboard": buttons}
        return await self._call("sendMessage", payload)

    async def edit_message_text(self, chat_id: int, message_id: int, text: str) -> Any:
        return await self._call(
            "editMessageText",
            {"chat_id": chat_id, "message_id": message_id, "text": text},
        )

    async def answer_callback_query(self, callback_query_id: str, text: str = "") -> Any:
        return await self._call(
            "answerCallbackQuery",
            {"callback_query_id": callback_query_id, "text": text},
        )


_singleton: TelegramClient | None = None


def get_telegram_client() -> TelegramClient:
    global _singleton
    if _singleton is None:
        _singleton = TelegramClient()
    return _singleton
