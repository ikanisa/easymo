/**
 * Message Router
 * Determines which service should handle incoming messages
 */

import type { RouterContext, WebhookPayload, HandlerResult } from "../../_shared/types/index.ts";
import { SERVICES, WA_IDS, STATE_KEYS } from "../../_shared/config/index.ts";
import { getState } from "../../_shared/state/index.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { routeByKeyword, type RoutingDecision } from "./keyword-router.ts";
import { routeByState } from "./state-router.ts";
import { forwardToService } from "./forwarder.ts";

// ============================================================================
// MAIN ROUTER
// ============================================================================

/**
 * Route incoming message to appropriate service
 */
export async function routeMessage(
  ctx: RouterContext,
  message: Record<string, unknown>,
  payload: WebhookPayload
): Promise<HandlerResult> {
  const messageType = String(message.type ?? "unknown");
  
  // Extract message content
  const textBody = (message.text as any)?.body?.toLowerCase().trim() ?? "";
  const buttonId = (message.interactive as any)?.button_reply?.id;
  const listId = (message.interactive as any)?.list_reply?.id;
  const interactiveId = buttonId || listId;

  logStructuredEvent("ROUTING_START", {
    requestId: ctx.requestId,
    messageType,
    hasText: !!textBody,
    hasInteractive: !!interactiveId,
  }, "debug");

  // 1. Check for interactive message routing
  if (interactiveId) {
    const decision = routeByInteractive(interactiveId);
    if (decision.service !== SERVICES.CORE) {
      return await forwardToService(ctx, decision.service, payload);
    }
  }

  // 2. Check for keyword-based routing
  if (textBody) {
    const decision = routeByKeyword(textBody);
    if (decision.service !== SERVICES.CORE) {
      return await forwardToService(ctx, decision.service, payload);
    }
    
    // Check if it's a greeting (handle locally)
    if (decision.reason === "greeting") {
      return { handled: false }; // Let fallback handle home menu
    }
  }

  // 3. Check for state-based routing
  if (ctx.profileId) {
    const state = await getState(ctx.supabase, ctx.profileId);
    if (state) {
      const decision = routeByState(state.key);
      if (decision.service !== SERVICES.CORE) {
        return await forwardToService(ctx, decision.service, payload);
      }
    }
  }

  // 4. Handle location messages
  if (messageType === "location") {
    return await routeLocationMessage(ctx, payload);
  }

  // 5. Handle media messages
  if (["image", "document"].includes(messageType)) {
    return await routeMediaMessage(ctx, payload);
  }

  // 6. Fallback - not handled, show home menu
  logStructuredEvent("ROUTING_FALLBACK", {
    requestId: ctx.requestId,
    messageType,
  }, "debug");

  return { handled: false };
}

// ============================================================================
// INTERACTIVE ROUTING
// ============================================================================

function routeByInteractive(id: string): RoutingDecision {
  // Mobility service
  if (
    id === "rides" ||
    id === WA_IDS.RIDES_MENU ||
    id === WA_IDS.SEE_DRIVERS ||
    id === WA_IDS.SEE_PASSENGERS ||
    id === WA_IDS.SCHEDULE_TRIP ||
    id === WA_IDS.GO_ONLINE ||
    id.startsWith("veh_") ||
    id.startsWith("MTCH::") ||
    id.startsWith("TRIP_")
  ) {
    return { service: SERVICES.MOBILITY, reason: "interactive", confidence: 1.0 };
  }

  // Insurance service
  if (
    id === "insurance" ||
    id === WA_IDS.INSURANCE_MENU ||
    id === WA_IDS.INSURANCE_SUBMIT ||
    id === WA_IDS.INSURANCE_HELP ||
    id.startsWith("claim_") ||
    id.startsWith("ins_")
  ) {
    return { service: SERVICES.INSURANCE, reason: "interactive", confidence: 1.0 };
  }

  // Profile service
  if (
    id === "wallet" ||
    id === "profile" ||
    id === WA_IDS.PROFILE_VIEW ||
    id === WA_IDS.WALLET_BALANCE ||
    id === WA_IDS.WALLET_TRANSFER ||
    id.startsWith("wallet_") ||
    id.startsWith("profile_")
  ) {
    return { service: SERVICES.PROFILE, reason: "interactive", confidence: 1.0 };
  }

  // Home/back buttons handled by core
  if (id === WA_IDS.BACK_HOME || id === WA_IDS.HOME_MENU) {
    return { service: SERVICES.CORE, reason: "interactive", confidence: 1.0 };
  }

  return { service: SERVICES.CORE, reason: "fallback", confidence: 0.5 };
}

// ============================================================================
// LOCATION ROUTING
// ============================================================================

async function routeLocationMessage(
  ctx: RouterContext,
  payload: WebhookPayload
): Promise<HandlerResult> {
  // Check state to determine destination
  if (ctx.profileId) {
    const state = await getState(ctx.supabase, ctx.profileId);
    if (state) {
      // Mobility-related states
      if (
        state.key.startsWith("mobility_") ||
        state.key.startsWith("schedule_") ||
        state.key.startsWith("go_online") ||
        state.key.startsWith("trip_")
      ) {
        return await forwardToService(ctx, SERVICES.MOBILITY, payload);
      }
    }
  }

  // Default: forward to mobility
  return await forwardToService(ctx, SERVICES.MOBILITY, payload);
}

// ============================================================================
// MEDIA ROUTING
// ============================================================================

async function routeMediaMessage(
  ctx: RouterContext,
  payload: WebhookPayload
): Promise<HandlerResult> {
  // Check state to determine destination
  if (ctx.profileId) {
    const state = await getState(ctx.supabase, ctx.profileId);
    if (state) {
      // Insurance document upload
      if (
        state.key === STATE_KEYS.INSURANCE_UPLOAD ||
        state.key === STATE_KEYS.CLAIM_DOCUMENTS ||
        state.key.startsWith("ins_")
      ) {
        return await forwardToService(ctx, SERVICES.INSURANCE, payload);
      }

      // Driver verification
      if (state.key.includes("verification") || state.key.includes("license")) {
        return await forwardToService(ctx, SERVICES.MOBILITY, payload);
      }
    }
  }

  // Default: forward to insurance (most common media use case)
  return await forwardToService(ctx, SERVICES.INSURANCE, payload);
}

export { routeByKeyword } from "./keyword-router.ts";
export { routeByState } from "./state-router.ts";
export { forwardToService } from "./forwarder.ts";
