import { apiGet } from "./api-client";
import type { OverviewSummary, DailyMetrics, Anomaly } from "@/types";

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
  return apiGet<Anomaly[]>(`/overview/anomalies?status=${status}`);
}
