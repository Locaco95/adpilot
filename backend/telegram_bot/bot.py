"""Telegram bot entry point.

Week 1 stub — full implementation lands in Week 5 (HITL approval flow).
Runs as a long-lived process; restart policy in docker-compose keeps it up.
"""
import asyncio
import logging
from app.settings import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("telegram_bot")

settings = get_settings()


async def main():
    if not settings.telegram_bot_token:
        logger.warning("TELEGRAM_BOT_TOKEN not set — bot idle. Add it to .env to enable.")
        while True:
            await asyncio.sleep(3600)

    # Week 5: from telegram.ext import Application; build polling loop here
    logger.info("Telegram bot stub running. Full handlers wired in Week 5.")
    while True:
        await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(main())
