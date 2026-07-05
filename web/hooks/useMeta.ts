import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMetaStatus,
  getMetaAccount,
  getMetaCampaigns,
  getMetaCampaignAdSets,
  getMetaAdSetAds,
  getMetaInsights,
  getMetaAudit,
  setMetaCampaignStatus,
  setMetaAdSetStatus,
  deleteMetaCampaign,
} from "@/services/meta.service";

export const metaKeys = {
  all: ["meta"] as const,
  status: () => ["meta", "status"] as const,
  account: () => ["meta", "account"] as const,
  campaigns: () => ["meta", "campaigns"] as const,
  insights: (level: string, preset: string) =>
    ["meta", "insights", level, preset] as const,
  audit: (preset: string) => ["meta", "audit", preset] as const,
  adsets: (campaignId: string) => ["meta", "adsets", campaignId] as const,
};

export function useMetaAudit(datePreset = "last_7d", enabled = true) {
  return useQuery({
    queryKey: metaKeys.audit(datePreset),
    queryFn: () => getMetaAudit(datePreset),
    staleTime: 60_000,
    enabled,
    retry: false,
  });
}

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

export function useSetMetaCampaignStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "PAUSED" }) =>
      setMetaCampaignStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metaKeys.campaigns() });
      qc.invalidateQueries({ queryKey: metaKeys.all });
    },
  });
}

export function useDeleteMetaCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMetaCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metaKeys.campaigns() });
    },
  });
}

export function useMetaCampaignAdSets(campaignId: string, enabled = true) {
  return useQuery({
    queryKey: metaKeys.adsets(campaignId),
    queryFn: () => getMetaCampaignAdSets(campaignId),
    staleTime: 30_000,
    enabled,
    retry: false,
  });
}

export function useMetaAdSetAds(adsetId: string, enabled = true) {
  return useQuery({
    queryKey: ["meta", "ads", adsetId] as const,
    queryFn: () => getMetaAdSetAds(adsetId),
    staleTime: 30_000,
    enabled,
    retry: false,
  });
}

export function useSetMetaAdSetStatus(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "PAUSED" }) =>
      setMetaAdSetStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metaKeys.adsets(campaignId) });
      qc.invalidateQueries({ queryKey: metaKeys.campaigns() });
    },
  });
}
