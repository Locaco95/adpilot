"""APScheduler job definitions.

Wired up here, but most jobs are stubbed for Week 1 — implementations land in Weeks 3-6.
All jobs use max_instances=1 to prevent overlap on slow platform pulls.
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def hot_path_ingestion():
    """Every 30 min — pull today's spend + conversions from all platforms."""
    logger.info("hot_path_ingestion: stub — Week 3-4 implementation")
    # from app.agents.ingestor import run_hot_path
    # await run_hot_path()


async def warm_path_ingestion():
    """Every 6 hours — full campaign/adset/ad metadata sync."""
    logger.info("warm_path_ingestion: stub — Week 3-4 implementation")


async def cold_path_backfill():
    """Daily 02:00 UTC — re-pull last 7 days, flip is_provisional=false."""
    logger.info("cold_path_backfill: stub — Week 3-4 implementation")


async def expire_pending_actions():
    """Every minute — mark expired Tier 3 actions, edit Telegram message."""
    logger.info("expire_pending_actions: stub — Week 5 implementation")


async def commit_revocable_actions():
    """Every 30s — finalize Tier 2 actions past their revoke window."""
    logger.info("commit_revocable_actions: stub — Week 5 implementation")


async def daily_digest():
    """Daily 08:00 KSA (05:00 UTC) — send digest via Telegram."""
    logger.info("daily_digest: stub — Week 5 implementation")


async def optimizer_pass():
    """Every hour — evaluate ad sets and execute/queue actions (if enabled)."""
    from app.services.optimizer_runner import run_once
    try:
        result = await run_once()
        logger.info("optimizer_pass: %s", result)
    except Exception:
        logger.exception("optimizer_pass failed")


def start_scheduler():
    if scheduler.running:
        return

    scheduler.add_job(hot_path_ingestion,      IntervalTrigger(minutes=30), id="hot_path",     max_instances=1)
    scheduler.add_job(warm_path_ingestion,     IntervalTrigger(hours=6),    id="warm_path",    max_instances=1)
    scheduler.add_job(cold_path_backfill,      CronTrigger(hour=2, minute=0), id="cold_path",  max_instances=1)
    scheduler.add_job(expire_pending_actions,  IntervalTrigger(minutes=1),  id="expire",       max_instances=1)
    scheduler.add_job(commit_revocable_actions, IntervalTrigger(seconds=30), id="commit_revocable", max_instances=1)
    scheduler.add_job(daily_digest,            CronTrigger(hour=5, minute=0), id="daily_digest", max_instances=1)
    scheduler.add_job(optimizer_pass,          IntervalTrigger(hours=1),    id="optimizer",    max_instances=1)

    scheduler.start()
    logger.info("APScheduler started with 7 jobs")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
