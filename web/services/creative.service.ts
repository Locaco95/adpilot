import { apiGet, apiPost } from "./api-client";
import type { CreativeDraft } from "@/types";

type MaybeList<T> = T[] | { items: T[]; total?: number } | { data: T[] };

function toArray<T>(res: MaybeList<T>): T[] {
  if (Array.isArray(res)) return res;
  if ("items" in res && Array.isArray(res.items)) return res.items;
  if ("data" in res && Array.isArray(res.data)) return res.data;
  return [];
}

export async function getCreativeDrafts(
  hook: string = "all",
  status: string = "all"
): Promise<CreativeDraft[]> {
  const res = await apiGet<MaybeList<CreativeDraft>>(
    `/creative/drafts?hook=${hook}&status=${status}`
  );
  return toArray(res);
}

export async function decideCreativeDraft(
  id: string,
  decision: "approved" | "rejected"
): Promise<CreativeDraft> {
  return apiPost<CreativeDraft>(`/creative/drafts/${id}/decide`, { decision });
}

export async function generateCreative(params: {
  campaign: string;
  hook: string;
  platform: string;
}): Promise<{ job_id: string }> {
  return apiPost<{ job_id: string }>("/creative/generate", params);
}
