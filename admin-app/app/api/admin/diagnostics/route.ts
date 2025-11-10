export const dynamic = 'force-dynamic';
import { jsonOk } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import {
  composeDiagnosticsSnapshot,
  parseAdminDiagnosticsHealth,
  parseAdminDiagnosticsLogs,
} from "@/lib/flow-exchange/admin-diagnostics";
import { mockAdminDiagnostics } from "@/lib/mock-data";
import { createHandler } from "@/app/api/withObservability";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ObservabilityContext } from "@/lib/server/observability";

type MatchSummary = {
  matchesLastHour: number;
  matchesLast24h: number;
  openTrips: number;
  errorCountLastHour: number;
  recentErrors: Array<{
    id: string;
    endpoint: string | null;
    status_code: number | null;
    received_at: string | null;
  }>;
  messages: string[];
};

type QueueSnapshot = {
  notificationsQueued: number;
  ocrPending: number;
  mobilityOpenTrips: number;
};

function withMessage(message: string) {
  return {
    health: {
      ...mockAdminDiagnostics.health,
      messages: [...mockAdminDiagnostics.health.messages, message],
    },
    logs: {
      ...mockAdminDiagnostics.logs,
      messages: [...mockAdminDiagnostics.logs.messages, message],
    },
    matches: mockAdminDiagnostics.matches,
    queues: mockAdminDiagnostics.queues,
  };
}

export const GET = createHandler(
  "admin_api.admin_diagnostics.get",
  async (_req, _ctx, observability) => {
    const adminClient = getSupabaseAdminClient();
    const adminWaId = process.env.ADMIN_FLOW_WA_ID;

    if (!adminClient || !adminWaId) {
      return jsonOk(
        withMessage(
          "Diagnostics bridge not configured. Set SUPABASE credentials and ADMIN_FLOW_WA_ID for live data.",
        ),
      );
    }

    try {
      const [healthResult, logsResult, matchSummary, queueSnapshot] =
        await Promise.all([
          adminClient.functions.invoke("flow-exchange", {
            body: {
              flow_id: "flow.admin.diag.v1",
              action_id: "a_admin_diag_health",
              wa_id: adminWaId,
            },
          }),
          adminClient.functions.invoke("flow-exchange", {
            body: {
              flow_id: "flow.admin.diag.v1",
              action_id: "a_admin_diag_logs",
              wa_id: adminWaId,
            },
          }),
          loadMatchSummary(adminClient, observability),
          loadQueueSnapshot(adminClient, observability),
        ]);

      if (healthResult.error || logsResult.error) {
        console.error(
          "Diagnostics invocation failed",
          healthResult.error,
          logsResult.error,
        );
        return jsonOk(
          withMessage(
            "Failed to load diagnostics from flow-exchange. Showing mock data instead.",
          ),
          502,
        );
      }

      const health = parseAdminDiagnosticsHealth(healthResult.data);
      const logs = parseAdminDiagnosticsLogs(logsResult.data);
      const snapshot = composeDiagnosticsSnapshot(
        health,
        logs,
        matchSummary,
        queueSnapshot,
      );
      observability.recordMetric?.("admin_diagnostics_load_success_total", 1);
      return jsonOk(snapshot);
    } catch (error) {
      console.error("Diagnostics API error", error);
      observability.recordMetric?.("admin_diagnostics_load_error_total", 1, {
        message: error instanceof Error ? error.message : "unknown",
      });
      return jsonOk(
        withMessage("Unexpected diagnostics error. Showing mock data instead."),
      );
    }
  },
);

async function loadMatchSummary(
  client: SupabaseClient,
  observability: ObservabilityContext,
): Promise<MatchSummary> {
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const messages: string[] = [];

  try {
    const [hourCountResult, dayCountResult] = await Promise.all([
      client
        .from("webhook_logs")
        .select("id", { head: true, count: "exact" })
        .eq("endpoint", "MOBILITY_MATCH")
        .gte("received_at", sinceHour),
      client
        .from("webhook_logs")
        .select("id", { head: true, count: "exact" })
        .eq("endpoint", "MOBILITY_MATCH")
        .gte("received_at", sinceDay),
    ]);

    if (hourCountResult.error || dayCountResult.error) {
      throw hourCountResult.error ?? dayCountResult.error;
    }

    const [errorCountResult, recentErrorsResult, openTripsResult] = await Promise.all([
      client
        .from("webhook_logs")
        .select("id", { head: true, count: "exact" })
        .gte("received_at", sinceHour)
        .or("status_code.gte.400,error_message.not.is.null"),
      client
        .from("webhook_logs")
        .select("id, endpoint, status_code, received_at")
        .gte("received_at", sinceHour)
        .or("status_code.gte.400,error_message.not.is.null")
        .order("received_at", { ascending: false })
        .limit(10),
      client
        .from("trips")
        .select("id", { head: true, count: "exact" })
        .eq("status", "open"),
    ]);

    if (errorCountResult.error || recentErrorsResult.error || openTripsResult.error) {
      throw errorCountResult.error ?? recentErrorsResult.error ?? openTripsResult.error;
    }

    observability.recordMetric?.(
      "admin_diagnostics_matches_last_hour",
      hourCountResult.count ?? 0,
    );
    observability.recordMetric?.(
      "admin_diagnostics_match_errors_last_hour",
      errorCountResult.count ?? 0,
    );

    return {
      matchesLastHour: hourCountResult.count ?? 0,
      matchesLast24h: dayCountResult.count ?? 0,
      openTrips: openTripsResult.count ?? 0,
      errorCountLastHour: errorCountResult.count ?? 0,
      recentErrors: (recentErrorsResult.data ?? []).map((row) => ({
        id: String(row.id ?? crypto.randomUUID()),
        endpoint: row.endpoint ?? null,
        status_code: row.status_code ?? null,
        received_at: row.received_at ?? null,
      })),
      messages,
    };
  } catch (error) {
    console.error("admin-diagnostics.match_summary_fail", error);
    messages.push("Failed to load live match telemetry. Showing cached values.");
    observability.recordMetric?.("admin_diagnostics_match_summary_error_total", 1);
    return {
      matchesLastHour: mockAdminDiagnostics.matches.matchesLastHour,
      matchesLast24h: mockAdminDiagnostics.matches.matchesLast24h,
      openTrips: mockAdminDiagnostics.matches.openTrips,
      errorCountLastHour: mockAdminDiagnostics.matches.errorCountLastHour,
      recentErrors: mockAdminDiagnostics.matches.recentErrors.map((err: any, idx: number) => ({
        id: err.id ?? `mock-err-${idx}`,
        endpoint: err.endpoint ?? '',
        status_code: err.status_code ?? 0,
        received_at: err.received_at ?? new Date().toISOString()
      })),
      messages,
    };
  }
}

async function loadQueueSnapshot(
  client: SupabaseClient,
  observability: ObservabilityContext,
): Promise<QueueSnapshot> {
  try {
    const [notificationsResult, ocrResult, mobilityResult] = await Promise.all([
      client
        .from("notifications")
        .select("id", { head: true, count: "exact" })
        .eq("status", "queued"),
      client
        .from("ocr_jobs")
        .select("id", { head: true, count: "exact" })
        .in("status", ["queued", "processing"]),
      client
        .from("trips")
        .select("id", { head: true, count: "exact" })
        .eq("status", "open"),
    ]);

    if (notificationsResult.error || ocrResult.error || mobilityResult.error) {
      throw notificationsResult.error ?? ocrResult.error ?? mobilityResult.error;
    }

    const snapshot: QueueSnapshot = {
      notificationsQueued: notificationsResult.count ?? 0,
      ocrPending: ocrResult.count ?? 0,
      mobilityOpenTrips: mobilityResult.count ?? 0,
    };

    observability.recordMetric?.(
      "admin_diagnostics_queue_notifications",
      snapshot.notificationsQueued,
    );
    observability.recordMetric?.(
      "admin_diagnostics_queue_ocr",
      snapshot.ocrPending,
    );
    observability.recordMetric?.(
      "admin_diagnostics_queue_mobility",
      snapshot.mobilityOpenTrips,
    );

    return snapshot;
  } catch (error) {
    console.error("admin-diagnostics.queue_snapshot_fail", error);
    observability.recordMetric?.("admin_diagnostics_queue_snapshot_error_total", 1);
    return mockAdminDiagnostics.queues;
  }
}

export const runtime = "nodejs";
