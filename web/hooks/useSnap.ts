import { useQuery } from "@tanstack/react-query";
import {
  getSnapStatus,
  getSnapMe,
  getSnapOrganizations,
  getSnapCampaigns,
  getSnapAdSquads,
  getSnapAds,
  getSnapCampaignStats,
} from "@/services/snap.service";

export const snapKeys = {
  all: ["snap"] as const,
  status: () => ["snap", "status"] as const,
  me: () => ["snap", "me"] as const,
  organizations: () => ["snap", "organizations"] as const,
  campaigns: (adAccountId: string) =>
    ["snap", "campaigns", adAccountId] as const,
  adsquads: (adAccountId: string) =>
    ["snap", "adsquads", adAccountId] as const,
  ads: (adAccountId: string) => ["snap", "ads", adAccountId] as const,
  campaignStats: (campaignId: string, granularity: string) =>
    ["snap", "campaign-stats", campaignId, granularity] as const,
};

export function useSnapStatus() {
  return useQuery({
    queryKey: snapKeys.status(),
    queryFn: getSnapStatus,
    staleTime: 60_000,
    retry: false,
  });
}

export function useSnapMe(enabled = true) {
  return useQuery({
    queryKey: snapKeys.me(),
    queryFn: getSnapMe,
    staleTime: 5 * 60_000,
    enabled,
    retry: false,
  });
}

export function useSnapOrganizations(enabled = true) {
  return useQuery({
    queryKey: snapKeys.organizations(),
    queryFn: () => getSnapOrganizations(true),
    staleTime: 60_000,
    enabled,
    retry: false,
  });
}

export function useSnapCampaigns(adAccountId: string | undefined) {
  return useQuery({
    queryKey: snapKeys.campaigns(adAccountId ?? ""),
    queryFn: () => getSnapCampaigns(adAccountId as string),
    staleTime: 30_000,
    enabled: !!adAccountId,
    retry: false,
  });
}

export function useSnapAdSquads(adAccountId: string | undefined) {
  return useQuery({
    queryKey: snapKeys.adsquads(adAccountId ?? ""),
    queryFn: () => getSnapAdSquads(adAccountId as string),
    staleTime: 30_000,
    enabled: !!adAccountId,
    retry: false,
  });
}

export function useSnapAds(adAccountId: string | undefined) {
  return useQuery({
    queryKey: snapKeys.ads(adAccountId ?? ""),
    queryFn: () => getSnapAds(adAccountId as string),
    staleTime: 30_000,
    enabled: !!adAccountId,
    retry: false,
  });
}

export function useSnapCampaignStats(
  campaignId: string | undefined,
  granularity: "TOTAL" | "DAY" | "HOUR" = "TOTAL"
) {
  return useQuery({
    queryKey: snapKeys.campaignStats(campaignId ?? "", granularity),
    queryFn: () => getSnapCampaignStats(campaignId as string, granularity),
    staleTime: 30_000,
    enabled: !!campaignId,
    retry: false,
  });
}
