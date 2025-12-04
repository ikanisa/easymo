import { t } from "../../i18n/translator.ts";
import { setState } from "../../state/store.ts";
import type { RouterContext } from "../../types.ts";
import { sendButtonsMessage } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";

/**
 * Start General Broker AI Agent
 * Routes user to the general broker AI agent for service requests
 */
export async function handleGeneralBrokerStart(ctx: RouterContext): Promise<boolean> {
  // Set state to indicate user is in general broker flow
  if (ctx.profileId) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "general_broker",
      data: { active: true, started_at: new Date().toISOString() },
    });
  }

  // Send welcome message with home button
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "generalBroker.welcome") ||
      "Welcome to General Broker! 🤝\n\nI can help you find and connect with service providers for various needs. What service are you looking for?",
    [{ id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") }]
  );

  return true;
}
