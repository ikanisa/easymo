/**
 * State Machine Handler
 *
 * Handles multi-step conversational flows for Buy & Sell agent.
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import type { ProfileContext } from "./interactive-buttons.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import type { ChatState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { EnhancedMarketplaceAgent } from "../core/agent-enhanced.ts";

/**
 * Handle state transitions for multi-step workflows
 *
 * @param state - Current user state from database
 * @param text - User's text message
 * @param ctx - Profile context with supabase client
 * @returns handled: true if state was handled, false otherwise
 */
export async function handleStateTransition(
  state: ChatState | null,
  text: string,
  ctx: ProfileContext,
  correlationId?: string,
): Promise<{ handled: boolean }> {
  if (!state?.key) return { handled: false };

  const normalizedText = text.trim().toLowerCase();

  // Handle consent state for vendor outreach
  if (state.key === "awaiting_consent" || state.data?.awaitingConsent === true) {
    return await handleConsentResponse(state, normalizedText, ctx, correlationId);
  }

  // "home" is the default state - no special handling needed, let AI agent process normally
  if (state.key === "home") {
    return { handled: false };
  }

  // "PROFILE_MENU" state - user came from profile menu, treat as new conversation
  if (state.key === "PROFILE_MENU") {
    return { handled: false };
  }

  // State key not recognized (only log for states we don't expect)
  logStructuredEvent("BUY_SELL_UNKNOWN_STATE", {
    from: `***${ctx.from.slice(-4)}`,
    stateKey: state.key,
    correlationId,
  }, "warn");

  return { handled: false };
}

/**
 * Handle user consent response (YES/NO) for vendor outreach
 */
async function handleConsentResponse(
  state: ChatState,
  normalizedText: string,
  ctx: ProfileContext,
  correlationId?: string,
): Promise<{ handled: boolean }> {
  // Check if user confirmed
  const isYes = normalizedText === "yes" || 
                normalizedText === "y" || 
                normalizedText === "yeah" || 
                normalizedText === "sure" ||
                normalizedText === "ok" ||
                normalizedText === "okay" ||
                normalizedText === "proceed" ||
                normalizedText === "go ahead";

  const isNo = normalizedText === "no" || 
               normalizedText === "n" || 
               normalizedText === "nah" ||
               normalizedText === "cancel" ||
               normalizedText === "stop";

  if (!isYes && !isNo) {
    // Not a clear yes/no response, ask again
    await sendText(
      ctx.from,
      "Please reply YES if you want me to contact the businesses, or NO to cancel."
    );
    return { handled: true };
  }

  if (isNo) {
    // User declined - clear the pending outreach
    await ctx.supabase
      .from("marketplace_conversations")
      .update({
        flow_step: null,
        pending_vendor_outreach: null,
        updated_at: new Date().toISOString(),
      })
      .eq("phone", ctx.from);

    await sendText(
      ctx.from,
      "No problem! I won't contact the businesses. Let me know if you need anything else. 😊"
    );

    await logStructuredEvent("VENDOR_OUTREACH_CONSENT_DECLINED", {
      from: `***${ctx.from.slice(-4)}`,
      correlationId,
    });

    return { handled: true };
  }

  // User confirmed - proceed with broadcast
  try {
    // Load conversation context to get pending vendor outreach details
    const context = await EnhancedMarketplaceAgent.loadContext(ctx.from, ctx.supabase);
    const pendingOutreach = context.pendingVendorOutreach;

    if (!pendingOutreach || !pendingOutreach.awaitingConsent) {
      await sendText(ctx.from, "Sorry, I lost track of your request. Please start over.");
      return { handled: true };
    }

    // Get candidate vendors for this request
    const requestId = pendingOutreach.requestId || context.currentIntentId;
    if (!requestId) {
      await sendText(ctx.from, "Sorry, I couldn't find the businesses list. Please try your search again.");
      return { handled: true };
    }

    // Get candidates from database
    const { data: candidates, error: candidatesError } = await ctx.supabase
      .from("candidate_vendors")
      .select("id, name, phone, address, is_onboarded")
      .eq("request_id", requestId)
      .not("phone", "is", null) // Only businesses with phone numbers
      .order("is_onboarded", { ascending: false }) // Tier 1 first
      .order("display_order", { ascending: true })
      .limit(30);

    if (candidatesError || !candidates || candidates.length === 0) {
      await sendText(ctx.from, "Sorry, I couldn't find the businesses to contact. Please try your search again.");
      await logStructuredEvent("VENDOR_OUTREACH_CANDIDATES_NOT_FOUND", {
        from: `***${ctx.from.slice(-4)}`,
        requestId,
        error: candidatesError?.message,
        correlationId,
      }, "error");
      return { handled: true };
    }

    // Call broadcast function
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const bridgeApiKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !bridgeApiKey) {
      await sendText(ctx.from, "Sorry, there's a configuration error. Please try again later.");
      await logStructuredEvent("VENDOR_OUTREACH_CONFIG_ERROR", {
        from: `***${ctx.from.slice(-4)}`,
        correlationId,
      }, "error");
      return { handled: true };
    }

    const broadcastPayload = {
      requestId: `sourcing-${requestId}`,
      userPhone: ctx.from,
      userLocationLabel: (context.location as any)?.text || undefined,
      needDescription: pendingOutreach.requestSummary,
      vendorFilter: {
        tags: pendingOutreach.requestType === "medicine" ? ["pharmacy"] : [],
      },
      candidateIds: candidates.map(c => c.id), // Pass candidate IDs
    };

    const broadcastResponse = await fetch(
      `${supabaseUrl}/functions/v1/whatsapp-broadcast`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${bridgeApiKey}`,
          "x-correlation-id": correlationId || "",
        },
        body: JSON.stringify(broadcastPayload),
      }
    );

    if (!broadcastResponse.ok) {
      const errorText = await broadcastResponse.text();
      await sendText(
        ctx.from,
        `I found ${candidates.length} businesses, but I'm having trouble reaching out to them right now. Please try again in a moment.`
      );
      
      await logStructuredEvent("VENDOR_OUTREACH_BROADCAST_ERROR", {
        from: `***${ctx.from.slice(-4)}`,
        requestId,
        error: errorText,
        status: broadcastResponse.status,
        correlationId,
      }, "error");
      
      return { handled: true };
    }

    const broadcastResult = await broadcastResponse.json();
    
    // Update conversation state
    await ctx.supabase
      .from("marketplace_conversations")
      .update({
        flow_step: "broadcast_sent",
        pending_vendor_outreach: {
          ...pendingOutreach,
          awaitingConsent: false,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("phone", ctx.from);

    await sendText(
      ctx.from,
      `Great! I've reached out to ${broadcastResult.sentCount || candidates.length} businesses about your request. ` +
      `You'll receive notifications when they respond. This usually takes a few hours.`
    );

    await logStructuredEvent("VENDOR_OUTREACH_CONFIRMED", {
      from: `***${ctx.from.slice(-4)}`,
      requestId,
      candidateCount: candidates.length,
      sentCount: broadcastResult.sentCount || candidates.length,
      correlationId,
    });

    return { handled: true };

  } catch (error) {
    await sendText(
      ctx.from,
      "Sorry, something went wrong while contacting the businesses. Please try again."
    );

    await logStructuredEvent("VENDOR_OUTREACH_ERROR", {
      from: `***${ctx.from.slice(-4)}`,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, "error");

    return { handled: true };
  }
}
