import { apiGet } from "./api-client";
import type { AuditEntry } from "@/types";

export async function getAuditLog(
  limit: number = 50,
  offset: number = 0
): Promise<AuditEntry[]> {
  return apiGet<AuditEntry[]>(
    `/audit/log?limit=${limit}&offset=${offset}`
  );
}
