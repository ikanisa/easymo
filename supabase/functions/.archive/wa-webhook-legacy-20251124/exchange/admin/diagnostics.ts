import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { logStructuredEvent } from "../../observe/log.ts";

export async function handleAdminDiagnostics(
  req: FlowExchangeRequest,
  ctx: { waId: string },
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_diag_match":
      return await matchDiag(req);
    case "a_admin_diag_health":
      return await systemHealth();
    case "a_admin_diag_logs":
      return await recentLogs();
    default:
      await logStructuredEvent("ADMIN_DIAG_PLACEHOLDER", {
        action: req.action_id,
        wa_id: ctx.waId,
      });
      return {
        next_screen_id: req.screen_id,
        messages: [{ level: "info", text: "Diagnostics coming soon." }],
      };
  }
}

async function matchDiag(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const tripId = typeof req.fields?.trip_id === "string"
    ? req.fields.trip_id
    : undefined;
  if (!tripId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Enter trip id." }],
    };
  }
  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, role, vehicle_type, status")
    .eq("id", tripId)
    .maybeSingle();
  if (error || !trip) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Trip not found." }],
    };
  }
  return {
    next_screen_id: "s_diag_match",
    data: { trip },
  };
}

async function systemHealth(): Promise<FlowExchangeResponse> {
  const { data: config } = await supabase
    .from("app_config")
    .select("admin_numbers, insurance_admin_numbers, admin_pin_required")
    .eq("id", 1)
    .maybeSingle();
  return {
    next_screen_id: "s_diag_health",
    data: {
      config,
    },
  };
}

async function recentLogs(): Promise<FlowExchangeResponse> {
  const { data, error } = await supabase
    .from("webhook_logs")
    .select("id, endpoint, status_code, received_at")
    .order("received_at", { ascending: false })
    .limit(5);
  if (error) {
    return {
      next_screen_id: "s_diag_logs",
      messages: [{ level: "error", text: "Failed to load logs." }],
    };
  }
  return {
    next_screen_id: "s_diag_logs",
    data: { logs: data ?? [] },
  };
}
