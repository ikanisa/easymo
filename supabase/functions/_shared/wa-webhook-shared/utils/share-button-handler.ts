// Universal Share easyMO button handler for all webhook microservices
// Import this in any microservice that shows buttons to users

import { logStructuredEvent } from "../../observability.ts";
import { t } from "../i18n/translator.ts";
import type { RouterContext } from "../types.ts";
import { IDS } from "../wa/ids.ts";
import { sendButtonsMessage } from "./reply.ts";
import { ensureReferralLink } from "./share.ts";

/**
 * Handle Share easyMO button tap
 * Call this in your button handler when buttonId === IDS.SHARE_EASYMO
 * 
 * @param ctx RouterContext with profileId, from, locale, supabase
 * @param serviceName Name of the calling microservice for observability
 * @returns true if handled successfully
 */
export async function handleShareEasyMOButton(
  ctx: RouterContext,
  serviceName: string,
): Promise<boolean> {
  if (!ctx.profileId) {
    // User not authenticated - shouldn't happen since button only shows for authenticated users
    await logStructuredEvent("SHARE_EASYMO_NO_PROFILE", {
      service: serviceName,
      from: ctx.from,
    });
    return false;
  }

  try {
    const link = await ensureReferralLink(ctx.supabase, ctx.profileId);
    
    const shareText = [
      t(ctx.locale, "wallet.earn.forward.instructions"),
      t(ctx.locale, "wallet.earn.share_text_intro"),
      link.waLink,
      t(ctx.locale, "wallet.earn.copy.code", { code: link.code }),
      t(ctx.locale, "wallet.earn.note.keep_code"),
    ].join("\n\n");

    await logStructuredEvent("SHARE_EASYMO_TAP", {
      service: serviceName,
      profileId: ctx.profileId,
      from: ctx.from,
      code: link.code,
      waLink: link.waLink,
    });

    await sendButtonsMessage(
      ctx,
      shareText,
      [
        { id: IDS.WALLET_EARN, title: t(ctx.locale, "wallet.earn.button") },
        { id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") },
      ],
    );

    return true;
  } catch (e) {
    await logStructuredEvent("SHARE_EASYMO_ERROR", {
      service: serviceName,
      profileId: ctx.profileId,
      from: ctx.from,
      error: (e as Error)?.message,
      stack: (e as Error)?.stack,
    }, "error");

    // Show user-friendly error message
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "wallet.earn.error"),
      [{ id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") }],
    );

    return true; // Return true because we handled it (with error message)
  }
}
