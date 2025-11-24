import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { recordAdminAudit } from "./audit.ts";

export async function handleAdminAlerts(
  req: FlowExchangeRequest,
  ctx: { waId: string },
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_alert_toggle":
      return await toggleAlert(req, ctx.waId);
    case "a_admin_open_alerts":
    case "a_admin_alert_refresh":
      return await listAlerts(ctx.waId);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Unknown alerts action ${req.action_id}`,
        }],
      };
  }
}

async function listAlerts(waId: string): Promise<FlowExchangeResponse> {
  const { data, error } = await supabase
    .from("admin_alert_prefs")
    .select("alert_key, enabled")
    .eq("admin_user_id", null);
  if (error) {
    return {
      next_screen_id: "s_alerts",
      messages: [{ level: "error", text: "Failed to load alerts." }],
    };
  }
  return {
    next_screen_id: "s_alerts",
    data: { alerts: data ?? [] },
  };
}

async function toggleAlert(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const key = typeof req.fields?.alert_key === "string"
    ? req.fields.alert_key
    : undefined;
  const enabledRaw = req.fields?.enabled;
  const enabled = typeof enabledRaw === "boolean"
    ? enabledRaw
    : enabledRaw === "true";
  if (!key) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing alert key." }],
    };
  }
  const { error } = await supabase
    .from("admin_alert_prefs")
    .upsert({ admin_user_id: null, alert_key: key, enabled }, {
      onConflict: "admin_user_id,alert_key",
    });
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to toggle alert." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_alert_toggle",
    targetId: key,
    after: { enabled },
  });
  return {
    next_screen_id: "s_alerts",
    messages: [{
      level: "info",
      text: enabled ? "Alert enabled." : "Alert disabled.",
    }],
  };
}
