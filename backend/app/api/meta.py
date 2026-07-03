"""Meta Marketing API read endpoints.

All require a valid AdPilot JWT. Proxy reads to Meta using the server-side
long-lived token (no end-user OAuth flow).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from httpx import HTTPStatusError
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.platforms.meta import get_meta_client, MetaAuthError
from app.analytics.meta_audit import audit_metrics
from pydantic import BaseModel

from app.schemas.meta_create import (
    CreateMetaCampaignRequest,
    CreateMetaCampaignResult,
    AdSetSpec,
    CreatedAdSet,
    MetaObjective,
)
from app.services.meta_campaigns import (
    create_campaign_with_adset,
    create_campaign_only,
    add_ad_set_to_campaign,
    set_campaign_status,
    set_adset_status,
    delete_campaign,
)
from app.settings import get_settings

router = APIRouter(prefix="/meta", tags=["meta"])


async def _call(path: str, params: dict | None = None) -> dict:
    client = get_meta_client()
    try:
        return await client.get(path, params=params)
    except MetaAuthError as e:
        raise HTTPException(status_code=503, detail=f"Meta auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Meta API error: {e.response.text[:400]}",
        )


@router.get("/status")
async def status(_user=Depends(get_current_user)):
    s = get_settings()
    return {
        "configured": bool(s.meta_access_token and s.meta_ad_account_id),
        "ad_account_id": s.meta_ad_account_id or None,
    }


@router.get("/targeting/interests")
async def search_interests(
    q: str = Query(..., min_length=2, description="Interest search term"),
    _user=Depends(get_current_user),
):
    """Search Meta's interest catalog (for detailed targeting)."""
    data = await _call("/search", params={"type": "adinterest", "q": q, "limit": 15})
    out = [
        {"id": r["id"], "name": r["name"],
         "audience": r.get("audience_size_upper_bound") or r.get("audience_size_lower_bound"),
         "path": " › ".join(r.get("path", [])) if r.get("path") else None}
        for r in data.get("data", [])
    ]
    return {"interests": out}


@router.get("/account")
async def account(_user=Depends(get_current_user)):
    s = get_settings()
    return await _call(
        f"/{s.meta_ad_account_id}",
        params={"fields": "name,account_status,currency,timezone_name,amount_spent,balance,funding_source_details"},
    )


@router.get("/campaigns")
async def campaigns(_user=Depends(get_current_user)):
    s = get_settings()
    return await _call(
        f"/{s.meta_ad_account_id}/campaigns",
        params={"fields": "name,status,effective_status,objective,daily_budget,lifetime_budget,created_time", "limit": 100},
    )


@router.get("/adsets")
async def adsets(_user=Depends(get_current_user)):
    s = get_settings()
    return await _call(
        f"/{s.meta_ad_account_id}/adsets",
        params={"fields": "name,status,campaign_id,daily_budget,optimization_goal,targeting", "limit": 100},
    )


@router.get("/ads")
async def ads(_user=Depends(get_current_user)):
    s = get_settings()
    return await _call(
        f"/{s.meta_ad_account_id}/ads",
        params={"fields": "name,status,adset_id,creative", "limit": 100},
    )


@router.get("/campaigns/{campaign_id}/adsets")
async def campaign_adsets(campaign_id: str, _user=Depends(get_current_user)):
    """Ad sets belonging to one campaign, with status + budget."""
    return await _call(
        f"/{campaign_id}/adsets",
        params={"fields": "name,status,effective_status,daily_budget,optimization_goal", "limit": 100},
    )


@router.get("/insights")
async def insights(
    level: str = Query("campaign", description="account | campaign | adset | ad"),
    date_preset: str = Query("last_7d"),
    _user=Depends(get_current_user),
):
    s = get_settings()
    return await _call(
        f"/{s.meta_ad_account_id}/insights",
        params={
            "level": level,
            "date_preset": date_preset,
            "fields": "campaign_name,spend,impressions,clicks,ctr,cpc,reach",
            "limit": 100,
        },
    )


def _sum_action(rows: list[dict], key: str, action_types: tuple[str, ...]) -> float:
    """Sum a purchase-like action across an insights row's actions/action_values."""
    total = 0.0
    for a in rows or []:
        if a.get("action_type") in action_types:
            try:
                total += float(a.get(key, a.get("value", 0)) or 0)
            except (TypeError, ValueError):
                pass
    return total


_PURCHASE_TYPES = ("purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase")


@router.get("/optimizer/metrics-catalog")
async def optimizer_metrics_catalog(_user=Depends(get_current_user)):
    """Every metric the optimizer can read, grouped, with its data dependency."""
    from app.analytics.metric_catalog import CATALOG
    return {"metrics": [
        {"key": m.key, "label": m.label, "group": m.group, "requires": m.requires, "desc": m.desc}
        for m in CATALOG
    ]}


@router.get("/optimizer/metrics")
async def optimizer_metrics(
    date_preset: str = Query("last_7d"),
    _user=Depends(get_current_user),
):
    """Per active ad set: every catalog metric's live value (None = unavailable
    for this account/period). Powers the metrics table + selector UI."""
    from app.services.optimizer_data import build_adset_metrics
    try:
        rows = await build_adset_metrics(date_preset)
    except MetaAuthError as e:
        raise HTTPException(503, f"Meta auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(e.response.status_code, f"Meta API error: {e.response.text[:400]}")
    return {"date_preset": date_preset, "count": len(rows), "entities": rows}


@router.get("/optimizer/recommendations")
async def optimizer_recommendations(
    date_preset: str = Query("last_7d"),
    _user=Depends(get_current_user),
):
    """Run the deterministic decision engine over every active ad set and return
    the recommendations. READ-ONLY — nothing is executed here (v1). Config uses
    placeholder defaults until the settings panel is wired."""
    from app.analytics.optimizer import AccountConfig, evaluate
    from app.services.optimizer_data import build_adset_snapshots

    # ponytail: placeholder config until a settings panel stores real values.
    cfg = AccountConfig(
        breakeven_roas=1.5,
        target_cpa=10.0,
        currency="EGP",
        human_approval_spend_threshold=1_000.0,
    )
    try:
        snapshots = await build_adset_snapshots(date_preset)
    except MetaAuthError as e:
        raise HTTPException(503, f"Meta auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(e.response.status_code, f"Meta API error: {e.response.text[:400]}")
    recs = [evaluate(sn, cfg).to_json() for sn in snapshots]
    return {
        "date_preset": date_preset,
        "config": {"breakeven_roas": cfg.breakeven_roas, "target_cpa": cfg.target_cpa,
                   "currency": cfg.currency, "approval_threshold": cfg.human_approval_spend_threshold},
        "count": len(recs),
        "recommendations": recs,
        "note": "Read-only preview — no actions are executed. Trend/history rules await day-by-day data.",
    }


@router.get("/audit")
async def audit(
    date_preset: str = Query("last_7d"),
    _user=Depends(get_current_user),
):
    """Deterministic KPI audit of the whole ad account for the period.

    Pulls account-level insights, derives the six audited KPIs, then grades them
    against Meta benchmarks and returns a 0-100 score + tiered fixes. Pure rules
    (see analytics/meta_audit.py) — no LLM, same input → same result."""
    s = get_settings()
    data = await _call(
        f"/{s.meta_ad_account_id}/insights",
        params={
            "level": "account",
            "date_preset": date_preset,
            "fields": "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,action_values",
            "limit": 1,
        },
    )
    rows = data.get("data", [])
    if not rows:
        return {"available": False, "date_preset": date_preset,
                "message": "No delivery data for this period yet."}
    r = rows[0]

    def num(k: str) -> float | None:
        v = r.get(k)
        try:
            return float(v) if v is not None else None
        except (TypeError, ValueError):
            return None

    clicks = num("clicks") or 0
    spend = num("spend") or 0
    purchases = _sum_action(r.get("actions", []), "value", _PURCHASE_TYPES)
    revenue = _sum_action(r.get("action_values", []), "value", _PURCHASE_TYPES)

    metrics = {
        "ctr": num("ctr"),
        "cpc": num("cpc"),
        "cpm": num("cpm"),
        "frequency": num("frequency"),
        # derived (None when we can't compute — audit shows N/A rather than guessing)
        "conv_rate": (purchases / clicks * 100) if clicks and purchases else None,
        "roas": (revenue / spend) if spend and revenue else None,
    }
    result = audit_metrics(metrics)
    return {
        "available": True,
        "date_preset": date_preset,
        "spend": spend,
        "score": result.score,
        "assessment": result.assessment,
        "kpis": [
            {"key": k.key, "label": k.label,
             "value": k.value, "display": (k.fmt.format(k.value) if k.value is not None else "N/A"),
             "grade": k.grade}
            for k in result.kpis
        ],
        "dimensions": [{"name": d.name, "score": d.score, "max": d.max} for d in result.dimensions],
        "recommendations": result.recommendations,
    }


@router.post("/campaigns/create", response_model=CreateMetaCampaignResult)
async def create_campaign(
    body: CreateMetaCampaignRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Create a PAUSED campaign + ad set, plus a PAUSED ad creative + ad when a
    creative_file_id is provided (media via Google Drive OAuth)."""
    try:
        return await create_campaign_with_adset(body, db)
    except MetaAuthError as e:
        raise HTTPException(503, f"Meta auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Meta API error: {e.response.text[:400]}",
        )


class CreateCampaignShellRequest(BaseModel):
    name: str
    objective: MetaObjective = MetaObjective.OUTCOME_TRAFFIC
    campaign_daily_budget: float | None = None


@router.post("/campaigns")
async def create_campaign_shell(
    body: CreateCampaignShellRequest,
    _user=Depends(get_current_user),
):
    """Create JUST the PAUSED campaign (fast, no uploads). The web app calls this
    first, then adds ad sets one at a time so big-video uploads each get their
    own short request (avoids the multi-video 502)."""
    try:
        campaign_id = await create_campaign_only(body.name, body.objective, body.campaign_daily_budget)
        return {"campaign_id": campaign_id, "status": "PAUSED"}
    except MetaAuthError as e:
        raise HTTPException(503, f"Meta auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(e.response.status_code, f"Meta API error: {e.response.text[:400]}")


@router.post("/campaigns/{campaign_id}/adsets/create", response_model=CreatedAdSet)
async def create_one_ad_set(
    campaign_id: str,
    spec: AdSetSpec,
    index: int = Query(1, description="1-based position, for naming"),
    name: str = Query("Campaign", description="Campaign name, for ad-set naming"),
    objective: MetaObjective = Query(MetaObjective.OUTCOME_TRAFFIC),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Create ONE ad set (+ its ad/creative) under an existing campaign."""
    try:
        return await add_ad_set_to_campaign(campaign_id, name, objective, spec, index, db)
    except MetaAuthError as e:
        raise HTTPException(503, f"Meta auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(e.response.status_code, f"Meta API error: {e.response.text[:400]}")


class SetStatusRequest(BaseModel):
    status: str  # "ACTIVE" | "PAUSED"


@router.post("/campaigns/{campaign_id}/status")
async def campaign_status(
    campaign_id: str,
    body: SetStatusRequest,
    _user=Depends(get_current_user),
):
    """Activate or pause a campaign and all of its ad sets + ads.

    Activating starts real ad delivery (and spend); the frontend gates this
    behind a confirmation dialog.
    """
    try:
        return await set_campaign_status(campaign_id, body.status)
    except MetaAuthError as e:
        raise HTTPException(503, f"Meta auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Meta API error: {e.response.text[:400]}",
        )


@router.delete("/campaigns/{campaign_id}")
async def remove_campaign(campaign_id: str, _user=Depends(get_current_user)):
    """Delete a campaign (and its ad sets + ads). Irreversible — the frontend
    gates this behind a confirmation dialog."""
    try:
        return await delete_campaign(campaign_id)
    except MetaAuthError as e:
        raise HTTPException(503, f"Meta auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Meta API error: {e.response.text[:400]}",
        )


@router.post("/adsets/{adset_id}/status")
async def adset_status(
    adset_id: str,
    body: SetStatusRequest,
    _user=Depends(get_current_user),
):
    """Activate or pause a single ad set (and its ads), leaving the rest of the
    campaign untouched. Activating starts real spend; the frontend confirms it."""
    try:
        return await set_adset_status(adset_id, body.status)
    except MetaAuthError as e:
        raise HTTPException(503, f"Meta auth error: {e}")
    except HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Meta API error: {e.response.text[:400]}",
        )
