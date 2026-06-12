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
        self._org_id = s.snapchat_org_id_loay
        self._profile_id_override = s.snapchat_profile_id
        self._profile_id: str | None = None
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

    async def post(self, path: str, json: dict | None = None) -> dict[str, Any]:
        token = await self._ensure_access_token()
        url = path if path.startswith("http") else f"{API_BASE}{path}"
        async with httpx.AsyncClient(timeout=30) as h:
            r = await h.post(
                url,
                json=json,
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            )
        if r.status_code == 401:
            await self._refresh()
            token = self._access_token
            async with httpx.AsyncClient(timeout=30) as h:
                r = await h.post(
                    url,
                    json=json,
                    headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                )
        r.raise_for_status()
        return r.json()

    async def put(self, path: str, json: dict | None = None) -> dict[str, Any]:
        token = await self._ensure_access_token()
        url = path if path.startswith("http") else f"{API_BASE}{path}"
        async with httpx.AsyncClient(timeout=30) as h:
            r = await h.put(
                url,
                json=json,
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            )
        if r.status_code == 401:
            await self._refresh()
            token = self._access_token
            async with httpx.AsyncClient(timeout=30) as h:
                r = await h.put(
                    url,
                    json=json,
                    headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                )
        r.raise_for_status()
        return r.json()

    async def post_multipart(self, path: str, files: dict) -> dict[str, Any]:
        """Upload a file. `files` is httpx's multipart dict, e.g.
        {"file": (filename, bytes, content_type)}."""
        token = await self._ensure_access_token()
        url = path if path.startswith("http") else f"{API_BASE}{path}"
        # Media uploads can be large; give them a generous timeout.
        async with httpx.AsyncClient(timeout=120) as h:
            r = await h.post(
                url,
                files=files,
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            )
        if r.status_code == 401:
            await self._refresh()
            token = self._access_token
            async with httpx.AsyncClient(timeout=120) as h:
                r = await h.post(
                    url,
                    files=files,
                    headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                )
        r.raise_for_status()
        return r.json()

    async def get_profile_id(self) -> str:
        """The public profile id required to create creatives. Prefer an
        explicit override; otherwise discover it from the org and cache it."""
        if self._profile_id_override:
            return self._profile_id_override
        if self._profile_id:
            return self._profile_id
        if not self._org_id:
            raise SnapAuthError(
                "Cannot resolve Snap profile_id: SNAPCHAT_ORG_ID_LOAY not set "
                "and SNAPCHAT_PROFILE_ID override empty."
            )
        data = await self.get(f"/organizations/{self._org_id}/public_profiles")
        profiles = data.get("public_profiles", [])
        for wrap in profiles:
            prof = wrap.get("public_profile", {})
            pid = prof.get("id")
            if pid:
                self._profile_id = pid
                return pid
        raise SnapAuthError(
            f"No public profile found for org {self._org_id}. "
            "Set SNAPCHAT_PROFILE_ID explicitly."
        )


_singleton: SnapClient | None = None


def get_snap_client() -> SnapClient:
    global _singleton
    if _singleton is None:
        _singleton = SnapClient()
    return _singleton
