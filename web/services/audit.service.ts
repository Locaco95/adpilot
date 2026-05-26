import { apiGet } from "./api-client";
import type { AuditEntry } from "@/types";

type MaybeList<T> = T[] | { items: T[]; total?: number } | { data: T[] };

function toArray<T>(res: MaybeList<T>): T[] {
  if (Array.isArray(res)) return res;
  if ("items" in res && Array.isArray(res.items)) return res.items;
  if ("data" in res && Array.isArray(res.data)) return res.data;
  return [];
}

export async function getAuditLog(
  limit: number = 50,
  offset: number = 0
): Promise<AuditEntry[]> {
  const res = await apiGet<MaybeList<AuditEntry>>(
    `/audit/log?limit=${limit}&offset=${offset}`
  );
  return toArray(res);
}
