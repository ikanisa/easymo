/**
 * Support AI Agent - Main Handler
 * Routes support/help/customer service requests through the comprehensive AI agent
 */

import type { RouterContext } from "../../types.ts";
import { 
  startCustomerSupportChat, 
  handleSupportMessage, 
  handleSupportButton,
  escalateToHumanSupport 
} from "./customer-support.ts";
import { logStructuredEvent } from "../../../_shared/observability.ts";

/**
 * Main entry point for Support Agent
 */
export async function handleSupportAgent(ctx: RouterContext): Promise<boolean> {
  const { from, profileId } = ctx;

  await logStructuredEvent("SUPPORT_AGENT_INVOKED", {
    profileId,
    from,
    source: "home_menu",
  });

  // Start support chat session
  return await startCustomerSupportChat(ctx);
}

/**
 * Handle support agent text messages
 */
export async function handleSupportAgentMessage(
  ctx: RouterContext,
  message: string
): Promise<boolean> {
  return await handleSupportMessage(ctx, message);
}

/**
 * Handle support agent button callbacks
 */
export async function handleSupportAgentButton(
  ctx: RouterContext,
  buttonId: string
): Promise<boolean> {
  // Handle escalation
  if (buttonId === "escalate_support") {
    return await escalateToHumanSupport(ctx);
  }

  return await handleSupportButton(ctx, buttonId);
}

/**
 * Export all support functions
 */
export {
  startCustomerSupportChat,
  handleSupportMessage,
  handleSupportButton,
  escalateToHumanSupport,
};
