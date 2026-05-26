import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCampaigns, updateCampaign } from "@/services/campaigns.service";
import type { Campaign } from "@/types";

export const campaignKeys = {
  all: ["campaigns"] as const,
  list: (platform: string, status: string) =>
    ["campaigns", "list", platform, status] as const,
};

export function useCampaigns(platform = "all", status = "all") {
  return useQuery<Campaign[]>({
    queryKey: campaignKeys.list(platform, status),
    queryFn: () => getCampaigns(platform, status),
    staleTime: 30_000,
  });
}

export function useCampaignMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Campaign> }) =>
      updateCampaign(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campaignKeys.all });
    },
  });
}
