"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMetaStatus, useMetaAccount, useMetaCampaigns, useMetaInsights, useSetMetaCampaignStatus, useMetaCampaignAdSets, useSetMetaAdSetStatus, useDeleteMetaCampaign, metaKeys } from "@/hooks/useMeta";
import { createMetaCampaignShell, createMetaAdSet, searchMetaInterests } from "@/services/meta.service";
import { CreativePicker } from "@/components/common/CreativePicker";
import { MetaAuditPanel } from "./MetaAuditPanel";
import { MetaOptimizerPanel } from "./MetaOptimizerPanel";
import type { MetaCampaign, MetaAdSet, MetaInterest, MetaInsightRow, MetaObjective, CreateMetaCampaignResult, AdSetSpec, CreatedAdSet } from "@/types/meta";

const REGIONS: { code: string; label: string }[] = [
  { code: "SA", label: "Saudi Arabia" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "EG", label: "Egypt" },
  { code: "KW", label: "Kuwait" },
  { code: "QA", label: "Qatar" },
  { code: "BH", label: "Bahrain" },
  { code: "OM", label: "Oman" },
  { code: "JO", label: "Jordan" },
  { code: "IQ", label: "Iraq" },
  { code: "LB", label: "Lebanon" },
  { code: "MA", label: "Morocco" },
  { code: "DZ", label: "Algeria" },
  { code: "TN", label: "Tunisia" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "TR", label: "Turkey" },
];

/* Meta call-to-action button types (subset that works across objectives). */
const CTA_OPTIONS: { value: string; label: string }[] = [
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "SHOP_NOW", label: "Shop Now" },
  { value: "SIGN_UP", label: "Sign Up" },
  { value: "SUBSCRIBE", label: "Subscribe" },
  { value: "BOOK_TRAVEL", label: "Book Now" },
  { value: "CONTACT_US", label: "Contact Us" },
  { value: "DOWNLOAD", label: "Download" },
  { value: "GET_OFFER", label: "Get Offer" },
  { value: "ORDER_NOW", label: "Order Now" },
  { value: "SEND_MESSAGE", label: "Send Message" },
  { value: "APPLY_NOW", label: "Apply Now" },
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

/* One editable ad (creative) inside an ad set. */
interface AdDraft {
  creativeFileId: string | null;
  destinationUrl: string;
  headline: string;
  message: string;       // primary text shown with the ad
  callToAction: string;  // Meta CTA button type
}

function emptyAd(): AdDraft {
  return { creativeFileId: null, destinationUrl: "", headline: "", message: "", callToAction: "LEARN_MORE" };
}

/* One editable ad set in the create form. */
interface AdSetDraft {
  country: string;
  budget: string;
  startDate: string; // yyyy-mm-dd (local); "" = starts when activated
  endDate: string; // yyyy-mm-dd (local); "" = no end, runs until paused
  gender: number;  // 0=all, 1=men, 2=women
  language: number; // 0 = all (omit), else a Meta locale key
  ageMin: string;
  ageMax: string;
  interests: { id: string; name: string }[];
  ads: AdDraft[]; // 0 = ad-set-only (no ads); N = multiple ads to test
}

function emptyAdSet(): AdSetDraft {
  return {
    country: "SA", budget: "100", startDate: "", endDate: "",
    gender: 0, language: 0, ageMin: "18", ageMax: "65", interests: [], ads: [],
  };
}

const LANGUAGES: { key: number; label: string }[] = [
  { key: 0, label: "All languages" },
  { key: 28, label: "Arabic" },
  { key: 6, label: "English (US)" },
  { key: 24, label: "English (UK)" },
  { key: 5, label: "French" },
  { key: 7, label: "German" },
  { key: 10, label: "Spanish" },
  { key: 16, label: "Turkish" },
  { key: 9, label: "Italian" },
  { key: 22, label: "Portuguese (Brazil)" },
];

/* Debounced interest search → click results to add as chips. */
function InterestSearch({ selected, onChange }: {
  selected: { id: string; name: string }[];
  onChange: (next: { id: string; name: string }[]) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MetaInterest[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    timer.current = setTimeout(async () => {
      if (term.length < 2) { setResults([]); return; }
      setLoading(true);
      try {
        const r = await searchMetaInterests(term);
        setResults(r.interests);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, term.length < 2 ? 0 : 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  const add = (it: MetaInterest) => {
    if (!selected.some((s) => s.id === it.id)) onChange([...selected, { id: it.id, name: it.name }]);
    setQ(""); setResults([]);
  };
  const remove = (id: string) => onChange(selected.filter((s) => s.id !== id));

  return (
    <div style={{ position: "relative" }}>
      <input style={inputStyle} value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search interests, e.g. cooking, kitchen, online shopping" />
      {(loading || results.length > 0) && (
        <div style={{ position: "absolute", zIndex: 50, top: "100%", left: 0, right: 0, marginTop: 4,
          background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)",
          maxHeight: 220, overflowY: "auto", boxShadow: "0 6px 20px rgba(0,0,0,0.35)" }}>
          {loading && <div style={{ padding: 10, fontSize: 12, color: "var(--text-tertiary)" }}>Searching…</div>}
          {!loading && results.map((it) => (
            <button key={it.id} onClick={() => add(it)}
              style={{ display: "block", width: "100%", textAlign: "left", background: "transparent",
                border: "none", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-primary)",
                padding: "8px 10px", fontSize: 13, cursor: "pointer" }}>
              {it.name}
              {it.audience ? <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}> · {(it.audience / 1e6).toFixed(0)}M</span> : null}
              {it.path ? <span style={{ display: "block", color: "var(--text-tertiary)", fontSize: 10 }}>{it.path}</span> : null}
            </button>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {selected.map((s) => (
            <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12,
              background: "var(--accent)", color: "var(--text-inverse)", borderRadius: 999, padding: "3px 10px" }}>
              {s.name}
              <button onClick={() => remove(s.id)} style={{ background: "transparent", border: "none",
                color: "var(--text-inverse)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* One ad (creative) inside an ad set — the Drive creative + its copy. */
function AdCard({ index, total, draft, onChange, onRemove }: {
  index: number; total: number; draft: AdDraft;
  onChange: (d: AdDraft) => void; onRemove: () => void;
}) {
  const set = (patch: Partial<AdDraft>) => onChange({ ...draft, ...patch });
  return (
    <div style={{ border: "1px dashed var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)" }}>Ad {index + 1}</span>
        {total > 1 && (
          <button onClick={onRemove}
            style={{ background: "transparent", border: "none", color: "var(--danger)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Remove
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={labelStyle}>Creative — from Google Drive</label>
          <CreativePicker selectedFileId={draft.creativeFileId} onSelect={(id) => set({ creativeFileId: id })} />
        </div>
        <div>
          <label style={labelStyle}>Destination URL (required)</label>
          <input style={inputStyle} value={draft.destinationUrl} onChange={(e) => set({ destinationUrl: e.target.value })} placeholder="https://store.example.com/product" />
        </div>
        <div>
          <label style={labelStyle}>Headline (optional)</label>
          <input style={inputStyle} maxLength={255} value={draft.headline} onChange={(e) => set({ headline: e.target.value })} placeholder="Shop the collection" />
        </div>
        <div>
          <label style={labelStyle}>Primary text (optional — main text above the ad)</label>
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} maxLength={2200} value={draft.message}
            onChange={(e) => set({ message: e.target.value })} placeholder="Tell people what makes this worth their tap." />
        </div>
        <div>
          <label style={labelStyle}>Call to action button</label>
          <select style={inputStyle} value={draft.callToAction} onChange={(e) => set({ callToAction: e.target.value })}>
            {CTA_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function AdSetCard({ index, total, draft, onChange, onRemove, currency, showBudget }: {
  index: number; total: number; draft: AdSetDraft;
  onChange: (d: AdSetDraft) => void; onRemove: () => void; currency: string; showBudget: boolean;
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
        <div style={showBudget ? undefined : { gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Region</label>
          <select style={inputStyle} value={draft.country} onChange={(e) => set({ country: e.target.value })}>
            {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </div>
        {showBudget && (
          <div>
            <label style={labelStyle}>Daily budget ({currency})</label>
            <input style={inputStyle} type="number" value={draft.budget} onChange={(e) => set({ budget: e.target.value })} />
          </div>
        )}
        <div>
          <label style={labelStyle}>Start date (optional — leave empty to start when activated)</label>
          <input style={inputStyle} type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>End date (optional — auto-stops; empty = until paused)</label>
          <input style={inputStyle} type="date" value={draft.endDate} onChange={(e) => set({ endDate: e.target.value })} />
        </div>

        {/* Audience targeting */}
        <div>
          <label style={labelStyle}>Gender</label>
          <select style={inputStyle} value={draft.gender} onChange={(e) => set({ gender: Number(e.target.value) })}>
            <option value={0}>All</option>
            <option value={1}>Men</option>
            <option value={2}>Women</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Language</label>
          <select style={inputStyle} value={draft.language} onChange={(e) => set({ language: Number(e.target.value) })}>
            {LANGUAGES.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Age min</label>
          <input style={inputStyle} type="number" min={13} max={65} value={draft.ageMin} onChange={(e) => set({ ageMin: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Age max</label>
          <input style={inputStyle} type="number" min={13} max={65} value={draft.ageMax} onChange={(e) => set({ ageMax: e.target.value })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Interests (optional — narrows to relevant people)</label>
          <InterestSearch selected={draft.interests} onChange={(next) => set({ interests: next })} />
        </div>
      </div>

      {/* Ads under this ad set — add several to test creatives against one audience. */}
      <div style={{ marginTop: 14 }}>
        <label style={labelStyle}>Ads (optional — add creatives from Google Drive to test against this audience)</label>
        {draft.ads.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
            {draft.ads.map((ad, ai) => (
              <AdCard key={ai} index={ai} total={draft.ads.length} draft={ad}
                onChange={(d) => set({ ads: draft.ads.map((x, xi) => (xi === ai ? d : x)) })}
                onRemove={() => set({ ads: draft.ads.filter((_, xi) => xi !== ai) })} />
            ))}
          </div>
        )}
        <button onClick={() => set({ ads: [...draft.ads, emptyAd()] })}
          style={{ ...inputStyle, width: "auto", cursor: "pointer", fontWeight: 600,
            background: "transparent", border: "1px dashed var(--border-subtle)", color: "var(--text-secondary)" }}>
          + Add ad
        </button>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8 }}>Created PAUSED</div>
    </div>
  );
}

function CreateMetaCampaignForm({ currency, onDone }: { currency: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [objective, setObjective] = useState<MetaObjective>("OUTCOME_TRAFFIC");
  const [budgetLevel, setBudgetLevel] = useState<"abo" | "cbo">("abo");
  const [campaignBudget, setCampaignBudget] = useState("200");
  const [adSets, setAdSets] = useState<AdSetDraft[]>([emptyAdSet()]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adSetErrors, setAdSetErrors] = useState<string[]>([]);
  const [failedIdx, setFailedIdx] = useState<number[]>([]);   // 0-based ad-set indexes that failed
  const [campaignId, setCampaignId] = useState<string | null>(null); // existing campaign to retry into
  const [madeAdSets, setMadeAdSets] = useState<CreatedAdSet[]>([]);
  const [result, setResult] = useState<CreateMetaCampaignResult | null>(null);

  const cbo = budgetLevel === "cbo";

  function updateAdSet(i: number, d: AdSetDraft) {
    setAdSets((prev) => prev.map((s, idx) => (idx === i ? d : s)));
  }
  function removeAdSet(i: number) {
    setAdSets((prev) => prev.filter((_, idx) => idx !== i));
  }

  function buildSpec(a: AdSetDraft): AdSetSpec {
    return {
      country_code: a.country,
      ...(cbo ? {} : { daily_budget: Number(a.budget) }),
      age_min: Number(a.ageMin) || 18,
      age_max: Number(a.ageMax) || 65,
      ...(a.gender ? { gender: a.gender } : {}),
      ...(a.language ? { languages: [a.language] } : {}),
      ...(a.interests.length ? { interests: a.interests } : {}),
      ...(a.startDate ? { start_time: new Date(`${a.startDate}T00:00:00`).toISOString() } : {}),
      ...(a.endDate ? { end_time: new Date(`${a.endDate}T23:59:59`).toISOString() } : {}),
      ...(a.ads.length ? {
        ads: a.ads
          .filter((ad) => ad.creativeFileId)
          .map((ad) => ({
            creative_file_id: ad.creativeFileId as string,
            destination_url: ad.destinationUrl.trim(),
            headline: ad.headline.trim() || undefined,
            message: ad.message.trim() || undefined,
            call_to_action: ad.callToAction,
          })),
      } : {}),
    };
  }

  // Create the given ad-set indexes into an existing campaign, one request each.
  // Returns the new successes + which indexes failed (with messages).
  async function runAdSets(cid: string, indexes: number[]) {
    const made: CreatedAdSet[] = [];
    const errs: string[] = [];
    const failed: number[] = [];
    for (let pos = 0; pos < indexes.length; pos++) {
      const i = indexes[pos];
      const a = adSets[i];
      const adCount = a.ads.filter((ad) => ad.creativeFileId).length;
      setProgress(`Creating ad set ${pos + 1} of ${indexes.length}${adCount ? ` (uploading ${adCount} creative${adCount > 1 ? "s" : ""}…)` : ""}`);
      try {
        made.push(await createMetaAdSet(cid, buildSpec(a), { index: i + 1, name: name.trim(), objective }));
      } catch (e) {
        errs.push(`Ad set ${i + 1}: ${(e as Error)?.message ?? "failed"}`);
        failed.push(i);
      }
    }
    return { made, errs, failed };
  }

  async function submit() {
    setError(null);
    if (!name.trim()) { setError("Campaign name is required."); return; }
    if (cbo) {
      const cb = Number(campaignBudget);
      if (!cb || cb <= 0) { setError("Enter the campaign daily budget."); return; }
    }
    for (let i = 0; i < adSets.length; i++) {
      const a = adSets[i];
      if (!cbo) {
        const b = Number(a.budget);
        if (!b || b <= 0) { setError(`Ad set ${i + 1}: enter a daily budget.`); return; }
      }
      for (let j = 0; j < a.ads.length; j++) {
        const ad = a.ads[j];
        if (!ad.creativeFileId) { setError(`Ad set ${i + 1}, ad ${j + 1}: pick a creative or remove the ad.`); return; }
        if (!ad.destinationUrl.trim()) { setError(`Ad set ${i + 1}, ad ${j + 1}: add a destination URL.`); return; }
      }
    }
    setSubmitting(true);
    setAdSetErrors([]);
    try {
      setProgress("Creating campaign…");
      const shell = await createMetaCampaignShell({
        name: name.trim(),
        objective,
        ...(cbo ? { campaign_daily_budget: Number(campaignBudget) } : {}),
      });
      setCampaignId(shell.campaign_id);

      const { made, errs, failed } = await runAdSets(shell.campaign_id, adSets.map((_, i) => i));
      setMadeAdSets(made);
      setAdSetErrors(errs);
      setFailedIdx(failed);
      qc.invalidateQueries({ queryKey: metaKeys.campaigns() });
      if (made.length === 0) {
        setError(`Campaign created but every ad set failed.\n${errs.join("\n")}`);
      } else {
        setResult({ campaign_id: shell.campaign_id, status: "PAUSED", ad_sets: made });
      }
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to create campaign");
    } finally {
      setProgress(null);
      setSubmitting(false);
    }
  }

  // Retry ONLY the previously-failed ad sets into the same existing campaign.
  async function retryFailed() {
    if (!campaignId || failedIdx.length === 0) return;
    setSubmitting(true);
    try {
      const { made, errs, failed } = await runAdSets(campaignId, failedIdx);
      const allMade = [...madeAdSets, ...made];
      setMadeAdSets(allMade);
      setAdSetErrors(errs);
      setFailedIdx(failed);
      qc.invalidateQueries({ queryKey: metaKeys.campaigns() });
      setResult({ campaign_id: campaignId, status: "PAUSED", ad_sets: allMade });
      if (allMade.length === 0) setError(`Every ad set still failed.\n${errs.join("\n")}`);
    } catch (e) {
      setError((e as Error)?.message ?? "Retry failed");
    } finally {
      setProgress(null);
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
              {(a.ads ?? []).map((ad, j) => (
                <div key={ad.ad_id}>  ad {j + 1}: {ad.ad_id} (creative {ad.creative_id})</div>
              ))}
            </div>
          ))}
        </div>
        {adSetErrors.length > 0 && (
          <div style={{ fontSize: 12, color: "var(--warning)", marginTop: 10, lineHeight: 1.6 }}>
            {failedIdx.length} ad set{failedIdx.length > 1 ? "s" : ""} failed (the rest were created):
            {adSetErrors.map((m, i) => <div key={i}>• {m}</div>)}
          </div>
        )}
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>
          Created paused — hit Activate on the campaign row below to go live (spends real money).
        </div>
        {progress && <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 8 }}>⏳ {progress}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {failedIdx.length > 0 && (
            <button onClick={retryFailed} disabled={submitting}
              style={{ ...inputStyle, width: "auto", cursor: submitting ? "default" : "pointer", fontWeight: 600,
                background: "var(--warning)", color: "var(--text-inverse)", border: "none", opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Retrying…" : `Retry ${failedIdx.length} failed ad set${failedIdx.length > 1 ? "s" : ""}`}
            </button>
          )}
          <button onClick={onDone} disabled={submitting} style={{ ...inputStyle, width: "auto", cursor: "pointer", fontWeight: 600 }}>Done</button>
        </div>
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
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Budget level</label>
          <div style={{ display: "flex", gap: 8 }}>
            {([
              { key: "abo", label: "Per ad set", hint: "you set each" },
              { key: "cbo", label: "Whole campaign", hint: "Meta splits it" },
            ] as const).map((opt) => {
              const on = budgetLevel === opt.key;
              return (
                <button key={opt.key} onClick={() => setBudgetLevel(opt.key)}
                  style={{ flex: 1, textAlign: "left", padding: "8px 10px", cursor: "pointer",
                    borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600,
                    background: on ? "var(--accent)" : "var(--bg-input)",
                    color: on ? "var(--text-inverse)" : "var(--text-primary)",
                    border: `1px solid ${on ? "var(--accent)" : "var(--border-subtle)"}` }}>
                  {opt.label}
                  <span style={{ display: "block", fontSize: 11, fontWeight: 400, opacity: 0.8 }}>{opt.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
        {budgetLevel === "cbo" && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Campaign daily budget ({currency}) — shared across all ad sets</label>
            <input style={inputStyle} type="number" value={campaignBudget} onChange={(e) => setCampaignBudget(e.target.value)} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
        {adSets.map((a, i) => (
          <AdSetCard key={i} index={i} total={adSets.length} draft={a} currency={currency}
            showBudget={budgetLevel === "abo"}
            onChange={(d) => updateAdSet(i, d)} onRemove={() => removeAdSet(i)} />
        ))}
      </div>

      <button onClick={() => setAdSets((prev) => [...prev, emptyAdSet()])}
        style={{ ...inputStyle, width: "auto", marginTop: 12, cursor: "pointer", fontWeight: 600,
          background: "transparent", border: "1px dashed var(--border-subtle)", color: "var(--text-secondary)" }}>
        + Add ad set
      </button>

      {error && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 10, whiteSpace: "pre-wrap" }}>{error}</div>}
      {progress && <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 10 }}>⏳ {progress}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
        {campaignId && failedIdx.length > 0 ? (
          <button onClick={retryFailed} disabled={submitting}
            style={{ ...inputStyle, width: "auto", cursor: submitting ? "default" : "pointer", fontWeight: 600,
              background: "var(--warning)", color: "var(--text-inverse)", border: "none", opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "Retrying…" : `Retry ${failedIdx.length} failed ad set${failedIdx.length > 1 ? "s" : ""}`}
          </button>
        ) : (
          <button onClick={submit} disabled={submitting}
            style={{ ...inputStyle, width: "auto", cursor: submitting ? "default" : "pointer", fontWeight: 600,
              background: "var(--accent)", color: "var(--text-inverse)", border: "none", opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "Creating…" : `Create ${adSets.length > 1 ? `${adSets.length} ad sets ` : ""}(paused)`}
          </button>
        )}
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

/* Modal confirming an irreversible campaign delete. */
function DeleteConfirm({ name, busy, onConfirm, onCancel }: {
  name: string; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: 22, maxWidth: 420, width: "100%" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Delete “{name}”?</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          This permanently deletes the campaign <b>and all its ad sets and ads</b> from
          Meta. This <b>cannot be undone</b>. (To just stop spending, use Pause instead.)
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={busy}
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)",
              borderRadius: "var(--radius-sm)", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            style={{ background: "var(--danger)", border: "none", color: "var(--text-inverse)",
              borderRadius: "var(--radius-sm)", padding: "8px 14px", fontSize: 13, fontWeight: 700,
              cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Deleting…" : "Delete permanently"}
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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: account } = useMetaAccount(connected);
  const { data: campaignsResp, isLoading: campaignsLoading, isError, error } = useMetaCampaigns(connected);
  const { data: insightsResp } = useMetaInsights("campaign", "last_7d", connected);
  const setStatus = useSetMetaCampaignStatus();
  const deleteCampaign = useDeleteMetaCampaign();
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

      <MetaAuditPanel />

      <MetaOptimizerPanel />

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
                <th style={{ width: 150 }}></th>
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
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <StatusButton active={active} busy={rowBusy}
                            onPause={() => setStatus.mutate({ id: c.id, status: "PAUSED" })}
                            onActivate={() => setConfirmTarget({ scope: "campaign", id: c.id, name: c.name })} />
                          <button onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                            title="Delete campaign"
                            style={{ background: "transparent", border: "1px solid var(--border-subtle)",
                              color: "var(--danger)", borderRadius: "var(--radius-sm)", padding: "5px 9px",
                              fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                            Delete
                          </button>
                        </div>
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

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          busy={deleteCampaign.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() =>
            deleteCampaign.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) })
          }
        />
      )}
    </div>
  );
}
