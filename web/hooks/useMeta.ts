import { useQuery } from "@tanstack/react-query";
import {
  getMetaStatus,
  getMetaAccount,
  getMetaCampaigns,
  getMetaInsights,
} from "@/services/meta.service";

export const metaKeys = {
  all: ["meta"] as const,
  status: () => ["meta", "status"] as const,
  account: () => ["meta", "account"] as const,
  campaigns: () => ["meta", "campaigns"] as const,
  insights: (level: string, preset: string) =>
    ["meta", "insights", level, preset] as const,
};

export function useMetaStatus() {
  return useQuery({
    queryKey: metaKeys.status(),
    queryFn: getMetaStatus,
    staleTime: 60_000,
    retry: false,
  });
}

export function useMetaAccount(enabled = true) {
  return useQuery({
    queryKey: metaKeys.account(),
    queryFn: getMetaAccount,
    staleTime: 60_000,
    enabled,
    retry: false,
  });
}

export function useMetaCampaigns(enabled = true) {
  return useQuery({
    queryKey: metaKeys.campaigns(),
    queryFn: getMetaCampaigns,
    staleTime: 30_000,
    enabled,
    retry: false,
  });
}

export function useMetaInsights(
  level: "account" | "campaign" | "adset" | "ad" = "campaign",
  datePreset = "last_7d",
  enabled = true
) {
  return useQuery({
    queryKey: metaKeys.insights(level, datePreset),
    queryFn: () => getMetaInsights(level, datePreset),
    staleTime: 30_000,
    enabled,
    retry: false,
  });
}
