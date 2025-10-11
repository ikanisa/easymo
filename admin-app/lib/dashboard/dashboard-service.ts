import { z } from "zod";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockDashboardKpis, mockTimeseries } from "@/lib/mock-data";
import {
  type DashboardKpi,
  dashboardKpiSchema,
  type TimeseriesPoint,
  timeseriesPointSchema,
} from "@/lib/schemas";

const useMocks = shouldUseMocks();
const isServer = typeof window === "undefined";

export type DashboardSnapshot = {
  kpis: DashboardKpi[];
  timeseries: TimeseriesPoint[];
};

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (!isServer) {
    if (useMocks) {
      return fallbackSnapshot();
    }
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard snapshot from API");
      }
      const json = await response.json();
      return parseSnapshot(json);
    } catch (error) {
      console.error("Client dashboard fetch failed", error);
      return fallbackSnapshot();
    }
  }

  if (useMocks) {
    return fallbackSnapshot();
  }

  const { getSupabaseAdminClient } = await import(
    "@/lib/server/supabase-admin"
  );
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return fallbackSnapshot();
  }

  const { data, error } = await adminClient.rpc("dashboard_snapshot");

  if (error || !data) {
    console.error("Failed to fetch dashboard snapshot from Supabase", error);
    return fallbackSnapshot();
  }

  return data as DashboardSnapshot;
}

function parseSnapshot(input: unknown): DashboardSnapshot {
  return z.object({
    kpis: z.array(dashboardKpiSchema),
    timeseries: z.array(timeseriesPointSchema),
  }).parse(input);
}

function fallbackSnapshot(): DashboardSnapshot {
  return {
    kpis: mockDashboardKpis,
    timeseries: mockTimeseries,
  };
}
