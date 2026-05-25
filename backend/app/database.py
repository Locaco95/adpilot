from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.settings import get_settings

settings = get_settings()

_db_url = settings.database_url or "postgresql+psycopg://localhost/adpilot"

# Normalise scheme to psycopg3 (works with Railway Postgres and Supabase pooler)
if _db_url.startswith("postgresql+asyncpg://"):
    _db_url = _db_url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
elif _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql+psycopg://", 1)
elif _db_url.startswith("postgresql://") and "+psycopg" not in _db_url:
    _db_url = _db_url.replace("postgresql://", "postgresql+psycopg://", 1)

# Railway internal Postgres doesn't need sslmode; Supabase pooler does.
# Only add sslmode=require for external (Supabase) connections.
_is_railway_internal = "railway.internal" in _db_url or "railway.app" in _db_url.split("@")[-1].split("/")[0]
if "sslmode=" not in _db_url and not _is_railway_internal:
    _db_url += "?sslmode=require" if "?" not in _db_url else "&sslmode=require"

engine = create_async_engine(
    _db_url,
    echo=settings.environment == "development",
    pool_size=5,
    max_overflow=10,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass
