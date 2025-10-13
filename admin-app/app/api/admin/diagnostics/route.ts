import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import {
  composeDiagnosticsSnapshot,
  parseAdminDiagnosticsHealth,
  parseAdminDiagnosticsLogs,
} from "@/lib/flow-exchange/admin-diagnostics";
import { mockAdminDiagnostics } from "@/lib/mock-data";

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
  };
}

export async function GET() {
  const adminClient = getSupabaseAdminClient();
  const adminWaId = process.env.ADMIN_FLOW_WA_ID;

  if (!adminClient || !adminWaId) {
    return NextResponse.json(
      withMessage(
        "Diagnostics bridge not configured. Set SUPABASE credentials and ADMIN_FLOW_WA_ID for live data.",
      ),
      { status: 200 },
    );
  }

  try {
    const [healthResult, logsResult] = await Promise.all([
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
    ]);

    if (healthResult.error || logsResult.error) {
      console.error("Diagnostics invocation failed", healthResult.error, logsResult.error);
      return NextResponse.json(
        withMessage(
          "Failed to load diagnostics from flow-exchange. Showing mock data instead.",
        ),
        { status: 502 },
      );
    }

    const health = parseAdminDiagnosticsHealth(healthResult.data);
    const logs = parseAdminDiagnosticsLogs(logsResult.data);
    const snapshot = composeDiagnosticsSnapshot(health, logs);
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error("Diagnostics API error", error);
    return NextResponse.json(
      withMessage(
        "Unexpected diagnostics error. Showing mock data instead.",
      ),
      { status: 500 },
    );
  }
}
