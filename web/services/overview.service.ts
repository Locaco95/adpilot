import { apiGet } from "./api-client";
import type { OverviewSummary, DailyMetrics, Anomaly } from "@/types";

type MaybeList<T> = T[] | { items: T[]; total?: number } | { data: T[] };

function toArray<T>(res: MaybeList<T>): T[] {
  if (Array.isArray(res)) return res;
  if ("items" in res && Array.isArray(res.items)) return res.items;
  if ("data" in res && Array.isArray(res.data)) return res.data;
  return [];
}

export async function getOverviewSummary(
  window: number = 7
): Promise<OverviewSummary> {
  return apiGet<OverviewSummary>(`/overview/summary?window=${window}d`);
}

export async function getOverviewDaily(
  days: number = 14
): Promise<DailyMetrics> {
  return apiGet<DailyMetrics>(`/overview/daily?days=${days}`);
}

export async function getAnomalies(
  status: "active" | "all" = "active"
): Promise<Anomaly[]> {
  const res = await apiGet<MaybeList<Anomaly>>(
    `/overview/anomalies?status=${status}`
  );
  return toArray(res);
}
