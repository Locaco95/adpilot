"""Catalog of every metric the optimizer can read, its data source, and what it
depends on. Single source of truth for both the data fetch and the selector UI.

`requires` tells the UI why a metric may be dormant:
  - "" (always available from insights)
  - "pixel"   → needs the Meta pixel sending that event (funnel/purchase)
  - "video"   → only for video ads
  - "history" → needs day-by-day storage (trend metrics) — not built yet
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MetricDef:
    key: str
    label: str
    group: str          # for UI grouping
    requires: str       # "" | "pixel" | "video" | "history"
    fmt: str = "{:.2f}"  # display hint
    desc: str = ""


CATALOG: list[MetricDef] = [
    # ── Spend & delivery (always available) ──
    MetricDef("spend", "Spend", "Delivery", "", "{:.2f}", "Total spent in the window."),
    MetricDef("impressions", "Impressions", "Delivery", "", "{:.0f}", "Times shown."),
    MetricDef("reach", "Reach", "Delivery", "", "{:.0f}", "Unique people."),
    MetricDef("clicks", "Clicks", "Delivery", "", "{:.0f}", "Link clicks."),
    MetricDef("frequency", "Frequency", "Delivery", "", "{:.2f}", "Avg times each person saw it."),
    MetricDef("days_running", "Days running", "Delivery", "", "{:.0f}", "Age of the ad set."),

    # ── Efficiency (always available) ──
    MetricDef("ctr", "CTR", "Efficiency", "", "{:.2f}%", "Click-through rate."),
    MetricDef("cpc", "CPC", "Efficiency", "", "{:.2f}", "Cost per click."),
    MetricDef("cpm", "CPM", "Efficiency", "", "{:.2f}", "Cost per 1000 impressions."),

    # ── Conversion / funnel (needs pixel) ──
    MetricDef("conversions", "Purchases", "Funnel", "pixel", "{:.0f}", "Purchase events."),
    MetricDef("roas", "ROAS", "Funnel", "pixel", "{:.2f}x", "Revenue ÷ spend."),
    MetricDef("cpa", "CPA", "Funnel", "pixel", "{:.2f}", "Cost per purchase."),
    MetricDef("purchase_value", "Purchase value", "Funnel", "pixel", "{:.2f}", "Total revenue."),
    MetricDef("add_to_cart", "Add-to-cart", "Funnel", "pixel", "{:.0f}", "ATC events."),
    MetricDef("cost_per_atc", "Cost / ATC", "Funnel", "pixel", "{:.2f}", "Cost per add-to-cart."),
    MetricDef("initiate_checkout", "Checkouts", "Funnel", "pixel", "{:.0f}", "Initiate-checkout events."),
    MetricDef("landing_page_views", "LP views", "Funnel", "pixel", "{:.0f}", "Landing-page views."),

    # ── Creative quality (needs video) ──
    MetricDef("hook_rate", "Hook rate", "Creative", "video", "{:.0%}", "3-sec views ÷ impressions."),
    MetricDef("hold_rate", "Hold rate", "Creative", "video", "{:.0%}", "15-sec / thruplay views ÷ impressions."),
    MetricDef("video_p50", "Video 50% watched", "Creative", "video", "{:.0f}", "Reached 50% of the video."),

    # ── Trend (needs day-by-day history — not built yet) ──
    MetricDef("cpm_change_7d", "CPM trend 7d", "Trend", "history", "{:+.0%}", "CPM change over 7 days."),
    MetricDef("ctr_change_7d", "CTR trend 7d", "Trend", "history", "{:+.0%}", "CTR change over 7 days."),
    MetricDef("cpa_rising_days", "CPA rising days", "Trend", "history", "{:.0f}", "Consecutive days CPA rose."),
]

BY_KEY = {m.key: m for m in CATALOG}

# Metrics available on the account TODAY (no pixel/video/history dependency).
ALWAYS_AVAILABLE = [m.key for m in CATALOG if m.requires == ""]
