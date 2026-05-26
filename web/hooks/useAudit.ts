import { useQuery } from "@tanstack/react-query";
import { getAuditLog } from "@/services/audit.service";
import type { AuditEntry } from "@/types";

export const auditKeys = {
  all: ["audit"] as const,
  log: (limit: number, offset: number) =>
    ["audit", "log", limit, offset] as const,
};

export function useAuditLog(limit = 50, offset = 0) {
  return useQuery<AuditEntry[]>({
    queryKey: auditKeys.log(limit, offset),
    queryFn: () => getAuditLog(limit, offset),
    staleTime: 30_000,
  });
}
