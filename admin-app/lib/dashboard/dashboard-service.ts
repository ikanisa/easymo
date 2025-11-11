import { z } from "zod";
import {
  type DashboardKpi,
  type TimeseriesPoint,
  dashboardKpiSchema,
  timeseriesPointSchema,
} from "@/lib/schemas";
import { getAdminApiPath } from "@/lib/routes";

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
    data: emptySnapshot(),
    integration: degraded(message, remediation),
  };
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshotResult> {
  if (!isServer) {
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

  const { getSupabaseAdminClient } = await import(
    "@/lib/server/supabase-admin"
  );
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return fallbackResult(
      "Supabase admin client is not configured.",
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the admin app.",
    );
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
  const schema = z.object({
    kpis: z.array(dashboardKpiSchema),
    timeseries: z.array(timeseriesPointSchema).optional(),
  });
  const parsed = schema.parse(input);
  return {
    kpis: parsed.kpis,
    timeseries: parsed.timeseries ?? [],
  };
}

function emptySnapshot(): DashboardSnapshot {
  return {
    kpis: [],
    timeseries: [],
  };
}
