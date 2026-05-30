"use client";
import { useMemo } from "react";
import {
  useSnapStatus,
  useSnapMe,
  useSnapOrganizations,
  useSnapCampaigns,
  useSnapAdSquads,
  useSnapAds,
} from "@/hooks/useSnap";
import type { SnapAdAccount, SnapCampaign } from "@/types/snap";

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
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card fade-in" style={{ marginBottom: 16 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
            {subtitle}
          </div>
        )}
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
