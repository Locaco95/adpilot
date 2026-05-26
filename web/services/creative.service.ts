import { apiGet, apiPost } from "./api-client";
import type { CreativeDraft } from "@/types";

export async function getCreativeDrafts(
  hook: string = "all",
  status: string = "all"
): Promise<CreativeDraft[]> {
  return apiGet<CreativeDraft[]>(
    `/creative/drafts?hook=${hook}&status=${status}`
  );
}

export async function decideCreativeDraft(
  id: string,
  decision: "approved" | "rejected"
): Promise<CreativeDraft> {
  return apiPost<CreativeDraft>(`/creative/drafts/${id}/decide`, {
    decision,
  });
}

export async function generateCreative(params: {
  campaign: string;
  hook: string;
  platform: string;
}): Promise<{ job_id: string }> {
  return apiPost<{ job_id: string }>("/creative/generate", params);
}
