import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { recordAdminAudit } from "./audit.ts";

export async function handleAdminSettings(
  req: FlowExchangeRequest,
  ctx: { waId: string },
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_settings_load":
    case "a_admin_open_settings":
      return await loadSettings(ctx.waId);
    case "a_admin_display_name":
      return await updateDisplayName(req, ctx.waId);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Unknown settings action ${req.action_id}`,
        }],
      };
  }
}

async function loadSettings(waId: string): Promise<FlowExchangeResponse> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .eq("whatsapp_e164", waId)
    .maybeSingle();
  if (error) {
    return {
      next_screen_id: "s_settings",
      messages: [{ level: "error", text: "Failed to load profile." }],
    };
  }
  return {
    next_screen_id: "s_settings",
    data: { profile: data },
  };
}

async function updateDisplayName(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const newName = typeof req.fields?.display_name === "string"
    ? req.fields.display_name
    : undefined;
  if (!newName) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Enter display name." }],
    };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: newName })
    .eq("whatsapp_e164", adminWa);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to update profile." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_display_name",
    after: { display_name: newName },
  });
  return {
    next_screen_id: "s_settings",
    messages: [{ level: "info", text: "Display name saved." }],
  };
}
