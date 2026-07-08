"""Deterministic Meta KPI audit.

Pure functions: given account-level insight metrics, grade each KPI against
the Meta benchmark bands, compute a weighted 0-100 score, and emit findings +
tiered recommendations. No I/O, no LLM — same input always gives same output,
so the operator can trust and act on it. Benchmarks are from the ads-audit skill.

Run `python -m app.analytics.meta_audit` for the self-check.
"""
from __future__ import annotations

from dataclasses import dataclass

# Grade labels, best → worst, with a 0-1 quality weight used for the score.
GRADES = ["Excellent", "Good", "Average", "Below Average", "Poor"]
GRADE_QUALITY = {"Excellent": 1.0, "Good": 0.8, "Average": 0.6, "Below Average": 0.35, "Poor": 0.1}


@dataclass
class Band:
    """A benchmark for one KPI. `bounds` are the 4 cut points between the 5
    grades, ordered from the good end to the bad end. `higher_is_better` flips
    the comparison (CTR: higher good; CPC: lower good)."""
    key: str
    label: str
    higher_is_better: bool
    bounds: tuple[float, float, float, float]  # excellent|good, good|avg, avg|below, below|poor
    fmt: str = "{:.2f}"

    def grade(self, value: float) -> str:
        b = self.bounds
        if self.higher_is_better:
            if value >= b[0]: return "Excellent"
            if value >= b[1]: return "Good"
            if value >= b[2]: return "Average"
            if value >= b[3]: return "Below Average"
            return "Poor"
        else:  # lower is better (cost metrics)
            if value <= b[0]: return "Excellent"
            if value <= b[1]: return "Good"
            if value <= b[2]: return "Average"
            if value <= b[3]: return "Below Average"
            return "Poor"


# Meta benchmarks (from the ads-audit skill). Values in the account currency /
# percent as noted. CTR/conv_rate are percentages (e.g. 1.2 = 1.2%).
BANDS: dict[str, Band] = {
    "ctr":       Band("ctr", "CTR (link)", True, (2.0, 1.2, 0.8, 0.5), "{:.2f}%"),
    "cpc":       Band("cpc", "CPC (link)", False, (0.5, 1.0, 2.0, 3.0), "{:.2f}"),
    "cpm":       Band("cpm", "CPM", False, (5, 10, 15, 20), "{:.2f}"),
    "conv_rate": Band("conv_rate", "Conversion rate", True, (10, 5, 2, 1), "{:.2f}%"),
    "roas":      Band("roas", "ROAS", True, (8, 4, 2, 1), "{:.2f}x"),
    "frequency": Band("frequency", "Frequency (7d)", False, (1.5, 2, 3, 5), "{:.2f}"),
}

# Cost benchmarks (cpc, cpm) are in USD. Approximate USD→local rate so they
# grade correctly in the account currency (an EGP CPM of 91 ≈ $1.85 = excellent,
# not "Poor"). Rough rates — exact FX doesn't matter for banding.
COST_KEYS = {"cpc", "cpm"}
USD_RATE = {"USD": 1.0, "EGP": 48.0, "SAR": 3.75, "AED": 3.67, "MAD": 10.0,
            "TND": 3.1, "DZD": 135.0, "KWD": 0.31, "QAR": 3.64, "BHD": 0.38, "OMR": 0.38}


# Score weights per dimension (must sum to 1.0). Each dimension maps to KPIs.
DIMENSIONS = {
    "Cost Efficiency":     (0.25, ["cpc", "cpm"]),
    "Creative Performance": (0.20, ["ctr", "frequency"]),
    "Conversion Quality":  (0.25, ["conv_rate", "roas"]),
}
# Audience Targeting (0.15) + Budget Optimization (0.15) need per-ad-set/overlap
# data we don't fetch yet — folded in as a neutral baseline so the score still
# sums to 100. ponytail: baseline 0.6 quality until we wire overlap/utilization.
BASELINE_DIMS = {"Audience Targeting": 0.15, "Budget Optimization": 0.15}


@dataclass
class KPIResult:
    key: str
    label: str
    value: float | None
    grade: str | None
    fmt: str


@dataclass
class DimensionScore:
    name: str
    score: float   # 0..weight*100
    max: float


@dataclass
class AuditResult:
    score: int
    assessment: str
    kpis: list[KPIResult]
    dimensions: list[DimensionScore]
    recommendations: dict[str, list[str]]  # tier -> actions


def _assessment(score: int) -> str:
    if score >= 80: return "Excellent — minor optimizations only"
    if score >= 60: return "Good — solid foundation with optimization opportunities"
    if score >= 40: return "Needs Work — significant improvements needed"
    if score >= 20: return "Poor — fundamental strategy issues to address"
    return "Critical — major problems, consider pausing and restructuring"


def audit_metrics(metrics: dict[str, float | None], currency: str = "USD") -> AuditResult:
    """metrics: {ctr, cpc, cpm, conv_rate, roas, frequency} — any may be None
    (unavailable). Missing KPIs are shown as N/A and skipped from scoring.
    Cost KPIs (cpc, cpm) are graded against USD benchmarks scaled to `currency`."""
    rate = USD_RATE.get((currency or "USD").upper(), 1.0)
    kpis: list[KPIResult] = []
    grades: dict[str, str] = {}
    for key, band in BANDS.items():
        v = metrics.get(key)
        if v is None:
            kpis.append(KPIResult(key, band.label, None, None, band.fmt))
            continue
        # scale the value back to USD for cost KPIs so USD bands apply
        graded_value = (float(v) / rate) if key in COST_KEYS else float(v)
        g = band.grade(graded_value)
        grades[key] = g
        kpis.append(KPIResult(key, band.label, float(v), g, band.fmt))

    # Score each measurable dimension by the mean quality of its available KPIs.
    dims: list[DimensionScore] = []
    total = 0.0
    for name, (weight, keys) in DIMENSIONS.items():
        qs = [GRADE_QUALITY[grades[k]] for k in keys if k in grades]
        q = sum(qs) / len(qs) if qs else 0.6  # no data → neutral baseline
        pts = q * weight * 100
        dims.append(DimensionScore(name, round(pts, 1), weight * 100))
        total += pts
    for name, weight in BASELINE_DIMS.items():
        pts = 0.6 * weight * 100
        dims.append(DimensionScore(name, round(pts, 1), weight * 100))
        total += pts

    score = round(total)
    return AuditResult(
        score=score,
        assessment=_assessment(score),
        kpis=kpis,
        dimensions=dims,
        recommendations=_recommend(metrics, grades),
    )


def _recommend(metrics: dict, grades: dict[str, str]) -> dict[str, list[str]]:
    """Rule-driven fixes, from the skill's playbook. Tiered by effort."""
    t1: list[str] = []  # this week, no new assets
    t2: list[str] = []  # 2 weeks, some creative/strategy
    t3: list[str] = []  # 30 days, structural

    freq = metrics.get("frequency")
    if freq is not None and freq > 5:
        t1.append(f"Frequency is {freq:.1f} (oversaturated) — set a frequency cap and refresh creative.")
    elif freq is not None and freq > 3:
        t1.append(f"Frequency is {freq:.1f} — add a frequency cap before fatigue sets in.")

    if grades.get("ctr") in ("Poor", "Below Average"):
        t2.append("CTR is under benchmark — test new hooks/creative (run /ads hooks or /ads creative).")
    if grades.get("cpc") in ("Poor", "Below Average") or grades.get("cpm") in ("Poor", "Below Average"):
        t1.append("Costs (CPC/CPM) are high — pause the weakest ad sets and shift budget to top performers.")
    if grades.get("conv_rate") in ("Poor", "Below Average"):
        t2.append("Conversion rate is low — audit the landing page (message match, load speed, mobile UX).")
    if grades.get("roas") in ("Poor", "Below Average"):
        t3.append("ROAS is below target — restructure the funnel and tighten targeting before scaling budget.")

    if not (t1 or t2 or t3):
        t1.append("Metrics are at or above benchmark — hold course; scale budget gradually on the best ad sets.")
    return {"tier1": t1, "tier2": t2, "tier3": t3}


# ── self-check ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # good account → high score, no urgent fixes
    good = audit_metrics({"ctr": 2.5, "cpc": 0.4, "cpm": 4, "conv_rate": 12, "roas": 9, "frequency": 1.2})
    assert good.score >= 80, good.score
    assert BANDS["ctr"].grade(2.5) == "Excellent"
    assert BANDS["cpc"].grade(0.4) == "Excellent"  # lower is better

    # bad account → low score, urgent fixes present
    bad = audit_metrics({"ctr": 0.3, "cpc": 4.0, "cpm": 25, "conv_rate": 0.5, "roas": 0.5, "frequency": 6})
    assert bad.score < 40, bad.score
    assert BANDS["frequency"].grade(6) == "Poor"
    assert any("Frequency" in r for r in bad.recommendations["tier1"])

    # missing KPIs → graded N/A, still scores on a baseline
    partial = audit_metrics({"ctr": 1.0, "cpc": 1.5, "cpm": None, "conv_rate": None, "roas": None, "frequency": None})
    assert any(k.grade is None for k in partial.kpis)
    assert 0 <= partial.score <= 100

    # currency-aware: EGP CPM 91 (~$1.9) grades Excellent, not Poor
    egp = audit_metrics({"cpm": 91.0, "cpc": 72.0}, currency="EGP")
    cpm_grade = next(k.grade for k in egp.kpis if k.key == "cpm")
    assert cpm_grade in ("Excellent", "Good"), cpm_grade
    # same number in USD is Poor
    usd = audit_metrics({"cpm": 91.0}, currency="USD")
    assert next(k.grade for k in usd.kpis if k.key == "cpm") == "Poor"

    print("OK meta_audit self-check passed:", good.score, bad.score, partial.score, "| EGP cpm:", cpm_grade)
