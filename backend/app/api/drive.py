"""Google Drive connection endpoints.

- GET  /drive/status         → { connected }  (JWT)
- GET  /drive/auth/start     → 302 to Google consent (JWT; passes token as state-less since it's a top-level redirect, so this returns the URL for the frontend to open)
- GET  /drive/auth/callback  → Google redirects here with ?code; exchanges + stores. Public (no JWT — Google calls it), guarded by state.
- GET  /drive/folder?url=    → list media files in a folder (JWT)
"""
from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user
from app.services import drive_oauth
from app.services.drive_oauth import DriveError

router = APIRouter(prefix="/drive", tags=["drive"])

# short-lived CSRF states for the consent round-trip (in-memory; single operator)
_states: set[str] = set()


@router.get("/status")
async def status(db: AsyncSession = Depends(get_db), _user=Depends(get_current_user)):
    return {"connected": await drive_oauth.is_connected(db)}


@router.get("/auth/url")
async def auth_url(_user=Depends(get_current_user)):
    """Return the Google consent URL for the frontend to open in a new tab."""
    state = secrets.token_urlsafe(16)
    _states.add(state)
    try:
        return {"url": drive_oauth.build_auth_url(state)}
    except DriveError as e:
        raise HTTPException(503, str(e))


@router.get("/auth/callback")
async def auth_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
):
    """Google redirects here. No JWT (Google can't send one); state guards it."""
    if error:
        return HTMLResponse(f"<h3>Google Drive connection failed: {error}</h3>", status_code=400)
    if not code or state not in _states:
        return HTMLResponse("<h3>Invalid or expired request. Try connecting again.</h3>", status_code=400)
    _states.discard(state)
    try:
        refresh = await drive_oauth.exchange_code(code)
        await drive_oauth.store_refresh_token(db, refresh)
    except DriveError as e:
        return HTMLResponse(f"<h3>Connection error: {e}</h3>", status_code=400)
    return HTMLResponse(
        "<h2>✅ Google Drive connected</h2><p>You can close this tab and return to AdPilot.</p>"
    )


@router.get("/folder")
async def list_folder(
    url: str = Query(..., description="Drive folder link or id"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    try:
        files = await drive_oauth.list_folder_media(db, url)
    except DriveError as e:
        raise HTTPException(422, str(e))
    return {"files": files, "count": len(files)}
