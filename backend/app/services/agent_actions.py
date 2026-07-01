"""Execute an approved agent write action.

Shared by the Telegram webhook and the web chat route — both turn an approved
PendingAction into a real Snap/Meta write through the same service layer.
Returns a human-readable result string.
"""
from __future__ import annotations

from app.agents.telegram_agent import PendingAction
from app.database import AsyncSessionLocal
from app.schemas.snap_create import CreateCampaignRequest
from app.schemas.meta_create import CreateMetaCampaignRequest
from app.services import snap_campaigns, meta_campaigns


async def execute_action(action: PendingAction) -> str:
    if action.tool == "create_campaign":
        async with AsyncSessionLocal() as db:
            result = await snap_campaigns.create_full_campaign(
                CreateCampaignRequest(**action.args), db
            )
        return (
            "✅ Campaign created (PAUSED — activate it to spend)\n"
            f"campaign: {result.campaign_id}\n"
            f"ad squad: {result.ad_squad_id}\n"
            f"ad: {result.ad_id}"
        )
    if action.tool == "update_budget":
        updated = await snap_campaigns.update_adsquad_budget(
            action.args["ad_squad_id"], float(action.args["daily_budget"])
        )
        budget = updated.get("daily_budget_micro", 0) / 1_000_000
        return f"✅ Budget updated: {updated.get('name')} → {budget:g}/day"
    if action.tool == "set_campaign_status":
        updated = await snap_campaigns.set_campaign_status(
            action.args["campaign_id"], action.args["status"]
        )
        return f"✅ Campaign {updated.get('name')} is now {updated.get('status')}"
    if action.tool == "meta_create_campaign":
        async with AsyncSessionLocal() as db:
            result = await meta_campaigns.create_campaign_with_adset(
                CreateMetaCampaignRequest(**action.args), db
            )
        return (
            "✅ Meta campaign created (PAUSED — activate it to spend)\n"
            f"campaign: {result.campaign_id}\n"
            f"ad set: {result.ad_set_id}"
        )
    return f"Unknown action tool: {action.tool}"
