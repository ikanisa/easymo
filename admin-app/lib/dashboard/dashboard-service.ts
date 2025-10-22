import { z } from "zod";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockDashboardKpis, mockTimeseries } from "@/lib/mock-data";
import { callAdminFunction } from "@/lib/server/functions-client";
import {
  type DashboardKpi,
  dashboardKpiSchema,
  type TimeseriesPoint,
  timeseriesPointSchema,
} from "@/lib/schemas";
import { getAdminApiPath } from "@/lib/routes";

const useMocks = shouldUseMocks();
const isServer = typeof window === "undefined";

export type DashboardSnapshot = {
  kpis: DashboardKpi[];
  timeseries: TimeseriesPoint[];
};

export type DashboardSnapshotIntegration = {
  status: "ok" | "degraded";
  target: "dashboard_snapshot";
  message?: string;
  remediation?: string;
};

export type DashboardSnapshotResult = {
  data: DashboardSnapshot;
  integration: DashboardSnapshotIntegration;
};

function degraded(
  message: string,
  remediation?: string,
): DashboardSnapshotIntegration {
  return {
    status: "degraded",
    target: "dashboard_snapshot",
    message,
    remediation,
  };
}

function fallbackResult(
  message: string,
  remediation?: string,
): DashboardSnapshotResult {
  return {
    data: fallbackSnapshot(),
    integration: degraded(message, remediation),
  };
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshotResult> {
  if (!isServer) {
    if (useMocks) {
      return fallbackResult(
        "Runtime configured to use mock dashboard fixtures.",
        "Disable NEXT_PUBLIC_USE_MOCKS before production deploys.",
      );
    }
    try {
      const response = await fetch(getAdminApiPath("dashboard"), { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard snapshot from API");
      }
      const json = await response.json();
      return {
        data: parseSnapshot(json),
        integration: {
          status: "ok",
          target: "dashboard_snapshot",
        },
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  if (useMocks) {
    return fallbackResult(
      "Runtime configured to use mock dashboard fixtures.",
      "Disable NEXT_PUBLIC_USE_MOCKS before production deploys.",
    );
  }

  const { getSupabaseAdminClient } = await import(
    "@/lib/server/supabase-admin"
  );
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    // Fallback to Edge Function admin-stats if service-role envs are missing
    try {
      const stats = await callAdminFunction<any>("admin-stats");
      const kpis: DashboardKpi[] = [
        { id: "totalUsers", label: "Total Users", value: Number(stats?.total_users ?? 0) },
        { id: "driversOnline", label: "Drivers Online", value: Number(stats?.drivers_online ?? 0) },
        { id: "openTrips", label: "Open Trips", value: Number(stats?.open_trips ?? 0) },
        { id: "activeSubs", label: "Active Subscriptions", value: Number(stats?.active_subscriptions ?? 0) },
      ];
      const today = new Date();
      const base = Number(stats?.active_subscriptions ?? 0) || 0;
      const timeseries: TimeseriesPoint[] = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        return {
          date: d.toISOString(),
          issued: base,
          redeemed: 0,
        };
      });
      return {
        data: { kpis, timeseries },
        integration: { status: "ok", target: "dashboard_snapshot" },
      };
    } catch (e) {
      throw new Error("Supabase admin client is not configured.");
    }
  }

  const { data, error } = await adminClient.rpc("dashboard_snapshot");

  if (error || !data) {
    throw new Error(
      `Supabase RPC dashboard_snapshot returned an error: ${error?.message ?? "no data"}`,
    );
  }

  try {
    return {
      data: parseSnapshot(data),
      integration: {
        status: "ok",
        target: "dashboard_snapshot",
      },
    };
  } catch (parseError) {
    throw parseError instanceof Error
      ? new Error(`Supabase returned an unexpected dashboard payload: ${parseError.message}`)
      : new Error("Supabase returned an unexpected dashboard payload.");
  }
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
