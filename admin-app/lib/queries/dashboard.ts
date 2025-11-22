import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { z } from "zod";

import type { DashboardSnapshotResult } from "@/lib/dashboard/dashboard-types";
import { getAdminApiPath } from "@/lib/routes";
import {
  dashboardKpiSchema,
  timeseriesPointSchema,
  type WebhookError,
} from "@/lib/schemas";
import { listLatestWebhookErrors } from "@/lib/webhooks/webhook-service";

const DASHBOARD_SNAPSHOT_KEY: QueryKey = ["dashboard", "snapshot"];
const DASHBOARD_WEBHOOK_ERRORS_KEY: QueryKey = ["dashboard", "webhook-errors"];

const dashboardSnapshotSchema = z.object({
  kpis: z.array(dashboardKpiSchema),
  timeseries: z.array(timeseriesPointSchema).optional(),
});

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshotResult> {
  const response = await fetch(getAdminApiPath("dashboard"), { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to fetch dashboard snapshot from API");
  }

  const json = await response.json();
  const data = parseSnapshot(json);
  const integration = parseIntegrationHeaders(response.headers);

  return { data, integration };
}

export function fetchDashboardWebhookErrors(): Promise<WebhookError[]> {
  return listLatestWebhookErrors();
}

export function useDashboardSnapshotQuery(
  options?: UseQueryOptions<
    DashboardSnapshotResult,
    unknown,
    DashboardSnapshotResult
  >,
) {
  return useQuery({
    queryKey: DASHBOARD_SNAPSHOT_KEY,
    queryFn: fetchDashboardSnapshot,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    ...options,
  });
}

export function useDashboardWebhookErrorsQuery(
  options?: UseQueryOptions<WebhookError[], unknown, WebhookError[]>,
) {
  return useQuery({
    queryKey: DASHBOARD_WEBHOOK_ERRORS_KEY,
    queryFn: fetchDashboardWebhookErrors,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    ...options,
  });
}

export const dashboardQueryKeys = {
  snapshot: () => DASHBOARD_SNAPSHOT_KEY,
  webhookErrors: () => DASHBOARD_WEBHOOK_ERRORS_KEY,
} as const;

function parseSnapshot(input: unknown): DashboardSnapshotResult["data"] {
  const parsed = dashboardSnapshotSchema.parse(input);
  return {
    kpis: parsed.kpis,
    timeseries: parsed.timeseries ?? [],
  };
}

function parseIntegrationHeaders(headers: Headers): DashboardSnapshotResult["integration"] {
  const statusHeader = headers.get("x-dashboard-integration-status");
  const message = headers.get("x-dashboard-integration-message") ?? undefined;
  const remediation = headers.get("x-dashboard-integration-remediation") ?? undefined;

  return {
    status: statusHeader === "degraded" ? "degraded" : "ok",
    target: "dashboard_snapshot",
    ...(message ? { message } : {}),
    ...(remediation ? { remediation } : {}),
  };
}
