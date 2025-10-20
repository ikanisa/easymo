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
      const response = await fetch("/api/dashboard", { cache: "no-store" });
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
      console.error("Client dashboard fetch failed", error);
      return fallbackResult(
        "Dashboard API request failed. Showing safe fixtures instead.",
        "Ensure /api/dashboard is reachable and Supabase credentials are valid.",
      );
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
    return fallbackResult(
      "Supabase admin credentials missing. Dashboard is using fixtures.",
      "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the environment.",
    );
  }

  const { data, error } = await adminClient.rpc("dashboard_snapshot");

  if (error || !data) {
    console.error("Failed to fetch dashboard snapshot from Supabase", error);
    return fallbackResult(
      "Supabase RPC dashboard_snapshot returned an error.",
      "Verify the RPC exists and that the service role can execute it.",
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
    console.error("Failed to parse dashboard snapshot", parseError);
    return fallbackResult(
      "Supabase returned an unexpected dashboard payload.",
      "Align the dashboard_snapshot RPC output with the dashboard schemas.",
    );
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
