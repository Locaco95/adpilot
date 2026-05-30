"""Snapchat Marketing API client.

Handles OAuth token refresh transparently. The refresh_token is loaded from
settings on startup and never written to disk by this module — when Snap
rotates it on refresh, we update the in-memory copy only. (Persisting it
back to env vars in production would require Railway's API or a small DB
table; left as a follow-up.)

Reference: https://developers.snap.com/api/marketing-api/Ads-API/authentication
"""
from __future__ import annotations

import time
from typing import Any

import httpx

from app.settings import get_settings

TOKEN_URL = "https://accounts.snapchat.com/login/oauth2/access_token"
API_BASE = "https://adsapi.snapchat.com/v1"

# Refresh slightly before the 1h expiry to avoid races.
ACCESS_TOKEN_SAFETY_MARGIN_SEC = 60


class SnapAuthError(RuntimeError):
    pass


class SnapClient:
    """Per-process Snap client. Caches the access token, refreshes on demand."""

    def __init__(self) -> None:
        s = get_settings()
        self._client_id = s.snapchat_client_id
        self._client_secret = s.snapchat_client_secret
        self._refresh_token = s.snapchat_refresh_token
        self._access_token: str | None = None
        self._access_token_expires_at: float = 0.0

    def _configured(self) -> bool:
        return bool(self._client_id and self._client_secret and self._refresh_token)

    async def _refresh(self) -> None:
        if not self._configured():
            raise SnapAuthError(
                "Snap OAuth not configured. Set SNAPCHAT_CLIENT_ID, "
                "SNAPCHAT_CLIENT_SECRET, SNAPCHAT_REFRESH_TOKEN."
            )
        async with httpx.AsyncClient(timeout=20) as h:
            r = await h.post(
                TOKEN_URL,
                data={
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                },
            )
        if r.status_code != 200:
            raise SnapAuthError(f"Snap refresh failed: HTTP {r.status_code}: {r.text[:300]}")
        body = r.json()
        access = body.get("access_token")
        if not access:
            raise SnapAuthError(f"Snap refresh response missing access_token: {body}")
        self._access_token = access
        self._access_token_expires_at = (
            time.time() + int(body.get("expires_in", 3600)) - ACCESS_TOKEN_SAFETY_MARGIN_SEC
        )
        # Snap occasionally rotates the refresh token.
        new_refresh = body.get("refresh_token")
        if new_refresh and new_refresh != self._refresh_token:
            self._refresh_token = new_refresh

    async def _ensure_access_token(self) -> str:
        if not self._access_token or time.time() >= self._access_token_expires_at:
            await self._refresh()
        assert self._access_token
        return self._access_token

    async def get(self, path: str, params: dict | None = None) -> dict[str, Any]:
        token = await self._ensure_access_token()
        url = path if path.startswith("http") else f"{API_BASE}{path}"
        async with httpx.AsyncClient(timeout=20) as h:
            r = await h.get(
                url,
                params=params,
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            )
        # If the cached token expired between checks (clock skew, etc.), retry once.
        if r.status_code == 401:
            await self._refresh()
            token = self._access_token
            async with httpx.AsyncClient(timeout=20) as h:
                r = await h.get(
                    url,
                    params=params,
                    headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                )
        r.raise_for_status()
        return r.json()


_singleton: SnapClient | None = None


def get_snap_client() -> SnapClient:
    global _singleton
    if _singleton is None:
        _singleton = SnapClient()
    return _singleton
