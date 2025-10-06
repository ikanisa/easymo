import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { recordAdminAudit } from "./audit.ts";
import { handleAdminWallet } from "./wallet.ts";

export async function handleAdminPromoters(
  req: FlowExchangeRequest,
  ctx: { waId: string },
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_promoters_window":
    case "a_admin_open_promoters":
      return await listSnapshot(req);
    case "a_admin_promoters_reward":
      return await rewardPromoter(req, ctx.waId);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Unknown promoters action ${req.action_id}`,
        }],
      };
  }
}

async function listSnapshot(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const windowId = typeof req.fields?.window === "string"
    ? req.fields.window
    : "month";
  const { data, error } = await supabase
    .from("leaderboard_snapshots")
    .select("snapshot_window, generated_at, top9, your_rank_map")
    .eq("snapshot_window", windowId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "No snapshot available." }],
    };
  }
  return {
    next_screen_id: "s_promoters",
    data: {
      snapshot_window: windowId,
      generated_at: data.generated_at,
      top9: data.top9 ?? [],
      your_rank_map: data.your_rank_map ?? {},
    },
  };
}

async function rewardPromoter(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const waId = typeof req.fields?.wa_id === "string"
    ? req.fields.wa_id
    : undefined;
  const tokens = typeof req.fields?.tokens === "number"
    ? req.fields.tokens
    : Number(req.fields?.tokens ?? 0);
  if (!waId || !Number.isFinite(tokens) || tokens <= 0) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Enter a positive token amount." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_promoter_reward_start",
    targetId: waId,
    after: { tokens },
  });
  return await handleAdminWallet(
    {
      ...req,
      action_id: "a_admin_wallet_credit",
      fields: {
        wa_id: waId,
        amount: tokens,
        reason: req.fields?.reason ?? "Promoter reward",
      },
    },
    { waId: adminWa },
  );
}
