"""Meta (Facebook) Marketing API client. Thin transport layer.

Uses a long-lived access token from settings (no OAuth refresh flow here —
swap to a System User token for a non-expiring server credential). Graph API
v21.0.

Reference: https://developers.facebook.com/docs/marketing-api
"""
from __future__ import annotations

from typing import Any

import httpx

from app.settings import get_settings

API_BASE = "https://graph.facebook.com/v21.0"


class MetaAuthError(RuntimeError):
    pass


class MetaClient:
    """Per-process Meta client. Token is static (long-lived / system user)."""

    def __init__(self) -> None:
        s = get_settings()
        self._token = s.meta_access_token
        self._ad_account_id = s.meta_ad_account_id

    def configured(self) -> bool:
        return bool(self._token and self._ad_account_id)

    def _require(self) -> str:
        if not self._token:
            raise MetaAuthError(
                "Meta not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID."
            )
        return self._token

    async def get(self, path: str, params: dict | None = None) -> dict[str, Any]:
        token = self._require()
        url = path if path.startswith("http") else f"{API_BASE}{path}"
        q = {"access_token": token, **(params or {})}
        async with httpx.AsyncClient(timeout=30) as h:
            r = await h.get(url, params=q)
        r.raise_for_status()
        return r.json()

    async def post(self, path: str, data: dict | None = None) -> dict[str, Any]:
        token = self._require()
        url = path if path.startswith("http") else f"{API_BASE}{path}"
        body = {"access_token": token, **(data or {})}
        async with httpx.AsyncClient(timeout=30) as h:
            r = await h.post(url, data=body)
        r.raise_for_status()
        return r.json()


_singleton: MetaClient | None = None


def get_meta_client() -> MetaClient:
    global _singleton
    if _singleton is None:
        _singleton = MetaClient()
    return _singleton
