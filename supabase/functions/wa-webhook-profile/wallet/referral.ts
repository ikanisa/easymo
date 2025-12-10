import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { sendButtonsMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { logWalletAdjust } from "../../_shared/wa-webhook-shared/observe/log.ts";
import { setState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

const SUCCESS_MESSAGE = "Thanks! Your invite code is confirmed. Enjoy easyMO.";
const INVALID_MESSAGE =
  "Referral code not recognized. Double-check the link you received.";
const EXISTING_MESSAGE =
  "Referrals only apply to brand-new numbers, but you're already set.";
const SELF_MESSAGE = "You can't use your own referral code.";
const ERROR_MESSAGE =
  "We couldn't process that referral code right now. Please try again later.";

export async function handleWalletReferral(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, { key: "wallet_referral", data: {} });
  await sendButtonsMessage(
    ctx,
    "Paste the referral code you received (example: ABC123). We'll confirm it right away.",
    [{ id: IDS.BACK_PROFILE, title: "← Back" }],
  );
  return true;
}

export async function applyReferralCodeFromMessage(
  ctx: RouterContext,
  code: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // Normalize and strip REF: or REF prefix if present
  let normalized = code.trim().toUpperCase();
  
  // Handle various REF prefix formats: "REF:ABC123", "REF ABC123", "REF:  ABC123"
  const refPrefixMatch = normalized.match(/^REF[:\s]+(.+)$/);
  if (refPrefixMatch) {
    normalized = refPrefixMatch[1].trim();
  }
  
  if (!normalized || normalized.length < 4) {
    await sendText(ctx.from, INVALID_MESSAGE);
    return true;
  }
  
  try {
    console.log("referral.apply_attempt", { code: normalized.substring(0, 4) + "***", profileId: ctx.profileId?.substring(0, 8) });
    
    const { data, error } = await ctx.supabase.rpc("referral_apply_code_v2", {
      _joiner_profile_id: ctx.profileId,
      _joiner_whatsapp: ctx.from,
      _code: normalized,
      _idempotency_key: crypto.randomUUID(),
    });
    
    if (error) {
      console.error("referral.apply_fail", { error: error.message, code: error.code });
      await sendText(ctx.from, ERROR_MESSAGE);
      return true;
    }
    
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) {
      console.error("referral.apply_no_result");
      await sendText(ctx.from, ERROR_MESSAGE);
      return true;
    }
    
    const reason = typeof result.reason === "string" ? result.reason : null;
    console.log("referral.apply_result", { applied: result.applied, reason, tokensAwarded: result.tokens_awarded });
    
    if (result.applied) {
      // Send success message to the new user (joiner)
      await sendText(ctx.from, SUCCESS_MESSAGE);
      
      // Send notification to the promoter with their token reward
      if (
        typeof result.promoter_whatsapp === "string" &&
        result.promoter_whatsapp.length > 0
      ) {
        const tokens = typeof result.tokens_awarded === "number"
          ? result.tokens_awarded
          : 10;
        
        // Detailed notification to the promoter
        const promoterMessage = `🎉 *Congratulations!*\n\n` +
          `👏 You earned *+${tokens} tokens* from a successful referral!\n\n` +
          `A new user just joined easyMO using your referral link.\n\n` +
          `💰 Your current token balance has been updated.\n` +
          `Keep sharing to earn more!`;
        
        await sendText(result.promoter_whatsapp, promoterMessage);
        console.log("referral.notification_sent", { promoter: result.promoter_whatsapp.substring(0, 6) + "***", tokens });
      }
      
      await logWalletAdjust({
        actor: ctx.from,
        action: "referral_applied",
        code: normalized,
        tokens: result.tokens_awarded,
      });
      
      if (ctx.profileId) {
        await clearState(ctx.supabase, ctx.profileId);
      }
      return true;
    }
    
    // Handle rejection cases with appropriate messages
    switch (reason) {
      case "invalid_code":
        await sendText(ctx.from, INVALID_MESSAGE);
        break;
      case "existing_user":
      case "already_attributed":
        await sendText(ctx.from, EXISTING_MESSAGE);
        break;
      case "self_referral":
        await sendText(ctx.from, SELF_MESSAGE);
        break;
      default:
        await sendText(ctx.from, ERROR_MESSAGE);
        break;
    }
    
    await logWalletAdjust({
      actor: ctx.from,
      action: "referral_rejected",
      code: normalized,
      reason,
    });
    return true;
  } catch (err) {
    console.error("referral.apply_exception", err);
    await sendText(ctx.from, ERROR_MESSAGE);
    return true;
  }
}
