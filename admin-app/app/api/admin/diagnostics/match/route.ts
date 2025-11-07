export const dynamic = 'force-dynamic';
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { parseAdminDiagnosticsMatch } from "@/lib/flow-exchange/admin-diagnostics";
import { mockAdminDiagnosticsMatch } from "@/lib/mock-data";
import { jsonOk, zodValidationError, jsonError } from "@/lib/api/http";
import { requireActorId, UnauthorizedError } from "@/lib/server/auth";
import { createHandler } from "@/app/api/withObservability";

const requestSchema = z.object({
  tripId: z.string().min(1, "Trip id required"),
});

function errorResponse(message: string, status = 200) {
  return jsonOk(
    {
      trip: mockAdminDiagnosticsMatch.trip,
      messages: [...mockAdminDiagnosticsMatch.messages, message],
    },
    status,
  );
}

export const POST = createHandler("admin_api.admin_diagnostics.match", async (request: Request) => {
  let body: { tripId: string };
  try {
    const json = await request.json();
    body = requestSchema.parse(json);
  } catch (error) {
    return zodValidationError(error);
  }

  // Require an admin actor for this diagnostic POST
  try {
    requireActorId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonError({ error: "unauthorized", message: err.message }, 401);
    }
    throw err;
  }

  const adminClient = getSupabaseAdminClient();
  const adminWaId = process.env.ADMIN_FLOW_WA_ID;

  if (!adminClient || !adminWaId) {
    return errorResponse(
      "Diagnostics match bridge not configured. Set SUPABASE credentials and ADMIN_FLOW_WA_ID.",
    );
  }

  try {
    const { data, error } = await adminClient.functions.invoke("flow-exchange", {
      body: {
        flow_id: "flow.admin.diag.v1",
        action_id: "a_admin_diag_match",
        wa_id: adminWaId,
        fields: { trip_id: body.tripId },
      },
    });

    if (error) {
      console.error("Diagnostics match invocation failed", error);
      return errorResponse(
        "Failed to load trip diagnostics. Showing mock data instead.",
      );
    }

    const result = parseAdminDiagnosticsMatch(data);
    return jsonOk(result);
  } catch (error) {
    console.error("Diagnostics match API error", error);
    return errorResponse(
      "Unexpected error while loading trip diagnostics. Showing mock data instead.",
    );
  }
});

export const runtime = "nodejs";
