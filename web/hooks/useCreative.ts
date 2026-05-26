import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCreativeDrafts,
  decideCreativeDraft,
  generateCreative,
} from "@/services/creative.service";
import type { CreativeDraft } from "@/types";

export const creativeKeys = {
  all: ["creative"] as const,
  drafts: (hook: string, status: string) =>
    ["creative", "drafts", hook, status] as const,
};

export function useCreativeDrafts(hook = "all", status = "all") {
  return useQuery<CreativeDraft[]>({
    queryKey: creativeKeys.drafts(hook, status),
    queryFn: () => getCreativeDrafts(hook, status),
    staleTime: 120_000,
  });
}

export function useDecideDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: "approved" | "rejected";
    }) => decideCreativeDraft(id, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: creativeKeys.all });
    },
  });
}

export function useGenerateCreative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      campaign: string;
      hook: string;
      platform: string;
    }) => generateCreative(params),
    onSuccess: () => {
      // Job is async; poll or re-fetch after delay
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: creativeKeys.all });
      }, 3000);
    },
  });
}
