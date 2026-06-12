"""Download a creative from a public Google Drive share link.

Only handles anyone-with-the-link files (no OAuth). Converts a share URL to
the direct-download endpoint and follows Drive's large-file confirm-token
redirect. Caps the download at MAX_BYTES — Snap's simple upload tops out at
32MB and we don't implement chunked upload in this slice.
"""
from __future__ import annotations

import re

import httpx

MAX_BYTES = 32 * 1024 * 1024  # 32MB — Snap simple-upload ceiling
DOWNLOAD_URL = "https://drive.google.com/uc?export=download"


class DriveError(RuntimeError):
    pass


def extract_file_id(url: str) -> str:
    """Pull the file id out of the common Drive URL shapes:
    .../file/d/<ID>/view  |  ...?id=<ID>  |  .../uc?id=<ID>
    """
    m = re.search(r"/file/d/([a-zA-Z0-9_-]+)", url)
    if m:
        return m.group(1)
    m = re.search(r"[?&]id=([a-zA-Z0-9_-]+)", url)
    if m:
        return m.group(1)
    raise DriveError(f"Could not extract a Google Drive file id from URL: {url}")


def _filename_from_headers(resp: httpx.Response, fallback: str) -> str:
    cd = resp.headers.get("content-disposition", "")
    m = re.search(r'filename="?([^"]+)"?', cd)
    return m.group(1) if m else fallback


async def download_public_drive_file(url: str) -> tuple[bytes, str, str]:
    """Returns (bytes, filename, content_type). Raises DriveError on failure
    or if the file exceeds MAX_BYTES."""
    file_id = extract_file_id(url)
    params = {"id": file_id}

    async with httpx.AsyncClient(timeout=120, follow_redirects=True) as h:
        resp = await h.get(DOWNLOAD_URL, params=params)

        # Large files return an HTML interstitial with a confirm token rather
        # than the bytes. Detect it and retry with the token.
        ctype = resp.headers.get("content-type", "")
        if "text/html" in ctype:
            token = None
            m = re.search(r"confirm=([0-9A-Za-z_-]+)", resp.text)
            if m:
                token = m.group(1)
            else:
                token = resp.cookies.get("download_warning") or _scan_confirm_cookie(resp)
            if not token:
                raise DriveError(
                    "Drive returned an HTML page, not the file. Is the link "
                    "set to 'Anyone with the link'? URL: " + url
                )
            resp = await h.get(DOWNLOAD_URL, params={"id": file_id, "confirm": token})

        if resp.status_code != 200:
            raise DriveError(f"Drive download failed: HTTP {resp.status_code}")

        content = resp.content
        if len(content) > MAX_BYTES:
            raise DriveError(
                f"File is {len(content) // (1024*1024)}MB; max supported is "
                f"{MAX_BYTES // (1024*1024)}MB (chunked upload not implemented)."
            )
        if not content:
            raise DriveError("Drive returned an empty file.")

        filename = _filename_from_headers(resp, f"{file_id}.bin")
        content_type = resp.headers.get("content-type", "application/octet-stream")
        return content, filename, content_type


def _scan_confirm_cookie(resp: httpx.Response) -> str | None:
    for name, value in resp.cookies.items():
        if name.startswith("download_warning"):
            return value
    return None
