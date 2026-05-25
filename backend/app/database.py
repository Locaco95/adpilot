from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.settings import get_settings

settings = get_settings()

# Fallback URL prevents create_async_engine("") crash if env var is missing.
# The app will still fail on the first real DB query, but it will start up
# and the /health endpoint will show db_ok=false instead of crashing.
_db_url = settings.database_url or "postgresql+asyncpg://localhost/adpilot"

# statement_cache_size=0 and prepared_statement_cache_size=0 are required
# when asyncpg connects through Supabase's PgBouncer (port 6543, transaction
# mode). Prepared statements break under transaction pooling.
engine = create_async_engine(
    _db_url,
    echo=settings.environment == "development",
    pool_size=5,
    max_overflow=10,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    },
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass
