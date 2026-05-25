// AdPilot Mock Data — Realistic KSA E-commerce Metrics
// Monthly spend: ~$20k | Target CPA: $15 | Target ROAS: 2.5x

const PLATFORMS = {
  meta: { name: 'Meta', color: '#1877F2', icon: 'M', share: 0.60 },
  tiktok: { name: 'TikTok', color: '#00D4AA', icon: 'T', share: 0.25 },
  snapchat: { name: 'Snapchat', color: '#FFFC00', icon: 'S', share: 0.15 },
};

const TARGET_CPA = 15;
const TARGET_ROAS = 2.5;
const DAILY_BUDGET = 700;

// Generate 14 days of daily metrics
function generateDailyMetrics() {
  const days = [];
  const now = new Date('2026-05-25');
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const isSalaryWeek = d.getDate() >= 25 || d.getDate() <= 2;
    const boost = isSalaryWeek ? 1.18 : 1;
    const weekday = d.getDay();
    const weekendDip = (weekday === 5 || weekday === 6) ? 0.88 : 1; // Fri-Sat in KSA

    const metaSpend = (380 + Math.random() * 80) * boost * weekendDip;
    const ttSpend = (150 + Math.random() * 50) * boost * weekendDip;
    const scSpend = (90 + Math.random() * 30) * boost * weekendDip;
    const totalSpend = metaSpend + ttSpend + scSpend;

    const metaConv = Math.round(metaSpend / (12 + Math.random() * 6));
    const ttConv = Math.round(ttSpend / (13 + Math.random() * 8));
    const scConv = Math.round(scSpend / (14 + Math.random() * 10));
    const totalConv = metaConv + ttConv + scConv;

    const metaRev = metaConv * (35 + Math.random() * 15);
    const ttRev = ttConv * (32 + Math.random() * 18);
    const scRev = scConv * (30 + Math.random() * 12);
    const totalRev = metaRev + ttRev + scRev;

    days.push({
      date: d.toISOString().slice(0, 10),
      label: dayLabel,
      spend: { meta: metaSpend, tiktok: ttSpend, snapchat: scSpend, total: totalSpend },
      conversions: { meta: metaConv, tiktok: ttConv, snapchat: scConv, total: totalConv },
      revenue: { meta: metaRev, tiktok: ttRev, snapchat: scRev, total: totalRev },
      roas: totalRev / totalSpend,
      cpa: totalSpend / totalConv,
    });
  }
  return days;
}

const DAILY_METRICS = generateDailyMetrics();

const SUMMARY_KPIS = (() => {
  const last7 = DAILY_METRICS.slice(-7);
  const totalSpend = last7.reduce((s, d) => s + d.spend.total, 0);
  const totalConv = last7.reduce((s, d) => s + d.conversions.total, 0);
  const totalRev = last7.reduce((s, d) => s + d.revenue.total, 0);
  const totalImpressions = Math.round(totalSpend / 6.2 * 1000);
  const totalClicks = Math.round(totalImpressions * 0.018);
  const prev7 = DAILY_METRICS.slice(-14, -7);
  const prevSpend = prev7.reduce((s, d) => s + d.spend.total, 0);
  const prevConv = prev7.reduce((s, d) => s + d.conversions.total, 0);
  const prevRev = prev7.reduce((s, d) => s + d.revenue.total, 0);
  return {
    spend: totalSpend,
    spendDelta: ((totalSpend - prevSpend) / prevSpend) * 100,
    conversions: totalConv,
    convDelta: ((totalConv - prevConv) / prevConv) * 100,
    revenue: totalRev,
    revDelta: ((totalRev - prevRev) / prevRev) * 100,
    roas: totalRev / totalSpend,
    roasDelta: ((totalRev / totalSpend) - (prevRev / prevSpend)) / (prevRev / prevSpend) * 100,
    cpa: totalSpend / totalConv,
    cpaDelta: ((totalSpend / totalConv) - (prevSpend / prevConv)) / (prevSpend / prevConv) * 100,
    impressions: totalImpressions,
    clicks: totalClicks,
    ctr: (totalClicks / totalImpressions) * 100,
  };
})();

const CAMPAIGNS = [
  {
    id: 'c1', platform: 'meta', name: 'KSA — TOF — Beauty Essentials — Broad',
    status: 'active', budget: 180, spend7d: 1120, conv7d: 82, rev7d: 3444,
    cpa: 13.66, roas: 3.07, ctr: 2.1, freq: 2.8, trend: 'up',
  },
  {
    id: 'c2', platform: 'meta', name: 'KSA — MOF — Retarget — VC 7d',
    status: 'active', budget: 120, spend7d: 780, conv7d: 68, rev7d: 2856,
    cpa: 11.47, roas: 3.66, ctr: 3.4, freq: 4.2, trend: 'up',
  },
  {
    id: 'c3', platform: 'meta', name: 'KSA — BOF — DPA — Catalog',
    status: 'active', budget: 80, spend7d: 520, conv7d: 41, rev7d: 1640,
    cpa: 12.68, roas: 3.15, ctr: 2.8, freq: 5.1, trend: 'stable',
  },
  {
    id: 'c4', platform: 'meta', name: 'KSA — TOF — Summer Collection — LAL',
    status: 'warning', budget: 100, spend7d: 680, conv7d: 28, rev7d: 840,
    cpa: 24.29, roas: 1.24, ctr: 1.1, freq: 6.8, trend: 'down',
  },
  {
    id: 'c5', platform: 'tiktok', name: 'TT — KSA — Spark Ads — Skincare',
    status: 'active', budget: 100, spend7d: 620, conv7d: 44, rev7d: 1760,
    cpa: 14.09, roas: 2.84, ctr: 1.8, freq: 2.1, trend: 'up',
  },
  {
    id: 'c6', platform: 'tiktok', name: 'TT — KSA — In-Feed — Unboxing',
    status: 'active', budget: 80, spend7d: 490, conv7d: 31, rev7d: 1178,
    cpa: 15.81, roas: 2.40, ctr: 1.5, freq: 3.2, trend: 'stable',
  },
  {
    id: 'c7', platform: 'tiktok', name: 'TT — KSA — TopView — Launch',
    status: 'paused', budget: 60, spend7d: 180, conv7d: 8, rev7d: 240,
    cpa: 22.50, roas: 1.33, ctr: 0.9, freq: 7.1, trend: 'down',
  },
  {
    id: 'c8', platform: 'snapchat', name: 'SC — KSA — Story Ads — Flash Sale',
    status: 'active', budget: 60, spend7d: 380, conv7d: 24, rev7d: 912,
    cpa: 15.83, roas: 2.40, ctr: 1.6, freq: 2.4, trend: 'stable',
  },
  {
    id: 'c9', platform: 'snapchat', name: 'SC — KSA — Collection — New Arrivals',
    status: 'warning', budget: 50, spend7d: 310, conv7d: 14, rev7d: 420,
    cpa: 22.14, roas: 1.35, ctr: 1.0, freq: 5.9, trend: 'down',
  },
];

const PENDING_ACTIONS = [
  {
    id: 'a1', tier: 3, type: 'budget_increase', platform: 'meta',
    campaign: 'KSA — TOF — Beauty Essentials — Broad',
    description: 'Increase daily budget $180 → $220 (+22%)',
    rationale: 'ROAS 3.07× (target 2.5×) over 7d, 82 conversions, no fatigue signal. CTR within 10% of peak. Room to scale — currently at 67% of campaign cap.',
    impact: 'high', risk: 'medium', estimatedGain: '+$340/week revenue',
    createdAt: '2026-05-25T08:30:00Z', expiresAt: '2026-05-25T20:30:00Z',
  },
  {
    id: 'a2', tier: 3, type: 'pause_campaign', platform: 'meta',
    campaign: 'KSA — TOF — Summer Collection — LAL',
    description: 'Pause campaign — CPA 1.62× target, ROAS 0.50× target',
    rationale: 'CPA $24.29 vs $15 target for 3 consecutive days. ROAS 1.24× vs 2.5× target. Frequency 6.8 with CTR drop 47% from peak. Creative fatigue confirmed.',
    impact: 'high', risk: 'low', estimatedGain: 'Save ~$97/day wasted spend',
    createdAt: '2026-05-25T08:30:00Z', expiresAt: '2026-05-25T20:30:00Z',
  },
  {
    id: 'a3', tier: 3, type: 'creative_publish', platform: 'tiktok',
    campaign: 'TT — KSA — Spark Ads — Skincare',
    description: 'Publish 3 new Khaliji Arabic ad variants',
    rationale: 'Current creative approaching 21-day threshold. CTR down 18% from peak. 3 fresh variants generated with pain-point, social-proof, and scarcity hooks.',
    impact: 'medium', risk: 'low', estimatedGain: 'Refresh creative before fatigue',
    createdAt: '2026-05-25T06:15:00Z', expiresAt: '2026-05-25T18:15:00Z',
  },
  {
    id: 'a4', tier: 2, type: 'budget_realloc', platform: 'snapchat',
    campaign: 'SC — KSA — Collection — New Arrivals',
    description: 'Shift $15/day from SC Collection → SC Flash Sale',
    rationale: 'Flash Sale ROAS 2.40× vs Collection 1.35×. Reallocating 30% of underperformer budget to proven performer. Within Tier 2 limits (<20%, <$200).',
    impact: 'medium', risk: 'low', estimatedGain: '+$45/week revenue',
    createdAt: '2026-05-25T08:30:00Z', status: 'auto_approved',
    autoWindow: '5 min revocable',
  },
];

const ANOMALIES = [
  {
    id: 'n1', severity: 'critical', platform: 'meta', timestamp: '2026-05-25T07:12:00Z',
    title: 'CPA spike on Summer Collection LAL',
    detail: 'CPA z-score 3.4 against 28d baseline. Sustained 72h. Frequency 6.8 (threshold: 4.0). Creative fatigue confirmed.',
    metric: 'CPA', value: '$24.29', baseline: '$14.80', zScore: 3.4,
  },
  {
    id: 'n2', severity: 'warning', platform: 'snapchat', timestamp: '2026-05-25T06:45:00Z',
    title: 'ROAS declining on SC Collection',
    detail: 'ROAS dropped from 2.1× to 1.35× over 5 days. CTR down 38% from peak. Approaching kill threshold (0.8× over 7d).',
    metric: 'ROAS', value: '1.35×', baseline: '2.10×', zScore: 2.1,
  },
  {
    id: 'n3', severity: 'info', platform: 'tiktok', timestamp: '2026-05-25T05:30:00Z',
    title: 'Salary week boost detected',
    detail: 'Conversion rate up 18% across TT campaigns. Matches historical salary-week pattern (25th–end of month). No action needed — seasonal adjustment applied.',
    metric: 'CVR', value: '+18%', baseline: 'Expected', zScore: 0.8,
  },
];

const CREATIVE_DRAFTS = [
  {
    id: 'cr1', platform: 'tiktok', campaign: 'TT — KSA — Spark Ads — Skincare',
    hook: 'pain_point', status: 'draft',
    headline: 'بشرتك تستاهل الأفضل',
    primaryText: 'تعبتي من المنتجات اللي ما تنفع؟ جربي روتين العناية الكوري الأصلي — نتائج من أول أسبوع',
    cta: 'اطلب الآن',
    headlineEn: 'Your skin deserves the best',
    primaryTextEn: 'Tired of products that don\'t work? Try the original Korean skincare routine — results from week one',
  },
  {
    id: 'cr2', platform: 'tiktok', campaign: 'TT — KSA — Spark Ads — Skincare',
    hook: 'social_proof', status: 'draft',
    headline: 'أكثر من ٥٠٠٠ طلب',
    primaryText: 'الكل يسأل عن سر بشرتهم — المنتج اللي غيّر روتين العناية عند بنات السعودية',
    cta: 'اكتشف المزيد',
    headlineEn: 'Over 5,000 orders',
    primaryTextEn: 'Everyone asks about their skin secret — the product that changed Saudi women\'s skincare routine',
  },
  {
    id: 'cr3', platform: 'tiktok', campaign: 'TT — KSA — Spark Ads — Skincare',
    hook: 'scarcity', status: 'draft',
    headline: 'الكمية محدودة',
    primaryText: 'آخر ١٠٠ قطعة من التشكيلة الصيفية — توصيل سريع لكل مدن المملكة',
    cta: 'احصل عليه',
    headlineEn: 'Limited quantity',
    primaryTextEn: 'Last 100 pieces of the summer collection — fast delivery to all cities in the Kingdom',
  },
  {
    id: 'cr4', platform: 'meta', campaign: 'KSA — TOF — Beauty Essentials — Broad',
    hook: 'identity', status: 'approved',
    headline: 'للسعوديين بس',
    primaryText: 'منتجات عناية مصممة لبشرتنا وجونا — مو أي كلام، نتائج حقيقية',
    cta: 'جرب الآن',
    headlineEn: 'For Saudis only',
    primaryTextEn: 'Skincare products designed for our skin and our climate — not just talk, real results',
  },
  {
    id: 'cr5', platform: 'meta', campaign: 'KSA — MOF — Retarget — VC 7d',
    hook: 'curiosity', status: 'draft',
    headline: 'شفتيه وما طلبتي؟',
    primaryText: 'المنتج اللي عجبك لسا متوفر — بس الخصم ينتهي بكرة',
    cta: 'اطلب الآن',
    headlineEn: 'Saw it but didn\'t order?',
    primaryTextEn: 'The product you liked is still available — but the discount ends tomorrow',
  },
];

const AUDIT_LOG = [
  { id: 'l1', timestamp: '2026-05-25T08:32:00Z', action: 'action_proposed', tier: 3, detail: 'Budget increase proposed: Beauty Essentials $180→$220', actor: 'system' },
  { id: 'l2', timestamp: '2026-05-25T08:31:00Z', action: 'anomaly_detected', tier: 1, detail: 'CPA spike detected on Summer Collection LAL (z=3.4)', actor: 'system' },
  { id: 'l3', timestamp: '2026-05-25T08:30:00Z', action: 'budget_realloc', tier: 2, detail: 'SC: $15/day shifted Collection→Flash Sale (auto-approved)', actor: 'system' },
  { id: 'l4', timestamp: '2026-05-25T06:15:00Z', action: 'creative_generated', tier: 1, detail: '3 Khaliji Arabic variants generated for TT Spark Ads', actor: 'system' },
  { id: 'l5', timestamp: '2026-05-25T06:00:00Z', action: 'data_pull', tier: 1, detail: 'Hot path: 30-min refresh completed (Meta, TikTok, Snapchat)', actor: 'system' },
  { id: 'l6', timestamp: '2026-05-25T03:00:00Z', action: 'reconciliation', tier: 1, detail: 'Cold path: 7-day attribution backfill completed. 12 CPA adjustments.', actor: 'system' },
  { id: 'l7', timestamp: '2026-05-24T22:15:00Z', action: 'action_approved', tier: 3, detail: 'Operator approved: Pause TT TopView Launch campaign', actor: 'operator' },
  { id: 'l8', timestamp: '2026-05-24T22:14:00Z', action: 'campaign_paused', tier: 3, detail: 'TT TopView Launch paused via API', actor: 'system' },
  { id: 'l9', timestamp: '2026-05-24T18:00:00Z', action: 'digest_sent', tier: 1, detail: 'Daily performance digest sent to Telegram', actor: 'system' },
  { id: 'l10', timestamp: '2026-05-24T14:30:00Z', action: 'action_rejected', tier: 3, detail: 'Operator rejected: Audience expansion on Meta BOF DPA', actor: 'operator' },
];

const TELEGRAM_MESSAGES = [
  {
    id: 't1', type: 'approval_request', time: '08:30',
    text: '🔴 *Tier 3 — Approval Required*\n\n*Action:* Increase budget\n*Campaign:* KSA — TOF — Beauty Essentials\n*Change:* $180/day → $220/day (+22%)\n\n📊 *Why:*\n• ROAS 3.07× (target: 2.5×)\n• 82 conversions in 7d\n• No fatigue signal\n• At 67% of cap — room to grow\n\n💰 Est. gain: +$340/week revenue',
    buttons: ['✅ Approve', '❌ Reject', '⏸ Defer 6h'],
  },
  {
    id: 't2', type: 'auto_notification', time: '08:30',
    text: '🟡 *Tier 2 — Auto-executed (5-min revoke window)*\n\n*Action:* Budget reallocation\n*From:* SC Collection — New Arrivals\n*To:* SC Flash Sale\n*Amount:* $15/day\n\n📊 Flash Sale ROAS 2.40× vs Collection 1.35×',
    buttons: ['⏪ Revoke'],
  },
  {
    id: 't3', type: 'anomaly_alert', time: '07:12',
    text: '🚨 *Anomaly Alert*\n\n*Campaign:* Summer Collection — LAL\n*Issue:* CPA z-score 3.4 (threshold: 3.0)\n*CPA:* $24.29 vs $14.80 baseline\n*Duration:* 72 hours\n*Frequency:* 6.8 (fatigue confirmed)\n\n⚡ Auto-paused (Tier 1 hard anomaly rule)',
    buttons: [],
  },
];

// Make everything globally available
Object.assign(window, {
  PLATFORMS, TARGET_CPA, TARGET_ROAS, DAILY_BUDGET,
  DAILY_METRICS, SUMMARY_KPIS, CAMPAIGNS, PENDING_ACTIONS,
  ANOMALIES, CREATIVE_DRAFTS, AUDIT_LOG, TELEGRAM_MESSAGES,
});
