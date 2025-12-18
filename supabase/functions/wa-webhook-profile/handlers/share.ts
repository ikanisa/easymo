import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendTextMessage, sendButtonsMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { WA_BOT_NUMBER_E164 } from "../../_shared/wa-webhook-shared/config.ts";
import type { SupabaseClient } from "../../_shared/wa-webhook-shared/deps.ts";

/**
 * Share EasyMO - ONE STEP ONLY
 * User taps "Share easyMO" → Bot immediately sends deeplink
 */
export async function handleShareEasyMO(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    // Get or create referral code
    const code = await ensureReferralCode(ctx.supabase, ctx.profileId);
    
    // Build deeplink: https://wa.me/<EASYMO_WA_NUMBER>?text=EASYMO%20REF%20<CODE>
    const botNumber = WA_BOT_NUMBER_E164 || "+22893002751";
    const digits = botNumber.replace(/^\+/, "").replace(/\D/g, "");
    const deeplink = `https://wa.me/${digits}?text=${encodeURIComponent(`EASYMO REF ${code}`)}`;
    
    // Send immediately with simple instructions
    const message = `🔗 *Share easyMO*\n\n` +
      `Invite your friends to join easyMO! 👥\n\n` +
      `*Your referral link:*\n` +
      `${deeplink}\n\n` +
      `📤 *How to share:*\n` +
      `1. Copy the link above\n` +
      `2. Forward it to your contacts\n` +
      `3. When they join, you earn *10 tokens*! 🎉\n\n` +
      `💡 The more friends you invite, the more tokens you earn!`;
    
    await sendButtonsMessage(
      ctx,
      message,
      [
        { id: "PROFILE", title: "← Back to Profile" },
        { id: IDS.BACK_MENU, title: "🏠 Home" },
      ],
    );

    // Log share event (optional: update shared_at)
    await logStructuredEvent("SHARE_EASYMO_SENT", {
      userId: ctx.profileId,
      code,
      from: ctx.from,
    });

    // Update last_shared_at if referral_links table has that column
    try {
      await ctx.supabase
        .from("referral_links")
        .update({ last_shared_at: new Date().toISOString() })
        .eq("user_id", ctx.profileId);
    } catch {
      // Non-fatal - column might not exist
    }

    return true;
  } catch (error) {
    await logStructuredEvent("SHARE_EASYMO_ERROR", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    await sendTextMessage(
      ctx,
      `❌ *Error*\n\n` +
      `Sorry, I couldn't generate your share link right now. 😔\n\n` +
      `💡 Please try again in a moment!`,
    );
    return true;
  }
}

/**
 * Ensure user has a referral code (create if missing)
 */
async function ensureReferralCode(
  supabase: SupabaseClient,
  profileId: string,
): Promise<string> {
  // Check for existing code
  const { data: existing } = await supabase
    .from("referral_links")
    .select("code")
    .eq("user_id", profileId)
    .eq("active", true)
    .maybeSingle();

  if (existing?.code) {
    return existing.code;
  }

  // Generate new code via RPC
  try {
    const { data } = await supabase.rpc("generate_referral_code", {
      p_profile_id: profileId,
    });
    if (data && typeof data === "string") {
      return data;
    }
  } catch {
    // Fallback to local generation
  }

  // Local fallback generation
  const code = generateReferralCode(8);
  
  // Save to database
  await supabase
    .from("referral_links")
    .upsert({
      user_id: profileId,
      code,
      active: true,
      short_url: `https://easy.mo/r/${code}`,
    }, { onConflict: "user_id" });

  return code;
}

function generateReferralCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (const byte of bytes) {
    result += alphabet[byte % alphabet.length];
  }
  return result;
}

