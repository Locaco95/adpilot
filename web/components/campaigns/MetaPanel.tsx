"use client";
import { Fragment, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMetaStatus, useMetaAccount, useMetaCampaigns, useMetaInsights, useSetMetaCampaignStatus, useMetaCampaignAdSets, useSetMetaAdSetStatus, metaKeys } from "@/hooks/useMeta";
import { createMetaCampaign } from "@/services/meta.service";
import { CreativePicker } from "@/components/common/CreativePicker";
import type { MetaCampaign, MetaAdSet, MetaInsightRow, MetaObjective, CreateMetaCampaignResult } from "@/types/meta";

const REGIONS: { code: string; label: string }[] = [
  { code: "SA", label: "Saudi Arabia" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "EG", label: "Egypt" },
  { code: "KW", label: "Kuwait" },
  { code: "QA", label: "Qatar" },
  { code: "BH", label: "Bahrain" },
  { code: "OM", label: "Oman" },
];

const OBJECTIVES: { value: MetaObjective; label: string }[] = [
  { value: "OUTCOME_TRAFFIC", label: "Traffic (link clicks)" },
  { value: "OUTCOME_SALES", label: "Sales (conversions)" },
  { value: "OUTCOME_AWARENESS", label: "Awareness (reach)" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement" },
  { value: "OUTCOME_LEADS", label: "Leads" },
];

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-sm)", padding: "8px 10px", color: "var(--text-primary)",
  fontSize: 13, outline: "none",
};
const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, display: "block", fontWeight: 600 };

/* One editable ad set in the create form. */
interface AdSetDraft {
  country: string;
  budget: string;
  creativeFileId: string | null;
  destinationUrl: string;
  headline: string;
}

function emptyAdSet(): AdSetDraft {
  return { country: "SA", budget: "100", creativeFileId: null, destinationUrl: "", headline: "" };
}

function AdSetCard({ index, total, draft, onChange, onRemove, currency }: {
  index: number; total: number; draft: AdSetDraft;
  onChange: (d: AdSetDraft) => void; onRemove: () => void; currency: string;
}) {
  const set = (patch: Partial<AdSetDraft>) => onChange({ ...draft, ...patch });
  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: 14, background: "var(--bg-subtle, transparent)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Ad set {index + 1}</span>
        {total > 1 && (
          <button onClick={onRemove}
            style={{ background: "transparent", border: "none", color: "var(--danger)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Remove
          </button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Region</label>
          <select style={inputStyle} value={draft.country} onChange={(e) => set({ country: e.target.value })}>
            {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Daily budget ({currency})</label>
          <input style={inputStyle} type="number" value={draft.budget} onChange={(e) => set({ budget: e.target.value })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Creative — from Google Drive (optional)</label>
          <CreativePicker selectedFileId={draft.creativeFileId} onSelect={(id) => set({ creativeFileId: id })} />
        </div>
        {draft.creativeFileId && (
          <>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Destination URL (required for the ad)</label>
              <input style={inputStyle} value={draft.destinationUrl} onChange={(e) => set({ destinationUrl: e.target.value })} placeholder="https://store.example.com/product" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Headline (optional)</label>
              <input style={inputStyle} maxLength={255} value={draft.headline} onChange={(e) => set({ headline: e.target.value })} placeholder="Shop the collection" />
            </div>
          </>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8 }}>Targets ages 18–65 · created PAUSED</div>
    </div>
  );
}

function CreateMetaCampaignForm({ currency, onDone }: { currency: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [objective, setObjective] = useState<MetaObjective>("OUTCOME_TRAFFIC");
  const [adSets, setAdSets] = useState<AdSetDraft[]>([emptyAdSet()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateMetaCampaignResult | null>(null);

  function updateAdSet(i: number, d: AdSetDraft) {
    setAdSets((prev) => prev.map((s, idx) => (idx === i ? d : s)));
  }
  function removeAdSet(i: number) {
    setAdSets((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setError(null);
    if (!name.trim()) { setError("Campaign name is required."); return; }
    for (let i = 0; i < adSets.length; i++) {
      const a = adSets[i];
      const b = Number(a.budget);
      if (!b || b <= 0) { setError(`Ad set ${i + 1}: enter a daily budget.`); return; }
      if (a.creativeFileId && !a.destinationUrl.trim()) { setError(`Ad set ${i + 1}: add a destination URL for the creative.`); return; }
    }
    setSubmitting(true);
    try {
      const res = await createMetaCampaign({
        name: name.trim(),
        objective,
        ad_sets: adSets.map((a) => ({
          country_code: a.country,
          daily_budget: Number(a.budget),
          age_min: 18,
          age_max: 65,
          ...(a.creativeFileId ? {
            creative_file_id: a.creativeFileId,
            destination_url: a.destinationUrl.trim(),
            headline: a.headline.trim() || undefined,
          } : {}),
        })),
      });
      setResult(res);
      qc.invalidateQueries({ queryKey: metaKeys.campaigns() });
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--success)", marginBottom: 8 }}>✓ Campaign created (PAUSED)</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", lineHeight: 1.7 }}>
          <div>campaign: {result.campaign_id}</div>
          {result.ad_sets.map((a, i) => (
            <div key={a.ad_set_id} style={{ marginTop: i ? 6 : 4 }}>
              <div>ad set {i + 1} ({a.country_code}): {a.ad_set_id}</div>
              {a.creative_id && <div>  creative: {a.creative_id}</div>}
              {a.ad_id && <div>  ad: {a.ad_id}</div>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>
          Created paused — hit Activate on the campaign row below to go live (spends real money).
        </div>
        <button onClick={onDone} style={{ ...inputStyle, width: "auto", marginTop: 12, cursor: "pointer", fontWeight: 600 }}>Done</button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Create Meta Campaign</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Campaign name</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. KSA Summer Sale" />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Objective (applies to the whole campaign)</label>
          <select style={inputStyle} value={objective} onChange={(e) => setObjective(e.target.value as MetaObjective)}>
            {OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
        {adSets.map((a, i) => (
          <AdSetCard key={i} index={i} total={adSets.length} draft={a} currency={currency}
            onChange={(d) => updateAdSet(i, d)} onRemove={() => removeAdSet(i)} />
        ))}
      </div>

      <button onClick={() => setAdSets((prev) => [...prev, emptyAdSet()])}
        style={{ ...inputStyle, width: "auto", marginTop: 12, cursor: "pointer", fontWeight: 600,
          background: "transparent", border: "1px dashed var(--border-subtle)", color: "var(--text-secondary)" }}>
        + Add ad set
      </button>

      {error && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 10 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
        <button onClick={submit} disabled={submitting}
          style={{ ...inputStyle, width: "auto", cursor: submitting ? "default" : "pointer", fontWeight: 600,
            background: "var(--accent)", color: "var(--text-inverse)", border: "none", opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "Creating…" : `Create ${adSets.length > 1 ? `${adSets.length} ad sets ` : ""}(paused)`}
        </button>
        <button onClick={onDone} disabled={submitting}
          style={{ ...inputStyle, width: "auto", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
      </div>
    </div>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color, background: `${color}18`,
      padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.04em",
    }}>{label}</span>
  );
}

/* Meta returns budgets as minor units (cents) in a string. */
function centsToCurrency(s: string | undefined, currency = "USD"): string {
  if (!s) return "—";
  const v = Number(s) / 100;
  if (Number.isNaN(v)) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

/* Modal asking the operator to confirm going live (real spend). */
function ActivateConfirm({ name, scope, busy, onConfirm, onCancel }: {
  name: string; scope: "campaign" | "adset"; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: 22, maxWidth: 420, width: "100%" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Activate “{name}”?</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {scope === "campaign"
            ? <>This sets the campaign, all its ad sets and ads to <b>Active</b> and starts <b>real ad delivery</b>. Meta will begin spending from your account balance.</>
            : <>This sets this ad set and its ad to <b>Active</b> and starts <b>real ad delivery</b> (the campaign must also be active). Meta will begin spending from your account balance.</>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={busy}
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)",
              borderRadius: "var(--radius-sm)", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            style={{ background: "var(--success)", border: "none", color: "var(--text-inverse)",
              borderRadius: "var(--radius-sm)", padding: "8px 14px", fontSize: 13, fontWeight: 700,
              cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Activating…" : "Activate & spend"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Small Pause (one-click) / Activate (caller confirms) button pair. */
function StatusButton({ active, busy, onPause, onActivate }: {
  active: boolean; busy: boolean; onPause: () => void; onActivate: () => void;
}) {
  return active ? (
    <button onClick={onPause} disabled={busy}
      style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
        color: "var(--text-primary)", borderRadius: "var(--radius-sm)", padding: "5px 10px",
        fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
      {busy ? "…" : "Pause"}
    </button>
  ) : (
    <button onClick={onActivate} disabled={busy}
      style={{ background: "var(--success)", border: "none", color: "var(--text-inverse)",
        borderRadius: "var(--radius-sm)", padding: "5px 10px", fontSize: 12, fontWeight: 700,
        cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
      {busy ? "…" : "Activate"}
    </button>
  );
}

/* Expanded ad-set rows under a campaign, each with its own Pause/Activate. */
function AdSetSubRows({ campaignId, currency, onConfirmActivate }: {
  campaignId: string; currency: string;
  onConfirmActivate: (adset: MetaAdSet) => void;
}) {
  const { data, isLoading } = useMetaCampaignAdSets(campaignId, true);
  const setAdSetStatus = useSetMetaAdSetStatus(campaignId);
  const pendingId = setAdSetStatus.isPending ? (setAdSetStatus.variables?.id ?? null) : null;
  const adsets = data?.data ?? [];

  if (isLoading) {
    return <tr><td colSpan={8} style={{ padding: "8px 18px", color: "var(--text-tertiary)", fontSize: 12 }}>Loading ad sets…</td></tr>;
  }
  if (adsets.length === 0) {
    return <tr><td colSpan={8} style={{ padding: "8px 18px", color: "var(--text-tertiary)", fontSize: 12 }}>No ad sets.</td></tr>;
  }
  return (
    <>
      {adsets.map((a) => {
        const active = a.status === "ACTIVE";
        const busy = pendingId === a.id;
        return (
          <tr key={a.id} style={{ background: "var(--bg-subtle, rgba(127,127,127,0.04))" }}>
            <td className="col-name" style={{ paddingLeft: 34, fontSize: 12, color: "var(--text-secondary)" }}>↳ {a.name}</td>
            <td><StatusPill label={a.status} color={active ? "var(--success)" : "var(--text-tertiary)"} /></td>
            <td className="col-hide-mobile" style={{ fontSize: 12 }}>{a.optimization_goal ?? "—"}</td>
            <td className="col-hide-mobile">{centsToCurrency(a.daily_budget, currency)}</td>
            <td colSpan={3} className="col-hide-mobile" />
            <td>
              <StatusButton active={active} busy={busy}
                onPause={() => setAdSetStatus.mutate({ id: a.id, status: "PAUSED" })}
                onActivate={() => onConfirmActivate(a)} />
            </td>
          </tr>
        );
      })}
    </>
  );
}

type ConfirmTarget =
  | { scope: "campaign"; id: string; name: string }
  | { scope: "adset"; id: string; name: string; campaignId: string };

export function MetaPanel() {
  const { data: status, isLoading: statusLoading } = useMetaStatus();
  const connected = !!status?.configured;
  const [showCreate, setShowCreate] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: account } = useMetaAccount(connected);
  const { data: campaignsResp, isLoading: campaignsLoading, isError, error } = useMetaCampaigns(connected);
  const { data: insightsResp } = useMetaInsights("campaign", "last_7d", connected);
  const setStatus = useSetMetaCampaignStatus();
  const setAdSetStatusForConfirm = useSetMetaAdSetStatus(
    confirmTarget?.scope === "adset" ? confirmTarget.campaignId : ""
  );
  const pendingId = setStatus.isPending ? (setStatus.variables?.id ?? null) : null;
  const confirmBusy = setStatus.isPending || setAdSetStatusForConfirm.isPending;

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const currency = account?.currency ?? "USD";
  const campaigns = useMemo<MetaCampaign[]>(() => campaignsResp?.data ?? [], [campaignsResp]);
  const insights = useMemo<Record<string, MetaInsightRow>>(() => {
    const map: Record<string, MetaInsightRow> = {};
    for (const row of insightsResp?.data ?? []) {
      if (row.campaign_name) map[row.campaign_name] = row;
    }
    return map;
  }, [insightsResp]);

  if (statusLoading) {
    return <div className="card fade-in" style={{ padding: 24, color: "var(--text-secondary)" }}>Checking Meta connection…</div>;
  }

  if (!connected) {
    return (
      <div className="card fade-in" style={{ padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Meta not connected</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Set <code>META_ACCESS_TOKEN</code> and <code>META_AD_ACCOUNT_ID</code> on the backend to connect.
        </div>
      </div>
    );
  }

  const acctActive = account?.account_status === 1;

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Connection / account card */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{account?.name ?? "Meta Ad Account"}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
              {status?.ad_account_id}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatusPill
              label={acctActive ? "Active" : `Status ${account?.account_status ?? "?"}`}
              color={acctActive ? "var(--success)" : "var(--warning)"}
            />
            <button onClick={() => setShowCreate((v) => !v)}
              style={{ background: "var(--accent)", color: "var(--text-inverse)", border: "none",
                borderRadius: "var(--radius-sm)", padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {showCreate ? "Close" : "+ Create Campaign"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Available balance</div>
            <div style={{ fontWeight: 700, color: account?.funding_source_details?.display_string ? "var(--success)" : "var(--text-primary)" }}>
              {account?.funding_source_details?.display_string ?? "No payment method"}
            </div>
          </div>
          <div><div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Currency</div><div style={{ fontWeight: 600 }}>{currency}</div></div>
          <div><div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Timezone</div><div style={{ fontWeight: 600 }}>{account?.timezone_name ?? "—"}</div></div>
          <div><div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Spent (lifetime)</div><div style={{ fontWeight: 600 }}>{centsToCurrency(account?.amount_spent, currency)}</div></div>
        </div>
      </div>

      {showCreate && (
        <CreateMetaCampaignForm currency={currency} onDone={() => setShowCreate(false)} />
      )}

      {/* Campaigns + 7d insights */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }}>Campaigns</span>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Spend/clicks = last 7 days</span>
        </div>

        {campaignsLoading ? (
          <div style={{ padding: 24, color: "var(--text-secondary)" }}>Loading campaigns…</div>
        ) : isError ? (
          <div style={{ padding: 24, color: "var(--danger)" }}>Failed to load: {(error as Error)?.message}</div>
        ) : campaigns.length === 0 ? (
          <div style={{ padding: 24, color: "var(--text-secondary)" }}>No campaigns on this account yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-name">Campaign</th>
                <th style={{ width: 90 }}>Status</th>
                <th className="col-hide-mobile" style={{ width: 110 }}>Objective</th>
                <th className="col-hide-mobile" style={{ width: 90 }}>Budget/d</th>
                <th style={{ width: 90 }}>7d Spend</th>
                <th className="col-hide-mobile" style={{ width: 70 }}>Clicks</th>
                <th className="col-hide-mobile" style={{ width: 64 }}>CTR</th>
                <th style={{ width: 96 }}></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const ins = insights[c.name];
                const active = c.status === "ACTIVE";
                const rowBusy = pendingId === c.id;
                const isOpen = expanded.has(c.id);
                return (
                  <Fragment key={c.id}>
                    <tr>
                      <td className="col-name">
                        <button onClick={() => toggleExpand(c.id)}
                          style={{ background: "transparent", border: "none", color: "var(--text-tertiary)",
                            cursor: "pointer", fontSize: 11, marginRight: 6, width: 14, display: "inline-block" }}
                          aria-label={isOpen ? "Collapse ad sets" : "Expand ad sets"}>
                          {isOpen ? "▾" : "▸"}
                        </button>
                        {c.name}
                      </td>
                      <td><StatusPill label={c.status} color={active ? "var(--success)" : "var(--text-tertiary)"} /></td>
                      <td className="col-hide-mobile" style={{ fontSize: 12 }}>{c.objective ?? "—"}</td>
                      <td className="col-hide-mobile">{centsToCurrency(c.daily_budget, currency)}</td>
                      <td>{ins?.spend ? `${Number(ins.spend).toFixed(2)} ${currency}` : "—"}</td>
                      <td className="col-hide-mobile">{ins?.clicks ?? "—"}</td>
                      <td className="col-hide-mobile">{ins?.ctr ? `${Number(ins.ctr).toFixed(2)}%` : "—"}</td>
                      <td>
                        <StatusButton active={active} busy={rowBusy}
                          onPause={() => setStatus.mutate({ id: c.id, status: "PAUSED" })}
                          onActivate={() => setConfirmTarget({ scope: "campaign", id: c.id, name: c.name })} />
                      </td>
                    </tr>
                    {isOpen && (
                      <AdSetSubRows campaignId={c.id} currency={currency}
                        onConfirmActivate={(a) => setConfirmTarget({ scope: "adset", id: a.id, name: a.name, campaignId: c.id })} />
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {confirmTarget && (
        <ActivateConfirm
          name={confirmTarget.name}
          scope={confirmTarget.scope}
          busy={confirmBusy}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => {
            const opts = { onSettled: () => setConfirmTarget(null) };
            if (confirmTarget.scope === "campaign") {
              setStatus.mutate({ id: confirmTarget.id, status: "ACTIVE" }, opts);
            } else {
              setAdSetStatusForConfirm.mutate({ id: confirmTarget.id, status: "ACTIVE" }, opts);
            }
          }}
        />
      )}
    </div>
  );
}
