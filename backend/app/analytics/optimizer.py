"""Deterministic Meta Ads decision engine.

Implements the media-buying analyst spec: given one entity's snapshot + account
config, apply Steps 1-7 in EXACT priority order and return a single action with
confidence and a human-approval flag. Pure function, no I/O, no LLM — the same
snapshot always yields the same decision, so it can be trusted to touch live
budgets (behind the loop's guardrails). The LLM only narrates the result.

Priority order (higher wins):
  Step 7 do-not-touch overrides  >  Step 2 hard-fail KILL  >  Step 1 gate
  >  Step 3 diagnosis  >  Step 4 ROAS/CPA kill  >  Step 5 scale  >  Step 6 ad-level.

Run `python -m app.analytics.optimizer` for the self-check.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Literal

Action = Literal["KILL", "SCALE", "HOLD", "REFRESH_CREATIVE", "PAUSE", "DUPLICATE_WINNER"]
Confidence = Literal["high", "medium", "low"]


@dataclass
class AccountConfig:
    breakeven_roas: float
    target_cpa: float
    currency: str = "USD"
    human_approval_spend_threshold: float = 1e12  # placeholder: effectively "always require" off
    min_spend_multiplier_before_judgment: float = 1.5
    min_days_before_judgment: int = 3
    learning_phase_min_conversions: int = 50
    learning_phase_window_days: int = 7
    budget_scale_step_pct: int = 25
    budget_scale_max_frequency_days: int = 3


@dataclass
class EntitySnapshot:
    """One campaign / ad set / ad at decision time. Fields that Meta doesn't
    supply for this entity are None → rules needing them are skipped (HOLD)."""
    entity_id: str
    entity_name: str
    level: Literal["campaign", "ad_set", "ad"] = "ad_set"

    spend: float = 0.0
    roas: float | None = None
    cpa: float | None = None
    ctr: float | None = None
    frequency: float | None = None
    conversions: int = 0
    conversions_in_window: int | None = None  # last learning_phase_window_days
    days_running: int = 0

    # 7-day trend signals (percent change, e.g. 0.30 = +30%). None = unknown.
    cpm_change_7d: float | None = None
    ctr_change_7d: float | None = None
    cpa_rising_days: int = 0            # consecutive days CPA increased
    ctr_declining_days: int = 0         # consecutive days CTR declined

    # creative / funnel signals
    hook_rate: float | None = None            # 3s plays / impressions
    account_avg_hook_rate: float | None = None
    cost_per_atc: float | None = None         # add-to-cart
    cost_per_atc_normal: bool | None = None    # is ATC cost within normal range?
    audience_type: Literal["cold", "warm", "retargeting"] = "cold"

    # history
    days_since_last_edit: int | None = None    # None = never edited
    days_since_last_refresh: int | None = None
    times_scaled: int = 0
    roas_ge_scale_threshold_days: int = 0      # consecutive days roas >= 1.3x breakeven

    # ad-level (within an ad set)
    spend_share: float | None = None           # this ad's share of ad-set spend (0-1)

    # overrides
    is_manual_test: bool = False
    account_daily_spend_change_pct: float = 0.0  # today's account-level swing


@dataclass
class Recommendation:
    entity_id: str
    entity_name: str
    summary: str
    diagnosis: str
    matched_rule: str
    recommended_action: Action
    confidence: Confidence
    human_approval_required: bool
    gate_check: Literal["passed", "held", "hard_fail"]
    metrics_snapshot: dict = field(default_factory=dict)

    def to_json(self) -> dict:
        return {
            "entity_id": self.entity_id,
            "entity_name": self.entity_name,
            "metrics_snapshot": self.metrics_snapshot,
            "gate_check": self.gate_check,
            "diagnosis": self.diagnosis,
            "matched_rule": self.matched_rule,
            "recommended_action": self.recommended_action,
            "confidence": self.confidence,
            "human_approval_required": self.human_approval_required,
        }


def _snapshot(e: EntitySnapshot) -> dict:
    return {
        "spend": e.spend, "roas": e.roas, "cpa": e.cpa, "ctr": e.ctr,
        "frequency": e.frequency,
        "cpm_change_7d": (f"{e.cpm_change_7d:+.0%}" if e.cpm_change_7d is not None else ""),
    }


def _needs_approval(e: EntitySnapshot, cfg: AccountConfig, confidence: Confidence) -> bool:
    # Spec: approval required if spend over threshold OR confidence not high.
    return e.spend > cfg.human_approval_spend_threshold or confidence != "high"


def evaluate(e: EntitySnapshot, cfg: AccountConfig) -> Recommendation:
    """Return one action for the entity, applying Steps 1-7 in priority order."""
    def rec(action: Action, confidence: Confidence, diagnosis: str, rule: str,
            summary: str, gate: str = "passed") -> Recommendation:
        return Recommendation(
            entity_id=e.entity_id, entity_name=e.entity_name,
            summary=summary, diagnosis=diagnosis, matched_rule=rule,
            recommended_action=action, confidence=confidence,
            human_approval_required=_needs_approval(e, cfg, confidence),
            gate_check=gate, metrics_snapshot=_snapshot(e),
        )

    # ── STEP 7 — absolute do-not-touch overrides (beat everything except Step 2) ──
    override_hold = None
    if e.is_manual_test:
        override_hold = rec("HOLD", "high", "", "Step 7: manual test flag",
                            f"{e.entity_name} is a flagged manual test — untouched.", gate="held")
    elif abs(e.account_daily_spend_change_pct) > 0.15:
        override_hold = rec("HOLD", "high", "", "Step 7: account spend already moved >15% today",
                            f"Account daily spend already swung {e.account_daily_spend_change_pct:+.0%} — holding to avoid compounding volatility.", gate="held")

    # ── STEP 2 — hard-fail KILL (the only thing that overrides Step 1 AND Step 7) ──
    if e.conversions == 0 and e.spend >= 3 * cfg.target_cpa:
        return rec("KILL", "high",
                   "zero conversions at 3x target CPA",
                   "Step 2: hard-fail kill",
                   f"{e.entity_name} spent {e.spend:g} {cfg.currency} with 0 conversions (>=3x target CPA) — kill.",
                   gate="hard_fail")

    if override_hold is not None:
        return override_hold

    # ── STEP 1 — pre-decision gate ──
    if e.days_running < cfg.min_days_before_judgment:
        return rec("HOLD", "high", "", "Step 1: still in evaluation window",
                   f"{e.entity_name} has run {e.days_running}d (<{cfg.min_days_before_judgment}) — too early to judge.", gate="held")
    if e.spend < cfg.target_cpa * cfg.min_spend_multiplier_before_judgment:
        return rec("HOLD", "high", "", "Step 1: insufficient spend to judge",
                   f"{e.entity_name} spent {e.spend:g} (<{cfg.min_spend_multiplier_before_judgment}x target CPA) — not enough to judge.", gate="held")

    # learning-phase / recent-edit soft holds: block edits unless a Step-2 hard-fail
    # already fired (it didn't, or we'd have returned). Track for later steps.
    in_learning = (
        e.conversions_in_window is not None
        and e.conversions_in_window < cfg.learning_phase_min_conversions
        and e.days_running <= 7
    )
    recently_edited = (
        e.days_since_last_edit is not None
        and e.days_since_last_edit < cfg.budget_scale_max_frequency_days
    )
    if recently_edited:
        return rec("HOLD", "high", "", "Step 1: edited within cooldown window",
                   f"{e.entity_name} was edited {e.days_since_last_edit}d ago — hold to let learning stabilize.", gate="held")

    # ── STEP 3 — diagnostic pass (before any non-hard-fail KILL) ──
    # priority order as listed in the spec
    if (e.cpm_change_7d is not None and e.cpm_change_7d > 0.30
            and (e.ctr_change_7d is None or abs(e.ctr_change_7d) <= 0.10)):
        return rec("HOLD", "medium", "auction competition increased",
                   "Step 3: CPM up >30%, CTR/CVR stable",
                   f"{e.entity_name}: CPM up {e.cpm_change_7d:+.0%} but engagement stable — auction pressure, not a creative problem. Flag for audience expansion.")

    if (e.ctr_change_7d is not None and e.ctr_change_7d < -0.25
            and e.frequency is not None and e.frequency and e.ctr_declining_days >= 1):
        if e.days_since_last_refresh is not None and e.days_since_last_refresh <= 14:
            return rec("KILL", "high", "creative fatigue, already refreshed <14d ago",
                       "Step 3: fatigue after prior refresh",
                       f"{e.entity_name}: CTR down {e.ctr_change_7d:+.0%} with rising frequency AND already refreshed {e.days_since_last_refresh}d ago — kill.")
        return rec("REFRESH_CREATIVE", "high", "creative fatigue",
                   "Step 3: CTR down >25% + frequency rising",
                   f"{e.entity_name}: CTR down {e.ctr_change_7d:+.0%} with rising frequency — refresh the creative.")

    if (e.cost_per_atc_normal is True and e.cpa is not None
            and e.cpa > 1.5 * cfg.target_cpa):
        return rec("HOLD", "medium", "funnel/checkout issue, not an ad problem",
                   "Step 3: ATC cost normal but purchase cost high",
                   f"{e.entity_name}: add-to-cart cost is fine but purchases are expensive — checkout/CRO issue, don't touch the ad. Flag for website review.")

    if (e.hook_rate is not None and e.account_avg_hook_rate
            and e.hook_rate < 0.70 * e.account_avg_hook_rate):
        return rec("REFRESH_CREATIVE", "high", "weak creative hook",
                   "Step 3: hook rate <70% of account avg",
                   f"{e.entity_name}: hook rate {e.hook_rate:.0%} is well below account avg — refresh the creative.")

    if (e.audience_type == "cold" and e.frequency is not None and e.frequency > 4.0
            and e.ctr_declining_days >= 3):
        return rec("KILL", "high", "audience saturation (cold)",
                   "Step 3: frequency >4 on cold audience, CTR declining 3d+",
                   f"{e.entity_name}: frequency {e.frequency:.1f} on a cold audience with 3+ days of falling CTR — saturated, kill.")

    if (e.audience_type in ("warm", "retargeting") and e.frequency is not None and e.frequency > 6.0):
        return rec("KILL", "high", "over-saturated warm audience",
                   "Step 3: frequency >6 on warm/retargeting audience",
                   f"{e.entity_name}: frequency {e.frequency:.1f} on a warm audience — over-saturated, kill.")

    # ── STEP 4 — ROAS/CPA kill check ──
    if (e.roas is not None and e.roas < cfg.breakeven_roas
            and e.spend >= 2 * cfg.target_cpa and e.days_running >= 3):
        return rec("KILL", "high", "below breakeven ROAS with sufficient spend",
                   "Step 4: roas < breakeven, spend >= 2x CPA, >=3 days",
                   f"{e.entity_name}: ROAS {e.roas:.2f} < breakeven {cfg.breakeven_roas:.2f} on real spend — kill.")
    if (e.cpa is not None and e.cpa > 1.5 * cfg.target_cpa and e.cpa_rising_days >= 3):
        # spec: do NOT auto-kill here; keep monitoring unless diagnosis already caught it
        return rec("HOLD", "medium", "CPA rising but no clear kill diagnosis",
                   "Step 4: CPA >1.5x target rising 3d — monitor",
                   f"{e.entity_name}: CPA {e.cpa:g} climbing for 3 days but no fatigue diagnosis — monitor 2 more days before killing.")

    # ── STEP 5 — scale check ──
    if in_learning:
        return rec("HOLD", "high", "still in learning phase",
                   "Step 1/5: learning phase — avoid edits",
                   f"{e.entity_name} is still in the learning phase — hold, don't stack edits.", gate="held")
    if (e.roas is not None and e.roas >= cfg.breakeven_roas * 1.3 and e.days_running >= 3
            and not recently_edited):
        if e.roas_ge_scale_threshold_days >= 7 and e.times_scaled >= 2:
            return rec("DUPLICATE_WINNER", "high", "consistent winner already scaled twice",
                       "Step 5: scaled 2x + 7d strong — duplicate instead of over-scaling",
                       f"{e.entity_name}: strong ROAS for 7+ days and already scaled twice — duplicate into a fresh ad set rather than pushing this one further.")
        return rec("SCALE", "high", "beating breakeven by 1.3x+",
                   "Step 5: roas >= 1.3x breakeven, no recent edit",
                   f"{e.entity_name}: ROAS {e.roas:.2f} (>=1.3x breakeven) — scale budget +{cfg.budget_scale_step_pct}%. Do not scale again for {cfg.budget_scale_max_frequency_days} days.")

    # ── STEP 6 — ad-level rules (only meaningful at ad level) ──
    if e.level == "ad" and e.spend_share is not None:
        if e.spend_share > 0.80 and e.roas is not None and e.roas >= cfg.breakeven_roas:
            return rec("DUPLICATE_WINNER", "high", "dominant winning ad in the set",
                       "Step 6: >80% spend share + profitable",
                       f"{e.entity_name}: taking >80% of ad-set spend and profitable — duplicate into a fresh ad set; pause the losers.")
        if e.spend_share < 0.05 and e.days_running >= 3:
            return rec("PAUSE", "medium", "algorithm not favoring this ad",
                       "Step 6: <5% spend share after 3 days",
                       f"{e.entity_name}: <5% of ad-set spend after 3 days — pause; it won't gather enough data to judge fairly.")

    # ── default ──
    return rec("HOLD", "high", "no rule triggered",
               "default: metrics within acceptable range",
               f"{e.entity_name}: nothing actionable — hold.")


# ── self-check ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    cfg = AccountConfig(breakeven_roas=1.5, target_cpa=10, currency="EGP",
                        human_approval_spend_threshold=1000)

    # Step 2 hard-fail beats the early gate (days_running < 3)
    r = evaluate(EntitySnapshot("1", "air-fryer", spend=294, conversions=0, days_running=2), cfg)
    assert r.recommended_action == "KILL" and r.gate_check == "hard_fail", r

    # Step 7 override holds a would-be action (but NOT a hard-fail)
    r = evaluate(EntitySnapshot("2", "test-set", spend=50, conversions=1, days_running=5, is_manual_test=True), cfg)
    assert r.recommended_action == "HOLD" and "manual test" in r.matched_rule, r

    # Step 1 gate: too few days
    r = evaluate(EntitySnapshot("3", "young", spend=50, conversions=2, days_running=1), cfg)
    assert r.recommended_action == "HOLD" and r.gate_check == "held", r

    # Step 1 gate: too little spend
    r = evaluate(EntitySnapshot("4", "cheap", spend=5, conversions=0, days_running=5), cfg)
    assert r.recommended_action == "HOLD", r

    # Step 4 ROAS kill
    r = evaluate(EntitySnapshot("5", "loser", spend=40, conversions=3, roas=0.8, days_running=5,
                                conversions_in_window=60), cfg)
    assert r.recommended_action == "KILL" and "Step 4" in r.matched_rule, r

    # Step 5 scale (profitable, seasoned, not recently edited, out of learning)
    r = evaluate(EntitySnapshot("6", "winner", spend=200, conversions=80, roas=2.2, days_running=6,
                                conversions_in_window=80, days_since_last_edit=10), cfg)
    assert r.recommended_action == "SCALE", r

    # Step 5 duplicate instead of over-scaling
    r = evaluate(EntitySnapshot("7", "champ", spend=500, conversions=200, roas=2.4, days_running=10,
                                conversions_in_window=200, days_since_last_edit=10,
                                times_scaled=2, roas_ge_scale_threshold_days=8), cfg)
    assert r.recommended_action == "DUPLICATE_WINNER", r

    # Step 3 fatigue → refresh
    r = evaluate(EntitySnapshot("8", "tired", spend=100, conversions=6, roas=1.6, days_running=8,
                                conversions_in_window=60, ctr_change_7d=-0.30, frequency=3.2,
                                ctr_declining_days=2, days_since_last_edit=9), cfg)
    assert r.recommended_action == "REFRESH_CREATIVE", r

    # Step 1 recent edit → hold
    r = evaluate(EntitySnapshot("9", "justedited", spend=100, conversions=5, roas=2.0, days_running=6,
                                conversions_in_window=60, days_since_last_edit=1), cfg)
    assert r.recommended_action == "HOLD" and "cooldown" in r.matched_rule, r

    # approval flag: high confidence + under threshold → auto (false)
    r = evaluate(EntitySnapshot("10", "cheapkill", spend=40, conversions=0, days_running=5), cfg)
    assert r.recommended_action == "KILL" and r.human_approval_required is False, r
    # over threshold → requires approval even at high confidence
    r = evaluate(EntitySnapshot("11", "bigkill", spend=5000, conversions=0, days_running=5), cfg)
    assert r.human_approval_required is True, r

    print("OK optimizer self-check passed (11 scenarios)")
