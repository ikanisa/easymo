import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { recordAdminAudit } from "./audit.ts";

async function resolveProfileId(waId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("whatsapp_e164", waId)
    .maybeSingle();
  return data?.user_id ?? null;
}

export async function handleAdminFreeze(
  req: FlowExchangeRequest,
  ctx: { waId: string },
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_freeze_number":
      return await setContactStatus(req, ctx.waId, true);
    case "a_admin_unfreeze_number":
      return await setContactStatus(req, ctx.waId, false);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Unknown freeze action ${req.action_id}`,
        }],
      };
  }
}

async function setContactStatus(
  req: FlowExchangeRequest,
  adminWa: string,
  freeze: boolean,
): Promise<FlowExchangeResponse> {
  const waId = typeof req.fields?.wa_id === "string"
    ? req.fields.wa_id
    : undefined;
  const reason = typeof req.fields?.reason === "string"
    ? req.fields.reason
    : null;
  if (!waId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing number." }],
    };
  }
  const nowIso = new Date().toISOString();
  const profileId = await resolveProfileId(waId);
  const { error } = await supabase
    .from("contacts")
    .upsert({
      msisdn_e164: waId,
      profile_id: profileId,
      opted_out: freeze,
      opted_in: !freeze,
      last_inbound_at: nowIso,
      opt_out_ts: freeze ? nowIso : null,
      opt_in_ts: freeze ? null : nowIso,
    }, { onConflict: "msisdn_e164" });
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to update contact." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: freeze ? "admin_freeze" : "admin_unfreeze",
    targetId: waId,
    reason,
  });
  return {
    next_screen_id: req.screen_id,
    messages: [{
      level: "info",
      text: freeze ? "Number frozen." : "Number unfrozen.",
    }],
  };
}
