/* ── AdPilot — Constants (replaces window globals) ─────────────── */

export const TARGET_CPA = 15;
export const TARGET_ROAS = 2.5;
export const DAILY_BUDGET = 700;

export const PLATFORMS = [
  { id: "meta", label: "Meta", color: "#1877F2" },
  { id: "tiktok", label: "TikTok", color: "#00D4AA" },
  { id: "snapchat", label: "Snapchat", color: "#FFFC00" },
] as const;

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";

/* Telegram mock — no backend endpoint for this */
export const TELEGRAM_MESSAGES = [
  {
    id: "tm1",
    text: `*🚨 Tier 3 Approval Required*\n\n*Action:* Launch new campaign — Ramadan Retargeting\n*Platform:* Meta\n*Budget:* SAR 2,400/day\n*Audience:* Website visitors 30d + lookalike 2%\n\n• Estimated reach: 180,000–220,000\n• Projected CPA: SAR 12.40\n• Creative: 3 pain-point variants`,
    buttons: ["✅ Approve", "❌ Reject", "⏸ Defer 6h"],
    time: "10:42 AM",
  },
  {
    id: "tm2",
    text: `*⚡ Tier 2 Auto-Executed — Revoke Window Open*\n\n*Action:* Budget reallocation\n*From:* TikTok Summer Sale (-SAR 400)\n*To:* Meta Retargeting (+SAR 400)\n\n• Reason: ROAS delta >0.8 sustained 48h\n• Change within 20% Tier 2 threshold\n• Revoke available for 4m 22s`,
    buttons: ["⏪ Revoke"],
    time: "10:38 AM",
  },
  {
    id: "tm3",
    text: `*📊 Daily Digest — Saturday, 25 May*\n\n*Total Spend:* SAR 4,820 / SAR 5,600 cap\n*Blended ROAS:* 2.84× (+0.12 vs yesterday)\n*Conversions:* 142 (+18%)\n\n• Meta: 2.91× ROAS, SAR 11.20 CPA ✅\n• TikTok: 2.43× ROAS, SAR 15.80 CPA ⚠\n• Snapchat: 3.12× ROAS, SAR 9.40 CPA ✅\n\n1 anomaly active · 2 actions pending`,
    buttons: [],
    time: "09:00 AM",
  },
];
