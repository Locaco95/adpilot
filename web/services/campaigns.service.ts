import { apiGet, apiPatch } from "./api-client";
import type { Campaign } from "@/types";

type MaybeList<T> = T[] | { items: T[]; total?: number } | { data: T[] };

function toArray<T>(res: MaybeList<T>): T[] {
  if (Array.isArray(res)) return res;
  if ("items" in res && Array.isArray(res.items)) return res.items;
  if ("data" in res && Array.isArray(res.data)) return res.data;
  return [];
}

export async function getCampaigns(
  platform: string = "all",
  status: string = "all"
): Promise<Campaign[]> {
  const res = await apiGet<MaybeList<Campaign>>(
    `/campaigns?platform=${platform}&status=${status}`
  );
  return toArray(res);
}

export async function updateCampaign(
  id: string,
  patch: Partial<Campaign>
): Promise<Campaign> {
  return apiPatch<Campaign>(`/campaigns/${id}`, patch);
}
