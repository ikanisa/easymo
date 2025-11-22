import "server-only";

import { z } from "zod";

import {
  type DashboardSnapshot,
  type DashboardSnapshotIntegration,
  type DashboardSnapshotResult,
} from "@/lib/dashboard/dashboard-types";
import {
  dashboardKpiSchema,
  timeseriesPointSchema,
} from "@/lib/schemas";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export type {
  DashboardSnapshot,
  DashboardSnapshotIntegration,
  DashboardSnapshotResult,
} from "@/lib/dashboard/dashboard-types";

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
