import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getActions,
  decideAction,
  revokeAction,
} from "@/services/actions.service";
import type { Action, DecideActionPayload } from "@/types";

export const actionKeys = {
  all: ["actions"] as const,
  list: (filter: string) => ["actions", "list", filter] as const,
};

export function useActions(filter = "all") {
  return useQuery<Action[]>({
    queryKey: actionKeys.list(filter),
    queryFn: () => getActions(filter),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useDecideAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: DecideActionPayload;
    }) => decideAction(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: actionKeys.all });
    },
  });
}

export function useRevokeAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeAction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: actionKeys.all });
    },
  });
}
