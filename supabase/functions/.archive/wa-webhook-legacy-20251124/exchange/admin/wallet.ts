import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { recordAdminAudit } from "./audit.ts";

const WALLET_TYPES = new Set([
  "referral_credit",
  "redeem",
  "adjust",
  "reversal",
  "welcome_bonus",
]);

export async function handleAdminWallet(
  req: FlowExchangeRequest,
  ctx: { waId: string },
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_wallet_lookup":
      return await lookup(req);
    case "a_admin_wallet_credit":
      return await adjust(req, ctx.waId, 1);
    case "a_admin_wallet_debit":
      return await adjust(req, ctx.waId, -1);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Unknown wallet action ${req.action_id}`,
        }],
      };
  }
}

async function lookup(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const waId = typeof req.fields?.wa_id === "string"
    ? req.fields.wa_id
    : undefined;
  if (!waId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Enter WhatsApp number." }],
    };
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, whatsapp_e164, display_name")
    .eq("whatsapp_e164", waId)
    .maybeSingle();
  if (profileError || !profile) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Profile not found." }],
    };
  }
  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance_tokens")
    .eq("user_id", profile.user_id)
    .maybeSingle();
  const { data: ledger } = await supabase
    .from("wallet_ledger")
    .select("id, delta_tokens, type, created_at")
    .eq("user_id", profile.user_id)
    .order("created_at", { ascending: false })
    .limit(5);
  return {
    next_screen_id: "s_wallet_snapshot",
    data: {
      profile,
      wallet,
      ledger: ledger ?? [],
    },
  };
}

async function adjust(
  req: FlowExchangeRequest,
  adminWa: string,
  direction: 1 | -1,
): Promise<FlowExchangeResponse> {
  const waId = typeof req.fields?.wa_id === "string"
    ? req.fields.wa_id
    : undefined;
  const amountRaw = typeof req.fields?.amount === "number"
    ? req.fields.amount
    : Number(req.fields?.amount);
  const reason = typeof req.fields?.reason === "string"
    ? req.fields.reason
    : null;
  if (!waId || !Number.isFinite(amountRaw)) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Invalid amount or user." }],
    };
  }
  const amount = Math.abs(amountRaw) * direction;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, whatsapp_e164")
    .eq("whatsapp_e164", waId)
    .maybeSingle();
  if (profileError || !profile) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Profile not found." }],
    };
  }
  const type = direction > 0 ? "adjust" : "reversal";
  if (!WALLET_TYPES.has(type)) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Invalid ledger type." }],
    };
  }
  const { error: ledgerError } = await supabase
    .from("wallet_ledger")
    .insert({
      user_id: profile.user_id,
      delta_tokens: amount,
      type,
      meta: reason ? { reason } : null,
    });
  if (ledgerError) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to write ledger." }],
    };
  }
  const { data: walletRow, error: walletFetchError } = await supabase
    .from("wallets")
    .select("balance_tokens")
    .eq("user_id", profile.user_id)
    .maybeSingle();
  if (walletFetchError) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to load wallet." }],
    };
  }
  const nextBalance = (walletRow?.balance_tokens ?? 0) + amount;
  const { error: walletUpdateError } = await supabase
    .from("wallets")
    .upsert({ user_id: profile.user_id, balance_tokens: nextBalance }, {
      onConflict: "user_id",
    });
  if (walletUpdateError) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to update wallet." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: direction > 0 ? "admin_wallet_credit" : "admin_wallet_debit",
    targetId: profile.user_id,
    after: { delta_tokens: amount },
    reason,
  });
  return {
    next_screen_id: "s_wallet_snapshot",
    messages: [{ level: "info", text: "Wallet adjusted." }],
    data: {
      profile,
    },
  };
}
