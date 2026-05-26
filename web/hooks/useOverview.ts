import { useQuery } from "@tanstack/react-query";
import {
  getOverviewSummary,
  getOverviewDaily,
  getAnomalies,
} from "@/services/overview.service";
import type { OverviewSummary, DailyMetrics, Anomaly } from "@/types";

export const overviewKeys = {
  all: ["overview"] as const,
  summary: (window: number) => ["overview", "summary", window] as const,
  daily: (days: number) => ["overview", "daily", days] as const,
  anomalies: (status: string) => ["overview", "anomalies", status] as const,
};

export function useOverviewSummary(window: number = 7) {
  return useQuery<OverviewSummary>({
    queryKey: overviewKeys.summary(window),
    queryFn: () => getOverviewSummary(window),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useOverviewDaily(days: number = 14) {
  return useQuery<DailyMetrics>({
    queryKey: overviewKeys.daily(days),
    queryFn: () => getOverviewDaily(days),
    staleTime: 60_000,
  });
}

export function useAnomalies(status: "active" | "all" = "active") {
  return useQuery<Anomaly[]>({
    queryKey: overviewKeys.anomalies(status),
    queryFn: () => getAnomalies(status),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
