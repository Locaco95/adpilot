"""Seed script — populates database with mock-data.js equivalents as real rows.

Run after migrations: `python seed.py`
Idempotent: drops then recreates all seed data.
"""
import asyncio
import uuid
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import (
    Platform, Campaign, DailyMetric, Anomaly, Action,
    AuditLog, CreativeDraft, TelegramMessage,
)

random.seed(42)
TODAY = date(2026, 5, 25)  # matches frontend mock-data anchor


PLATFORMS_SEED = [
    {"slug": "meta",     "name": "Meta",     "color": "#1877F2", "icon": "M", "budget_share": 0.60},
    {"slug": "tiktok",   "name": "TikTok",   "color": "#00D4AA", "icon": "T", "budget_share": 0.25},
    {"slug": "snapchat", "name": "Snapchat", "color": "#FFFC00", "icon": "S", "budget_share": 0.15},
    {"slug": "shopify",  "name": "Shopify",  "color": "#96BF48", "icon": "$", "budget_share": 0.0},
]

CAMPAIGNS_SEED = [
    ("c1", "meta",     "KSA — TOF — Beauty Essentials — Broad",  "active",  180),
    ("c2", "meta",     "KSA — MOF — Retarget — VC 7d",           "active",  120),
    ("c3", "meta",     "KSA — BOF — DPA — Catalog",              "active",   80),
    ("c4", "meta",     "KSA — TOF — Summer Collection — LAL",    "warning", 100),
    ("c5", "tiktok",   "TT — KSA — Spark Ads — Skincare",        "active",  100),
    ("c6", "tiktok",   "TT — KSA — In-Feed — Unboxing",          "active",   80),
    ("c7", "tiktok",   "TT — KSA — TopView — Launch",            "paused",   60),
    ("c8", "snapchat", "SC — KSA — Story Ads — Flash Sale",      "active",   60),
    ("c9", "snapchat", "SC — KSA — Collection — New Arrivals",   "warning",  50),
]


def gen_daily_metrics(campaign, platform_slug):
    """Mirrors mock-data.js generateDailyMetrics() shape — 14 days back from TODAY."""
    metrics = []
    base_share = {
        "meta": 0.60, "tiktok": 0.25, "snapchat": 0.15,
    }[platform_slug]
    # campaign-level scaling so all 9 campaigns sum to ~$700/day blended
    n_per_platform = sum(1 for c in CAMPAIGNS_SEED if c[1] == platform_slug)
    daily_total_per_campaign = (700 * base_share) / n_per_platform

    for i in range(14):
        d = TODAY - timedelta(days=13 - i)
        is_salary_week = d.day >= 25 or d.day <= 2
        boost = 1.18 if is_salary_week else 1.0
        weekend_dip = 0.88 if d.weekday() in (4, 5) else 1.0  # Fri/Sat KSA

        spend = daily_total_per_campaign * (0.85 + random.random() * 0.3) * boost * weekend_dip
        cpa_band = {"meta": 13.0, "tiktok": 14.5, "snapchat": 16.0}[platform_slug]
        conv = max(1, round(spend / (cpa_band + random.random() * 4)))
        aov_band = {"meta": 38, "tiktok": 36, "snapchat": 34}[platform_slug]
        revenue = conv * (aov_band + random.random() * 10)
        impressions = round(spend / 6.2 * 1000)
        clicks = round(impressions * (0.014 + random.random() * 0.012))

        metrics.append({
            "date": d,
            "spend": round(spend, 2),
            "conversions": conv,
            "revenue": round(revenue, 2),
            "impressions": impressions,
            "clicks": clicks,
            "frequency": round(2.0 + random.random() * 4.5, 2),
            "ctr": round(clicks / impressions, 6) if impressions else 0,
            "cpm": round(spend / impressions * 1000, 4) if impressions else 0,
            "cpc": round(spend / clicks, 4) if clicks else 0,
            "cpa": round(spend / conv, 4) if conv else 0,
            "roas": round(revenue / spend, 4) if spend else 0,
            "hook_rate": round(0.30 + random.random() * 0.25, 4),
            "thumb_stop_rate": round(0.18 + random.random() * 0.12, 4),
            "is_provisional": (TODAY - d).days < 7,
        })
    return metrics


CREATIVE_DRAFTS_SEED = [
    {
        "platform": "tiktok", "campaign": "TT — KSA — Spark Ads — Skincare",
        "hook": "pain_point", "status": "draft",
        "headline": "بشرتك تستاهل الأفضل",
        "primary_text": "تعبتي من المنتجات اللي ما تنفع؟ جربي روتين العناية الكوري الأصلي — نتائج من أول أسبوع",
        "cta": "اطلب الآن",
        "headline_en": "Your skin deserves the best",
        "primary_text_en": "Tired of products that don't work? Try the original Korean skincare routine — results from week one",
    },
    {
        "platform": "tiktok", "campaign": "TT — KSA — Spark Ads — Skincare",
        "hook": "social_proof", "status": "draft",
        "headline": "أكثر من ٥٠٠٠ طلب",
        "primary_text": "الكل يسأل عن سر بشرتهم — المنتج اللي غيّر روتين العناية عند بنات السعودية",
        "cta": "اكتشف المزيد",
        "headline_en": "Over 5,000 orders",
        "primary_text_en": "Everyone asks about their skin secret — the product that changed Saudi women's skincare routine",
    },
    {
        "platform": "tiktok", "campaign": "TT — KSA — Spark Ads — Skincare",
        "hook": "scarcity", "status": "draft",
        "headline": "الكمية محدودة",
        "primary_text": "آخر ١٠٠ قطعة من التشكيلة الصيفية — توصيل سريع لكل مدن المملكة",
        "cta": "احصل عليه",
        "headline_en": "Limited quantity",
        "primary_text_en": "Last 100 pieces of the summer collection — fast delivery to all cities in the Kingdom",
    },
    {
        "platform": "meta", "campaign": "KSA — TOF — Beauty Essentials — Broad",
        "hook": "identity", "status": "approved",
        "headline": "للسعوديين بس",
        "primary_text": "منتجات عناية مصممة لبشرتنا وجونا — مو أي كلام، نتائج حقيقية",
        "cta": "جرب الآن",
        "headline_en": "For Saudis only",
        "primary_text_en": "Skincare products designed for our skin and our climate — not just talk, real results",
    },
    {
        "platform": "meta", "campaign": "KSA — MOF — Retarget — VC 7d",
        "hook": "curiosity", "status": "draft",
        "headline": "شفتيه وما طلبتي؟",
        "primary_text": "المنتج اللي عجبك لسا متوفر — بس الخصم ينتهي بكرة",
        "cta": "اطلب الآن",
        "headline_en": "Saw it but didn't order?",
        "primary_text_en": "The product you liked is still available — but the discount ends tomorrow",
    },
]

ANOMALIES_SEED = [
    {
        "severity": "critical", "platform": "meta", "campaign": "KSA — TOF — Summer Collection — LAL",
        "title": "CPA spike on Summer Collection LAL",
        "detail": "CPA z-score 3.4 against 28d baseline. Sustained 72h. Frequency 6.8 (threshold: 4.0). Creative fatigue confirmed.",
        "metric": "CPA", "value": "$24.29", "baseline": "$14.80", "z_score": 3.4,
        "hours_ago": 1,
    },
    {
        "severity": "warning", "platform": "snapchat", "campaign": "SC — KSA — Collection — New Arrivals",
        "title": "ROAS declining on SC Collection",
        "detail": "ROAS dropped from 2.1× to 1.35× over 5 days. CTR down 38% from peak. Approaching kill threshold (0.8× over 7d).",
        "metric": "ROAS", "value": "1.35×", "baseline": "2.10×", "z_score": 2.1,
        "hours_ago": 2,
    },
    {
        "severity": "info", "platform": "tiktok", "campaign": "TT — KSA — Spark Ads — Skincare",
        "title": "Salary week boost detected",
        "detail": "Conversion rate up 18% across TT campaigns. Matches historical salary-week pattern (25th–end of month). No action needed — seasonal adjustment applied.",
        "metric": "CVR", "value": "+18%", "baseline": "Expected", "z_score": 0.8,
        "hours_ago": 3,
    },
]

ACTIONS_SEED = [
    {
        "tier": 3, "type": "budget_increase", "platform": "meta",
        "campaign": "KSA — TOF — Beauty Essentials — Broad",
        "description": "Increase daily budget $180 → $220 (+22%)",
        "rationale": "ROAS 3.07× (target 2.5×) over 7d, 82 conversions, no fatigue signal. CTR within 10% of peak. Room to scale — currently at 67% of campaign cap.",
        "impact": "high", "risk": "medium", "estimated_gain": "+$340/week revenue",
        "params": {"old_budget": 180, "new_budget": 220},
        "expires_in_hours": 12, "status": "pending",
    },
    {
        "tier": 3, "type": "pause_campaign", "platform": "meta",
        "campaign": "KSA — TOF — Summer Collection — LAL",
        "description": "Pause campaign — CPA 1.62× target, ROAS 0.50× target",
        "rationale": "CPA $24.29 vs $15 target for 3 consecutive days. ROAS 1.24× vs 2.5× target. Frequency 6.8 with CTR drop 47% from peak. Creative fatigue confirmed.",
        "impact": "high", "risk": "low", "estimated_gain": "Save ~$97/day wasted spend",
        "params": {"action": "pause"},
        "expires_in_hours": 12, "status": "pending",
    },
    {
        "tier": 3, "type": "creative_publish", "platform": "tiktok",
        "campaign": "TT — KSA — Spark Ads — Skincare",
        "description": "Publish 3 new Khaliji Arabic ad variants",
        "rationale": "Current creative approaching 21-day threshold. CTR down 18% from peak. 3 fresh variants generated with pain-point, social-proof, and scarcity hooks.",
        "impact": "medium", "risk": "low", "estimated_gain": "Refresh creative before fatigue",
        "params": {"draft_count": 3},
        "expires_in_hours": 10, "status": "pending",
    },
    {
        "tier": 2, "type": "budget_realloc", "platform": "snapchat",
        "campaign": "SC — KSA — Collection — New Arrivals",
        "description": "Shift $15/day from SC Collection → SC Flash Sale",
        "rationale": "Flash Sale ROAS 2.40× vs Collection 1.35×. Reallocating 30% of underperformer budget to proven performer. Within Tier 2 limits (<20%, <$200).",
        "impact": "medium", "risk": "low", "estimated_gain": "+$45/week revenue",
        "params": {"from_campaign": "c9", "to_campaign": "c8", "amount": 15},
        "expires_in_hours": 0, "status": "approved",
        "revoke_window_seconds": 300,
    },
]

AUDIT_SEED = [
    ("action_proposed",   3, "Budget increase proposed: Beauty Essentials $180→$220", "system", 32),
    ("anomaly_detected",  1, "CPA spike detected on Summer Collection LAL (z=3.4)",   "system", 31),
    ("budget_realloc",    2, "SC: $15/day shifted Collection→Flash Sale (auto-approved)", "system", 30),
    ("creative_generated", 1, "3 Khaliji Arabic variants generated for TT Spark Ads", "system", 165),
    ("data_pull",         1, "Hot path: 30-min refresh completed (Meta, TikTok, Snapchat)", "system", 180),
    ("reconciliation",    1, "Cold path: 7-day attribution backfill completed. 12 CPA adjustments.", "system", 360),
    ("action_approved",   3, "Operator approved: Pause TT TopView Launch campaign", "operator", 645),
    ("campaign_paused",   3, "TT TopView Launch paused via API", "system", 646),
    ("digest_sent",       1, "Daily performance digest sent to Telegram", "system", 870),
    ("action_rejected",   3, "Operator rejected: Audience expansion on Meta BOF DPA", "operator", 1080),
]


async def seed():
    async with AsyncSessionLocal() as db:  # type: AsyncSession
        # Wipe in FK-safe order (AuditLog excluded — append-only trigger blocks DELETE)
        for tbl in [Anomaly, Action, CreativeDraft, TelegramMessage, DailyMetric, Campaign, Platform]:
            await db.execute(delete(tbl))
        await db.commit()

        # Platforms
        platforms = {}
        for p in PLATFORMS_SEED:
            row = Platform(id=uuid.uuid4(), **p)
            db.add(row)
            platforms[p["slug"]] = row
        await db.flush()

        # Campaigns + daily metrics
        campaigns_by_name = {}
        for slug_id, plat, name, status, budget in CAMPAIGNS_SEED:
            c = Campaign(
                id=uuid.uuid4(),
                external_id=slug_id,
                platform_id=platforms[plat].id,
                name=name,
                status=status,
                daily_budget=budget,
                target_cpa=15.00,
                target_roas=2.50,
            )
            db.add(c)
            campaigns_by_name[name] = c
            await db.flush()

            for m in gen_daily_metrics(c, plat):
                db.add(DailyMetric(
                    id=uuid.uuid4(),
                    entity_type="campaign",
                    entity_id=c.id,
                    platform_id=platforms[plat].id,
                    **m,
                ))

        # Anomalies
        now = datetime.now(timezone.utc)
        for a in ANOMALIES_SEED:
            campaign = campaigns_by_name.get(a["campaign"])
            db.add(Anomaly(
                id=uuid.uuid4(),
                entity_type="campaign",
                entity_id=campaign.id if campaign else uuid.uuid4(),
                platform_id=platforms[a["platform"]].id,
                severity=a["severity"],
                title=a["title"], detail=a["detail"],
                metric=a["metric"], value=a["value"], baseline=a["baseline"],
                z_score=a["z_score"],
                created_at=now - timedelta(hours=a["hours_ago"]),
            ))

        # Actions
        for act in ACTIONS_SEED:
            campaign = campaigns_by_name.get(act["campaign"])
            expires_at = (now + timedelta(hours=act["expires_in_hours"])) if act["expires_in_hours"] else None
            revoke_deadline = None
            if "revoke_window_seconds" in act:
                revoke_deadline = now + timedelta(seconds=act["revoke_window_seconds"])
            db.add(Action(
                id=uuid.uuid4(),
                tier=act["tier"], type=act["type"],
                platform_id=platforms[act["platform"]].id,
                campaign_id=campaign.id if campaign else None,
                description=act["description"], rationale=act["rationale"],
                params=act["params"],
                impact=act["impact"], risk=act["risk"], estimated_gain=act["estimated_gain"],
                status=act["status"],
                expires_at=expires_at,
                revoke_deadline=revoke_deadline,
                decision_actor="system" if act["status"] == "approved" else None,
                decision_at=now if act["status"] == "approved" else None,
            ))

        # Creative drafts
        for d in CREATIVE_DRAFTS_SEED:
            campaign = campaigns_by_name.get(d["campaign"])
            db.add(CreativeDraft(
                id=uuid.uuid4(),
                platform_id=platforms[d["platform"]].id,
                campaign_id=campaign.id if campaign else None,
                hook=d["hook"], status=d["status"],
                headline=d["headline"], primary_text=d["primary_text"], cta=d["cta"],
                headline_en=d["headline_en"], primary_text_en=d["primary_text_en"],
                model_used="seed",
            ))

        # Audit log — append-only; only seed if table is currently empty
        existing_audit = (await db.execute(select(AuditLog).limit(1))).first()
        if not existing_audit:
            for action, tier, detail, actor, minutes_ago in AUDIT_SEED:
                db.add(AuditLog(
                    id=uuid.uuid4(),
                    action=action, tier=tier, detail=detail, actor=actor,
                    timestamp=now - timedelta(minutes=minutes_ago),
                ))

        await db.commit()
        print(f"Seeded: {len(PLATFORMS_SEED)} platforms, {len(CAMPAIGNS_SEED)} campaigns, "
              f"{len(CAMPAIGNS_SEED) * 14} daily metrics, {len(ANOMALIES_SEED)} anomalies, "
              f"{len(ACTIONS_SEED)} actions, {len(CREATIVE_DRAFTS_SEED)} creative drafts, "
              f"{len(AUDIT_SEED)} audit entries.")


if __name__ == "__main__":
    asyncio.run(seed())
