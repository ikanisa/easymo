import type { RouterContext } from "../../types.ts";
import { sendText } from "../../wa/client.ts";
import { t } from "../../i18n/translator.ts";
import { setState } from "../../state/store.ts";

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

  // Send welcome message and route to AI agent
  await sendText(
    ctx.from,
    t(ctx.locale, "generalBroker.welcome") ||
      "Welcome to General Broker! 🤝\n\nI can help you find and connect with service providers for various needs. What service are you looking for?"
  );

  return true;
}
