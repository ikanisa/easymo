import type { SupabaseClient } from "@supabase/supabase-js";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";

export async function notifyWalletTransferRecipient(
  client: SupabaseClient,
  recipientId: string,
  amount: number,
  senderName: string = "Someone",
): Promise<void> {
  try {
    // Fetch recipient's WhatsApp number and token balance from users table
    const { data: user, error } = await client
      .from("users")
      .select("phone, name, tokens")
      .eq("id", recipientId)
      .single();

    if (error || !user) {
      console.warn("wallet.notify_recipient_fail", { recipientId, error: error?.message });
      return;
    }

    const waId = user.phone;
    if (!waId) return;

    const balance = user.tokens ?? 0;

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
    // Fetch user details from users table
    const { data: user } = await client
      .from("users")
      .select("phone, name")
      .eq("id", userId)
      .single();
    
    const userPhone = user?.phone ?? "Unknown";
    const userName = user?.name ?? "User";

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
