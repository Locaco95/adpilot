"use client";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSnapStatus,
  useSnapMe,
  useSnapOrganizations,
  useSnapCampaigns,
  useSnapAdSquads,
  useSnapAds,
  snapKeys,
} from "@/hooks/useSnap";
import { createSnapCampaign } from "@/services/snap.service";
import { CreativePicker } from "@/components/common/CreativePicker";
import type {
  SnapAdAccount,
  SnapCampaign,
  SnapObjective,
  CreateCampaignResult,
} from "@/types/snap";

/* Targetable markets — Snap accepts any country; this is just the shortlist. */
const REGIONS: { code: string; label: string }[] = [
  { code: "sa", label: "Saudi Arabia" },
  { code: "ae", label: "United Arab Emirates" },
  { code: "eg", label: "Egypt" },
  { code: "kw", label: "Kuwait" },
  { code: "qa", label: "Qatar" },
  { code: "bh", label: "Bahrain" },
  { code: "om", label: "Oman" },
];

const OBJECTIVES: { value: SnapObjective; label: string }[] = [
  { value: "TRAFFIC", label: "Traffic (swipe-ups)" },
  { value: "AWARENESS_AND_ENGAGEMENT", label: "Awareness & engagement" },
  { value: "SALES", label: "Sales (pixel purchase)" },
  { value: "LEADS", label: "Leads" },
  { value: "APP_PROMOTION", label: "App promotion" },
];

/* Snap reports money in micros (1 USD = 1,000,000). */
function microsToCurrency(m: number | undefined, currency = "USD"): string {
  if (m === undefined || m === null) return "—";
  const v = m / 1_000_000;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `$${v.toFixed(2)}`;
  }
}

function StatusPill({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    ACTIVE: "var(--success)",
    PAUSED: "var(--text-tertiary)",
    PENDING: "var(--warning)",
    ENDED: "var(--text-tertiary)",
  };
  const color = colorMap[status?.toUpperCase()] || "var(--text-secondary)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "var(--radius-sm)",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        color,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {status || "unknown"}
    </span>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card fade-in" style={{ marginBottom: 16 }}>
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
        {action}
      </div>
      <div style={{ padding: "12px 16px" }}>{children}</div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "24px 16px",
        color: "var(--text-tertiary)",
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}

/* ── Create Campaign form ───────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-input)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-sm)",
  padding: "8px 10px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "var(--font-body)",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-tertiary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
  display: "block",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function CreateCampaignForm({
  adAccountId,
  currency,
  onClose,
}: {
  adAccountId: string;
  currency: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [objective, setObjective] = useState<SnapObjective>("TRAFFIC");
  const [countryCode, setCountryCode] = useState("sa");
  const [dailyBudget, setDailyBudget] = useState("20");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [headline, setHeadline] = useState("");
  const [creativeFileId, setCreativeFileId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateCampaignResult | null>(null);

  const budgetNum = Number(dailyBudget);
  const canSubmit =
    name.trim() &&
    headline.trim() &&
    headline.length <= 34 &&
    destinationUrl.trim() &&
    !!creativeFileId &&
    budgetNum >= 20 &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await createSnapCampaign({
        name: name.trim(),
        objective,
        country_code: countryCode,
        daily_budget: budgetNum,
        destination_url: destinationUrl.trim(),
        headline: headline.trim(),
        creative_file_id: creativeFileId!,
      });
      setResult(res);
      qc.invalidateQueries({ queryKey: snapKeys.campaigns(adAccountId) });
      qc.invalidateQueries({ queryKey: snapKeys.adsquads(adAccountId) });
      qc.invalidateQueries({ queryKey: snapKeys.ads(adAccountId) });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div style={{ fontSize: 13 }}>
        <div style={{ color: "var(--success)", fontWeight: 600, marginBottom: 8 }}>
          ✓ Campaign created (PAUSED — it will not spend until you set it ACTIVE)
        </div>
        <div style={{ display: "grid", gap: 4, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
          <div>campaign: {result.campaign_id}</div>
          <div>ad squad: {result.ad_squad_id}</div>
          <div>creative: {result.creative_id}</div>
          <div>ad: {result.ad_id}</div>
          <div>media: {result.media_id} ({result.media_status})</div>
        </div>
        <button onClick={onClose} style={{ ...primaryBtnStyle, marginTop: 14 }}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      <Field label="Campaign name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Sale — KSA" />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Objective">
          <select style={inputStyle} value={objective} onChange={(e) => setObjective(e.target.value as SnapObjective)}>
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Region">
          <select style={inputStyle} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={`Daily budget (${currency})`}>
        <input
          style={inputStyle}
          type="number"
          min={20}
          step="1"
          value={dailyBudget}
          onChange={(e) => setDailyBudget(e.target.value)}
        />
      </Field>

      <Field label={`Headline (${headline.length}/34)`}>
        <input style={inputStyle} maxLength={34} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Shop the collection" />
      </Field>

      <Field label="Destination URL (swipe-up)">
        <input style={inputStyle} value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://store.example.com/product" />
      </Field>

      <Field label="Creative — from Google Drive">
        <CreativePicker selectedFileId={creativeFileId} onSelect={(id) => setCreativeFileId(id)} />
      </Field>

      {error && (
        <div style={{ fontSize: 12, color: "var(--danger)", background: "var(--danger-bg)", padding: "8px 10px", borderRadius: "var(--radius-sm)" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", marginTop: 4 }}>
        {!creativeFileId && (
          <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginRight: "auto" }}>
            Select a creative to continue
          </span>
        )}
        <button type="button" onClick={onClose} disabled={submitting} style={ghostBtnStyle}>
          Cancel
        </button>
        <button type="submit" disabled={!canSubmit} style={{ ...primaryBtnStyle, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" }}>
          {submitting ? "Creating…" : "Create campaign"}
        </button>
      </div>
    </form>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "var(--text-inverse)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};

const ghostBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-default)",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};

export function SnapchatPanel() {
  const status = useSnapStatus();
  const configured = status.data?.configured ?? false;

  const me = useSnapMe(configured);
  const orgs = useSnapOrganizations(configured);

  /* Pick the first ad account we can find (prefer the default from /status). */
  const adAccount: SnapAdAccount | undefined = useMemo(() => {
    if (!orgs.data?.organizations?.length) return undefined;
    const fallbackId = status.data?.default_ad_account_id;
    for (const wrap of orgs.data.organizations) {
      const accts = wrap.organization?.ad_accounts ?? [];
      if (fallbackId) {
        const hit = accts.find((a) => a.id === fallbackId);
        if (hit) return hit;
      }
    }
    /* No match by default id — take the first non-empty org's first account. */
    for (const wrap of orgs.data.organizations) {
      const accts = wrap.organization?.ad_accounts ?? [];
      if (accts.length) return accts[0];
    }
    return undefined;
  }, [orgs.data, status.data]);

  const adAccountId = adAccount?.id;
  const campaigns = useSnapCampaigns(adAccountId);
  const adsquads = useSnapAdSquads(adAccountId);
  const ads = useSnapAds(adAccountId);

  const [showCreate, setShowCreate] = useState(false);

  /* --- not configured: surface a setup hint --- */
  if (status.isLoading) {
    return <EmptyHint text="Checking Snap connection…" />;
  }
  if (!configured) {
    return (
      <div className="card fade-in" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          Snap is not connected
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Set <code>SNAPCHAT_CLIENT_ID</code>, <code>SNAPCHAT_CLIENT_SECRET</code>,{" "}
          <code>SNAPCHAT_REFRESH_TOKEN</code> and{" "}
          <code>SNAPCHAT_AD_ACCOUNT_ID</code> in the backend environment, then
          reload this page.
        </div>
      </div>
    );
  }

  /* --- error from any required query --- */
  const fatalError =
    (me.isError && (me.error as Error)) ||
    (orgs.isError && (orgs.error as Error));
  if (fatalError) {
    return (
      <div className="card fade-in" style={{ padding: 16 }}>
        <div style={{ color: "var(--danger)", fontWeight: 600, marginBottom: 4 }}>
          Snap API error
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {(fatalError as Error).message}
        </div>
      </div>
    );
  }

  const campList: SnapCampaign[] =
    campaigns.data?.campaigns?.map((c) => c.campaign) ?? [];

  return (
    <div>
      {/* identity + ad account info */}
      <SectionCard
        title="Connection"
        subtitle="Live data from the Snap Marketing API"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Connected as
            </div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>
              {me.data?.me?.display_name ?? "—"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              {me.data?.me?.email ?? ""}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Ad account
            </div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>
              {adAccount?.name ?? "—"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", gap: 8, marginTop: 4 }}>
              <StatusPill status={adAccount?.status ?? "unknown"} />
              <span>{adAccount?.currency ?? ""}</span>
              <span>{adAccount?.timezone ?? ""}</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Create campaign form (toggled) */}
      {showCreate && adAccountId && (
        <SectionCard
          title="Create campaign"
          subtitle="Creates a real Snap campaign — PAUSED, no spend until you activate it"
        >
          <CreateCampaignForm
            adAccountId={adAccountId}
            currency={adAccount?.currency ?? "USD"}
            onClose={() => setShowCreate(false)}
          />
        </SectionCard>
      )}

      {/* Campaigns table */}
      <SectionCard
        title="Campaigns"
        subtitle={
          campaigns.isLoading
            ? "Loading…"
            : campList.length
            ? `${campList.length} campaign${campList.length === 1 ? "" : "s"}`
            : "None yet"
        }
        action={
          !showCreate && adAccountId ? (
            <button onClick={() => setShowCreate(true)} style={primaryBtnStyle}>
              + Create campaign
            </button>
          ) : undefined
        }
      >
        {campaigns.isLoading ? (
          <EmptyHint text="Loading campaigns…" />
        ) : campaigns.isError ? (
          <EmptyHint
            text={`Error: ${(campaigns.error as Error).message}`}
          />
        ) : campList.length === 0 ? (
          <EmptyHint text="No Snap campaigns yet. Create one in Snap Ads Manager to see it here." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Objective</th>
                <th>Daily budget</th>
                <th>Start</th>
              </tr>
            </thead>
            <tbody>
              {campList.map((c) => (
                <tr key={c.id}>
                  <td className="truncate" style={{ maxWidth: 260, fontWeight: 500 }}>
                    {c.name}
                  </td>
                  <td>
                    <StatusPill status={c.status} />
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {c.objective ?? "—"}
                  </td>
                  <td className="mono">
                    {microsToCurrency(c.daily_budget_micro, adAccount?.currency)}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    {c.start_time ? c.start_time.slice(0, 10) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Ad squads (compact) */}
      <SectionCard
        title="Ad squads"
        subtitle={
          adsquads.isLoading
            ? "Loading…"
            : (adsquads.data?.adsquads?.length ?? 0) === 0
            ? "None yet"
            : `${adsquads.data!.adsquads.length}`
        }
      >
        {adsquads.isLoading ? (
          <EmptyHint text="Loading ad squads…" />
        ) : !(adsquads.data?.adsquads?.length) ? (
          <EmptyHint text="No ad squads." />
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {adsquads.data.adsquads.map((w) => (
              <li key={w.adsquad.id}>
                <strong>{w.adsquad.name}</strong>{" "}
                <span style={{ color: "var(--text-tertiary)" }}>
                  · {w.adsquad.status} · {w.adsquad.optimization_goal ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Ads (compact) */}
      <SectionCard
        title="Ads"
        subtitle={
          ads.isLoading
            ? "Loading…"
            : (ads.data?.ads?.length ?? 0) === 0
            ? "None yet"
            : `${ads.data!.ads.length}`
        }
      >
        {ads.isLoading ? (
          <EmptyHint text="Loading ads…" />
        ) : !(ads.data?.ads?.length) ? (
          <EmptyHint text="No ads." />
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {ads.data.ads.map((w) => (
              <li key={w.ad.id}>
                <strong>{w.ad.name}</strong>{" "}
                <span style={{ color: "var(--text-tertiary)" }}>
                  · {w.ad.status} · review {w.ad.review_status ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
