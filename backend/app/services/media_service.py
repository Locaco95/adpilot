"""Platform-agnostic creative media acquisition — the single source of truth.

Snap, Meta, and TikTok campaign creation all obtain their creative through
`get_creative_media()` rather than implementing their own Drive logic. The
returned media lives in a temp file that is always cleaned up on exit.

Preferred input is a Google Drive `creative_file_id` fetched via OAuth. A
legacy public `drive_url` path is kept for backward compatibility (Telegram)
and is marked deprecated.
"""
from __future__ import annotations

import os
import tempfile
from contextlib import asynccontextmanager
from dataclasses import dataclass
from enum import Enum
from typing import AsyncIterator

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import drive_oauth
from app.services.drive_oauth import DriveError

# TODO: remove this legacy public-link path once Telegram migrates to creative_file_id.
from app.services.drive import download_public_drive_file, DriveError as PublicDriveError


class MediaType(str, Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"


@dataclass
class CreativeMedia:
    path: str            # temp-file path on disk (auto-deleted on context exit)
    filename: str
    content_type: str
    media_type: MediaType


# Map drive_oauth DriveError.code → HTTP status (clear, distinct errors).
_CODE_TO_STATUS = {
    "not_connected": 409,
    "not_found": 404,
    "access_denied": 403,
    "refresh_failed": 503,
    "unsupported": 422,
    "drive_error": 502,
}


def _media_type_from_mime(mime: str) -> MediaType:
    if mime.startswith("image/"):
        return MediaType.IMAGE
    if mime.startswith("video/"):
        return MediaType.VIDEO
    raise DriveError(
        f"Unsupported creative type '{mime or 'unknown'}'. Use an image or video file.",
        code="unsupported",
    )


@asynccontextmanager
async def get_creative_media(
    db: AsyncSession,
    creative_file_id: str | None,
    drive_url: str | None,
    media_type_hint: str | None = None,
) -> AsyncIterator[CreativeMedia]:
    """Yield a CreativeMedia backed by a temp file; clean it up afterwards.

    creative_file_id (preferred): metadata + OAuth download, media_type from MIME.
    drive_url (deprecated): legacy public-link download; media_type from the hint
    or inferred from content-type, defaulting to VIDEO.
    """
    tmp_path: str | None = None
    try:
        if creative_file_id:
            try:
                meta = await drive_oauth.get_file_metadata(db, creative_file_id)
                mime = meta.get("mimeType", "") or ""
                media_type = _media_type_from_mime(mime)
                content = await drive_oauth.download_file(db, creative_file_id)
            except DriveError as e:
                raise HTTPException(_CODE_TO_STATUS.get(e.code, 502), str(e))
            filename = meta.get("name") or creative_file_id
            content_type = mime or "application/octet-stream"

        elif drive_url:
            # TODO: deprecated — remove once Telegram migrates to creative_file_id.
            try:
                content, filename, content_type = await download_public_drive_file(drive_url)
            except PublicDriveError as e:
                raise HTTPException(422, f"Drive download failed: {e}")
            if media_type_hint in (MediaType.IMAGE.value, MediaType.VIDEO.value):
                media_type = MediaType(media_type_hint)
            elif content_type.startswith(("image/", "video/")):
                media_type = _media_type_from_mime(content_type)
            else:
                media_type = MediaType.VIDEO  # legacy default

        else:
            raise HTTPException(
                422, "No creative provided: pass creative_file_id (preferred) or drive_url."
            )

        suffix = os.path.splitext(filename)[1] or ""
        fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="adpilot_media_")
        with os.fdopen(fd, "wb") as f:
            f.write(content)

        yield CreativeMedia(
            path=tmp_path,
            filename=filename,
            content_type=content_type,
            media_type=media_type,
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
