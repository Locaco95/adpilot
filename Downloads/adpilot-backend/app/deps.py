from typing import AsyncGenerator, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError, jwt
import yaml
import time

from app.settings import get_settings
from app.database import AsyncSessionLocal

settings = get_settings()
bearer_scheme = HTTPBearer()

# In-memory config cache
_config_cache: dict[str, Any] = {}
_config_loaded_at: float = 0
CONFIG_TTL = 300  # 5 minutes


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def get_config() -> dict:
    global _config_cache, _config_loaded_at
    now = time.monotonic()
    if not _config_cache or (now - _config_loaded_at) > CONFIG_TTL:
        with open(settings.config_path, "r", encoding="utf-8") as f:
            _config_cache = yaml.safe_load(f)
        _config_loaded_at = now
    return _config_cache
