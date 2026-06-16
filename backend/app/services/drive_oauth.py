"""Google Drive OAuth + file access for AdPilot.

One-time consent via the dashboard mints a refresh_token, stored in the
SystemConfig table (key "google_drive"). Access tokens are then minted on
demand from the refresh_token. Used to list a folder's files and download
each creative.
"""
from __future__ import annotations

import time
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SystemConfig
from app.settings import get_settings

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
DRIVE_API = "https://www.googleapis.com/drive/v3"
SCOPE = "https://www.googleapis.com/auth/drive"
CONFIG_KEY = "google_drive"

# In-process access-token cache (refreshed from the stored refresh_token).
_access_token: str | None = None
_access_expires_at: float = 0.0


class DriveError(RuntimeError):
    """Drive failure carrying a coarse `code` so callers can map to HTTP status.

    codes: not_connected | not_found | access_denied | refresh_failed | unsupported | drive_error
    """

    def __init__(self, message: str, code: str = "drive_error") -> None:
        super().__init__(message)
        self.code = code


def _code_for_status(status_code: int) -> str:
    if status_code == 404:
        return "not_found"
    if status_code in (401, 403):
        return "access_denied"
    return "drive_error"


def build_auth_url(state: str) -> str:
    s = get_settings()
    if not (s.google_client_id and s.google_oauth_redirect):
        raise DriveError("Google OAuth not configured (GOOGLE_CLIENT_ID / GOOGLE_OAUTH_REDIRECT).")
    params = {
        "client_id": s.google_client_id,
        "redirect_uri": s.google_oauth_redirect,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",      # needed to get a refresh_token
        "prompt": "consent",            # force refresh_token on re-consent
        "state": state,
    }
    return f"{AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> str:
    """Swap the auth code for tokens; returns the refresh_token."""
    s = get_settings()
    async with httpx.AsyncClient(timeout=30) as h:
        r = await h.post(TOKEN_URL, data={
            "code": code,
            "client_id": s.google_client_id,
            "client_secret": s.google_client_secret,
            "redirect_uri": s.google_oauth_redirect,
            "grant_type": "authorization_code",
        })
    if r.status_code != 200:
        raise DriveError(f"Token exchange failed: HTTP {r.status_code}: {r.text[:300]}")
    body = r.json()
    refresh = body.get("refresh_token")
    if not refresh:
        raise DriveError("No refresh_token returned (revoke prior consent and retry).")
    return refresh


async def store_refresh_token(db: AsyncSession, refresh_token: str) -> None:
    row = (await db.execute(select(SystemConfig).where(SystemConfig.key == CONFIG_KEY))).scalar_one_or_none()
    if row:
        row.value = {"refresh_token": refresh_token}
    else:
        db.add(SystemConfig(key=CONFIG_KEY, value={"refresh_token": refresh_token}))
    await db.commit()
    global _access_token, _access_expires_at
    _access_token, _access_expires_at = None, 0.0  # force refresh next call


async def get_stored_refresh_token(db: AsyncSession) -> str | None:
    row = (await db.execute(select(SystemConfig).where(SystemConfig.key == CONFIG_KEY))).scalar_one_or_none()
    if row and isinstance(row.value, dict):
        return row.value.get("refresh_token")
    return None


async def is_connected(db: AsyncSession) -> bool:
    return bool(await get_stored_refresh_token(db))


async def _access_token_from_refresh(refresh_token: str) -> str:
    global _access_token, _access_expires_at
    if _access_token and time.time() < _access_expires_at - 60:
        return _access_token
    s = get_settings()
    async with httpx.AsyncClient(timeout=30) as h:
        r = await h.post(TOKEN_URL, data={
            "refresh_token": refresh_token,
            "client_id": s.google_client_id,
            "client_secret": s.google_client_secret,
            "grant_type": "refresh_token",
        })
    if r.status_code != 200:
        raise DriveError(
            f"Google Drive token refresh failed (HTTP {r.status_code}). "
            f"Reconnect Drive in the dashboard. {r.text[:200]}",
            code="refresh_failed",
        )
    body = r.json()
    _access_token = body["access_token"]
    _access_expires_at = time.time() + int(body.get("expires_in", 3600))
    return _access_token


def extract_folder_id(url_or_id: str) -> str:
    """Accept a folder link or a raw id; return the id."""
    s = url_or_id.strip()
    if "/folders/" in s:
        s = s.split("/folders/", 1)[1]
    if "id=" in s:
        s = s.split("id=", 1)[1]
    return s.split("?")[0].split("/")[0].strip()


async def _token_or_raise(db: AsyncSession) -> str:
    """Resolve an access token, raising a not_connected DriveError if unlinked."""
    refresh = await get_stored_refresh_token(db)
    if not refresh:
        raise DriveError(
            "Google Drive not connected. Connect it in the dashboard first.",
            code="not_connected",
        )
    return await _access_token_from_refresh(refresh)


async def list_folder_media(db: AsyncSession, folder_url_or_id: str) -> list[dict[str, Any]]:
    """List image/video files directly inside a Drive folder."""
    token = await _token_or_raise(db)
    folder_id = extract_folder_id(folder_url_or_id)
    q = f"'{folder_id}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')"
    async with httpx.AsyncClient(timeout=30) as h:
        r = await h.get(
            f"{DRIVE_API}/files",
            params={"q": q, "fields": "files(id,name,mimeType,size)", "pageSize": 100},
            headers={"Authorization": f"Bearer {token}"},
        )
    if r.status_code != 200:
        raise DriveError(
            f"Could not list Drive folder (HTTP {r.status_code}): {r.text[:200]}",
            code=_code_for_status(r.status_code),
        )
    return r.json().get("files", [])


async def get_file_metadata(db: AsyncSession, file_id: str) -> dict[str, Any]:
    """Fetch a single file's id, name, mimeType, size."""
    token = await _token_or_raise(db)
    async with httpx.AsyncClient(timeout=30) as h:
        r = await h.get(
            f"{DRIVE_API}/files/{file_id}",
            params={"fields": "id,name,mimeType,size"},
            headers={"Authorization": f"Bearer {token}"},
        )
    if r.status_code != 200:
        raise DriveError(
            f"Could not read Drive file metadata (HTTP {r.status_code}): {r.text[:200]}",
            code=_code_for_status(r.status_code),
        )
    return r.json()


async def download_file(db: AsyncSession, file_id: str) -> bytes:
    token = await _token_or_raise(db)
    async with httpx.AsyncClient(timeout=120) as h:
        r = await h.get(
            f"{DRIVE_API}/files/{file_id}",
            params={"alt": "media"},
            headers={"Authorization": f"Bearer {token}"},
        )
    if r.status_code != 200:
        raise DriveError(
            f"Could not download Drive file (HTTP {r.status_code}): {r.text[:200]}",
            code=_code_for_status(r.status_code),
        )
    return r.content
