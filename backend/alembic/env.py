from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import Base
from app.settings import get_settings
import app.models  # noqa: F401 — register all models

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()

# Build a sync URL for Alembic using psycopg3 (sync mode).
# Railway Postgres gives postgres:// or postgresql://
# Supabase gives postgresql+asyncpg://
# We normalise everything to postgresql+psycopg://
_raw = settings.database_url or ""
if _raw.startswith("postgresql+asyncpg://"):
    sync_url = _raw.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
elif _raw.startswith("postgres://"):
    sync_url = _raw.replace("postgres://", "postgresql+psycopg://", 1)
elif _raw.startswith("postgresql://") and "+psycopg" not in _raw:
    sync_url = _raw.replace("postgresql://", "postgresql+psycopg://", 1)
else:
    sync_url = _raw

# Strip sslmode for Railway internal connections (not needed + can cause errors)
_is_railway_internal = "railway.internal" in sync_url
if _is_railway_internal and "sslmode=" in sync_url:
    import re
    sync_url = re.sub(r"[?&]sslmode=[^&]*", "", sync_url).rstrip("?")
elif "sslmode=" not in sync_url and not _is_railway_internal and sync_url:
    sync_url += "?sslmode=require" if "?" not in sync_url else "&sslmode=require"

config.set_main_option("sqlalchemy.url", sync_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=sync_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
