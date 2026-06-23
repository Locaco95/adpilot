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

    async def delete(self, path: str) -> dict[str, Any]:
        token = self._require()
        url = path if path.startswith("http") else f"{API_BASE}{path}"
        async with httpx.AsyncClient(timeout=30) as h:
            r = await h.delete(url, params={"access_token": token})
        r.raise_for_status()
        return r.json()

    async def post_multipart(self, path: str, files: dict, data: dict | None = None) -> dict[str, Any]:
        """Multipart POST (for /adimages and /advideos uploads)."""
        token = self._require()
        url = path if path.startswith("http") else f"{API_BASE}{path}"
        body = {"access_token": token, **(data or {})}
        async with httpx.AsyncClient(timeout=180) as h:
            r = await h.post(url, data=body, files=files)
        r.raise_for_status()
        return r.json()

    async def upload_image(self, ad_account_id: str, path: str, filename: str, content_type: str) -> str:
        """Upload an image to /adimages; return its image_hash."""
        with open(path, "rb") as fh:
            resp = await self.post_multipart(
                f"/{ad_account_id}/adimages",
                files={"filename": (filename, fh, content_type)},
            )
        images = resp.get("images", {})
        if not images:
            raise MetaAuthError(f"Meta returned no image hash: {resp}")
        # response is keyed by the uploaded filename; take the first entry
        first = next(iter(images.values()))
        return first["hash"]

    async def upload_video(self, ad_account_id: str, path: str, filename: str, content_type: str) -> str:
        """Upload a video to /advideos; return its video id."""
        with open(path, "rb") as fh:
            resp = await self.post_multipart(
                f"/{ad_account_id}/advideos",
                files={"source": (filename, fh, content_type)},
            )
        vid = resp.get("id")
        if not vid:
            raise MetaAuthError(f"Meta returned no video id: {resp}")
        return vid

    async def get_video_thumbnail(self, video_id: str) -> str | None:
        """Best-effort: return a thumbnail URL for an uploaded video, if available."""
        try:
            data = await self.get(f"/{video_id}", params={"fields": "thumbnails"})
            thumbs = (data.get("thumbnails") or {}).get("data") or []
            return thumbs[0]["uri"] if thumbs else None
        except Exception:
            return None


_singleton: MetaClient | None = None


def get_meta_client() -> MetaClient:
    global _singleton
    if _singleton is None:
        _singleton = MetaClient()
    return _singleton
