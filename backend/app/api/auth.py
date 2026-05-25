"""Auth endpoints.

For MVP without Supabase Auth wired up yet, this issues self-signed JWTs
against a single operator login defined in env vars. Once Supabase Auth is
provisioned, swap the issuer for `supabase.auth.sign_in_with_password()`
and validate the JWT using the Supabase JWT secret.
"""
from datetime import datetime, timedelta, timezone
import bcrypt
from fastapi import APIRouter, HTTPException, status
from jose import jwt

from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest
from app.settings import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

# MVP operator credentials — replace with Supabase Auth in production
OPERATOR_EMAIL = "operator@adpilot.local"
_OPERATOR_PASSWORD_HASH: bytes | None = None


def _get_operator_hash() -> bytes:
    global _OPERATOR_PASSWORD_HASH
    if _OPERATOR_PASSWORD_HASH is None:
        _OPERATOR_PASSWORD_HASH = bcrypt.hashpw(b"changeme123", bcrypt.gensalt())
    return _OPERATOR_PASSWORD_HASH


def _issue_token(sub: str, minutes: int) -> str:
    payload = {
        "sub": sub,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    password_ok = bcrypt.checkpw(req.password.encode(), _get_operator_hash())
    if req.email != OPERATOR_EMAIL or not password_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access = _issue_token(req.email, settings.jwt_expire_minutes)
    refresh = _issue_token(req.email, settings.jwt_expire_minutes * 7)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.jwt_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshRequest):
    try:
        payload = jwt.decode(req.refresh_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    access = _issue_token(payload["sub"], settings.jwt_expire_minutes)
    return TokenResponse(access_token=access, expires_in=settings.jwt_expire_minutes * 60)
