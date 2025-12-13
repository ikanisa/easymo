import type { SupabaseClient } from "@supabase/supabase-js";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";

export async function notifyWalletTransferRecipient(
  client: SupabaseClient,
  recipientId: string,
  amount: number,
  senderName: string = "Someone",
): Promise<void> {
  try {
    // Fetch recipient's WhatsApp number
    const { data: profile, error } = await client
      .from("profiles")
      .select("whatsapp_e164, wa_id")
      .eq("user_id", recipientId)
      .single();

    if (error || !profile) {
      console.warn("wallet.notify_recipient_fail", { recipientId, error: error?.message });
      return;
    }

    const waId = profile.whatsapp_e164 || profile.wa_id;
    if (!waId) return;

    // Fetch new balance
    const { data: account } = await client
      .from("wallet_accounts")
      .select("tokens")
      .eq("profile_id", recipientId)
      .single();
    
    const balance = account?.tokens ?? 0;

    const message = `💎 *You received ${amount} tokens!*\n\nFrom: ${senderName}\nNew Balance: ${balance} tokens\n\nUse /wallet to check your account.`;

    await sendText(waId, message);
  } catch (err) {
    console.error("wallet.notify_recipient_error", err);
  }
}

export async function notifyWalletRedemptionAdmin(
  client: SupabaseClient,
  userId: string,
  rewardTitle: string,
  cost: number,
): Promise<void> {
  try {
    // Fetch user details
    const { data: profile } = await client
      .from("profiles")
      .select("whatsapp_e164, display_name")
      .eq("user_id", userId)
      .single();
    
    const userPhone = profile?.whatsapp_e164 ?? "Unknown";
    const userName = profile?.display_name ?? "User";

    const message = `🎁 *New Reward Redemption*\n\nUser: ${userName} (${userPhone})\nReward: ${rewardTitle}\nCost: ${cost} tokens\n\nPlease fulfill this request.`;

    // Reuse insurance admin notification logic or send to specific wallet admins
    // For now, we'll use the same admin list as insurance for simplicity, or fallback to env var
    const adminWaId = Deno.env.get("WALLET_ADMIN_WA_ID");
    if (adminWaId) {
      await sendText(adminWaId, message);
    } else {
      console.warn("wallet.no_admin_configured", { message });
    }
  } catch (err) {
    console.error("wallet.notify_admin_error", err);
  }
}
