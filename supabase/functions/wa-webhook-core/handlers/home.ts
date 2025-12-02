/**
 * Home Menu Handler
 * Handles home menu display and navigation
 */

import type { RouterContext, HandlerResult } from "../../_shared/types/index.ts";
import { STATE_KEYS } from "../../_shared/config/index.ts";
import { StateMachine } from "../../_shared/state/index.ts";
import { sendList, homeMenuList } from "../../_shared/messaging/index.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

/**
 * Handle home menu request
 */
export async function handleHomeMenu(ctx: RouterContext): Promise<HandlerResult> {
  try {
    logStructuredEvent("HOME_MENU_REQUESTED", {
      requestId: ctx.requestId,
      userId: ctx.profileId,
    }, "debug");

    // Clear state (return to home)
    if (ctx.profileId) {
      const sm = new StateMachine(ctx.supabase);
      await sm.clearState(ctx.profileId);
    }

    // Get localized home menu
    const menu = homeMenuList(ctx.locale);

    // Send to user
    const result = await sendList(ctx, menu);

    if (result.success) {
      logStructuredEvent("HOME_MENU_SENT", {
        requestId: ctx.requestId,
        userId: ctx.profileId,
        messageId: result.messageId,
      });
    }

    return { handled: result.success };
  } catch (error) {
    logStructuredEvent("HOME_MENU_ERROR", {
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    return { handled: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Handle back to home button
 */
export async function handleBackHome(ctx: RouterContext): Promise<HandlerResult> {
  return handleHomeMenu(ctx);
}
