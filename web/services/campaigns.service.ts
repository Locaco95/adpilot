import { apiGet, apiPatch } from "./api-client";
import type { Campaign } from "@/types";

export async function getCampaigns(
  platform: string = "all",
  status: string = "all"
): Promise<Campaign[]> {
  return apiGet<Campaign[]>(
    `/campaigns?platform=${platform}&status=${status}`
  );
}

export async function updateCampaign(
  id: string,
  patch: Partial<Campaign>
): Promise<Campaign> {
  return apiPatch<Campaign>(`/campaigns/${id}`, patch);
}
