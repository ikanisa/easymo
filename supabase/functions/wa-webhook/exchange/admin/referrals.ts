import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { recordAdminAudit } from "./audit.ts";

export async function handleAdminReferrals(
  req: FlowExchangeRequest,
  ctx: { waId: string },
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_ref_refresh":
    case "a_admin_open_referrals":
      return await listReferrals(req);
    case "a_admin_ref_freeze":
      return await setReferralActive(req, ctx.waId, false);
    case "a_admin_ref_unfreeze":
      return await setReferralActive(req, ctx.waId, true);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Unknown referrals action ${req.action_id}`,
        }],
      };
  }
}

async function listReferrals(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const { data, error } = await supabase
    .from("referral_attributions")
    .select(
      "id, code, sharer_user_id, joiner_user_id, first_message_at, credited, credited_tokens",
    )
    .order("first_message_at", { ascending: false })
    .limit(10);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to load referrals." }],
    };
  }
  return {
    next_screen_id: "s_referrals_queue",
    data: {
      referrals: data ?? [],
    },
  };
}

async function setReferralActive(
  req: FlowExchangeRequest,
  adminWa: string,
  active: boolean,
): Promise<FlowExchangeResponse> {
  const code = typeof req.fields?.code === "string"
    ? req.fields.code
    : undefined;
  if (!code) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing referral code." }],
    };
  }
  const { error } = await supabase
    .from("referral_links")
    .update({ active })
    .eq("code", code);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to update referral." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: active ? "admin_ref_unfreeze" : "admin_ref_freeze",
    targetId: code,
  });
  return {
    next_screen_id: "s_referrals_queue",
    messages: [{
      level: "info",
      text: active ? "Referral enabled." : "Referral frozen.",
    }],
  };
}
