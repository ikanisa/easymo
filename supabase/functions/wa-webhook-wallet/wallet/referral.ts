import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { logWalletAdjust } from "../../_shared/wa-webhook-shared/observe/log.ts";

const SUCCESS_MESSAGE = "Thanks! Your invite code is confirmed. Enjoy easyMO.";
const INVALID_MESSAGE =
  "Referral code not recognized. Double-check the link you received.";
const EXISTING_MESSAGE =
  "Referrals only apply to brand-new numbers, but you're already set.";
const SELF_MESSAGE = "You can't use your own referral code.";
const ERROR_MESSAGE =
  "We couldn't process that referral code right now. Please try again later.";

export async function applyReferralCodeFromMessage(
  ctx: RouterContext,
  code: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;
  try {
    const { data, error } = await ctx.supabase.rpc("referral_apply_code_v2", {
      _joiner_profile_id: ctx.profileId,
      _joiner_whatsapp: ctx.from,
      _code: normalized,
      _idempotency_key: crypto.randomUUID(),
    });
    if (error) {
      console.error("referral.apply_fail", error);
      await sendText(ctx.from, ERROR_MESSAGE);
      return true;
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) {
      await sendText(ctx.from, ERROR_MESSAGE);
      return true;
    }
    const reason = typeof result.reason === "string" ? result.reason : null;
    if (result.applied) {
      await sendText(ctx.from, SUCCESS_MESSAGE);
      if (
        typeof result.promoter_whatsapp === "string" &&
        result.promoter_whatsapp.length > 0
      ) {
        const tokens = typeof result.tokens_awarded === "number"
          ? result.tokens_awarded
          : 10;
        await sendText(
          result.promoter_whatsapp,
          `👏 You earned +${tokens} tokens from a new user.`,
        );
      }
      await logWalletAdjust({
        actor: ctx.from,
        action: "referral_applied",
        code: normalized,
      });
      return true;
    }
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
