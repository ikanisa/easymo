/**
 * WhatsApp Buy & Sell - Pure AI Agent Conversation
 *
 * SINGLE RESPONSIBILITY: AI-powered conversational marketplace assistant
 *
 * Scope:
 * - Welcome new users with AI agent introduction
 * - Pass all messages to AI agent for natural language processing
 * - Handle location sharing for nearby business search
 * - Manage user's business listings (My Businesses)
 * - WhatsApp deep links (wa.me/{phone})
 *
 * Flow:
 * 1. User taps "Buy and Sell" → AI welcomes them
 * 2. User sends any message → AI agent handles it
 * 3. AI can search businesses, create listings, handle inquiries conversationally
 * 4. No structured category workflow - pure natural language
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { claimEvent } from "../_shared/wa-webhook-shared/state/idempotency.ts";
import { extractWhatsAppMessage } from "./utils/index.ts";
import {
  type BuyAndSellContext,
  MarketplaceAgent,
  WELCOME_MESSAGE,
} from "./core/agent.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { classifyError, serializeError } from "./utils/error-handling.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req: Request): Promise<Response> => {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", "wa-webhook-buy-sell");
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Rate limiting (100 req/min for high-volume WhatsApp)
  const rateLimitCheck = await rateLimitMiddleware(req, {
    limit: 100,
    windowSeconds: 60,
  });

  if (!rateLimitCheck.allowed) {
    if (rateLimitCheck.response) {
      return rateLimitCheck.response;
    }
    return respond({ error: "rate_limit_exceeded" }, { status: 429 });
  }

  // Health check and webhook verification endpoint (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // WhatsApp webhook verification
    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", {
        status: 200,
        headers: {
          "X-Request-ID": requestId,
          "X-Correlation-ID": correlationId,
        },
      });
    }

    // Health check (no verification params)
    if (!mode && !token) {
      const health = await MarketplaceAgent.healthCheck();

      return respond({
        status: "healthy",
        service: "wa-webhook-buy-sell",
        scope: "ai_agent_conversation",
        aiProvider: health.aiProvider,
        timestamp: new Date().toISOString(),
      });
    }

    // Invalid verification attempt
    return respond({ error: "forbidden" }, { status: 403 });
  }

  // Only POST is allowed for webhook messages
  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed" }, { status: 405 });
  }

  const startTime = Date.now();

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify WhatsApp signature (Security requirement per docs/GROUND_RULES.md)
    const signatureHeader = req.headers.has("x-hub-signature-256")
      ? "x-hub-signature-256"
      : req.headers.has("x-hub-signature")
      ? "x-hub-signature"
      : null;
    const signature = signatureHeader ? req.headers.get(signatureHeader) : null;
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ??
      Deno.env.get("WA_APP_SECRET");
    const allowUnsigned =
      (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() ===
        "true";
    const internalForward = req.headers.get("x-wa-internal-forward") === "true";

    if (!appSecret) {
      logStructuredEvent("BUY_SELL_DIR_AUTH_CONFIG_ERROR", {
        error: "WHATSAPP_APP_SECRET not configured",
        correlationId,
      }, "error");
      return respond({ error: "server_misconfigured" }, { status: 500 });
    }

    let isValidSignature = false;
    if (signature) {
      try {
        isValidSignature = await verifyWebhookSignature(
          rawBody,
          signature,
          appSecret,
        );
        if (isValidSignature) {
          logStructuredEvent("BUY_SELL_DIR_SIGNATURE_VALID", {
            signatureHeader,
            correlationId,
          });
        }
      } catch (err) {
        logStructuredEvent("BUY_SELL_DIR_SIGNATURE_ERROR", {
          error: err instanceof Error ? err.message : String(err),
          correlationId,
        }, "error");
      }
    }

    if (!isValidSignature) {
      if (allowUnsigned || internalForward) {
        logStructuredEvent("BUY_SELL_DIR_AUTH_BYPASS", {
          reason: internalForward
            ? "internal_forward"
            : signature
            ? "signature_mismatch"
            : "no_signature",
          correlationId,
        }, "warn");
      } else {
        logStructuredEvent("BUY_SELL_DIR_AUTH_FAILED", {
          signatureProvided: !!signature,
          correlationId,
        }, "warn");
        return respond({ error: "unauthorized" }, { status: 401 });
      }
    }

    // Parse payload after verification
    const payload = JSON.parse(rawBody);
    const message = extractWhatsAppMessage(payload);

    if (!message?.from) {
      return respond({ success: true, ignored: "no_message" });
    }

    const text = message.body?.trim() ?? "";
    const userPhone = message.from;

    // CRITICAL: Deduplicate messages using message_id to prevent spam
    const messageId = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
      ?.id;
    if (messageId) {
      const claimed = await claimEvent(messageId, userPhone);
      if (!claimed) {
        await logStructuredEvent("BUY_SELL_DIR_DUPLICATE_BLOCKED", {
          message_id: messageId,
          from: `***${userPhone.slice(-4)}`,
          correlationId,
        });
        return respond({ success: true, message: "duplicate_blocked" });
      }
    }

    logStructuredEvent("BUY_SELL_MESSAGE_RECEIVED", {
      from: userPhone,
      type: message.type,
      hasLocation: !!message.location,
      requestId,
    });

    // Lookup profile once at the beginning (fixes duplicate lookups)
    // Use ensureProfile utility which handles all column variations (phone_number, wa_id, etc.)
    let profile: { user_id: string; language?: string } | null = null;
    try {
      const { ensureProfile } = await import(
        "../_shared/wa-webhook-shared/state/store.ts"
      );
      const profileData = await ensureProfile(supabase, userPhone);
      if (profileData) {
        profile = {
          user_id: profileData.user_id,
          language: profileData.locale,
        };
      }
    } catch (err) {
      logStructuredEvent("BUY_SELL_PROFILE_LOOKUP_EXCEPTION", {
        error: err instanceof Error ? err.message : String(err),
        userPhone: `***${userPhone.slice(-4)}`,
        correlationId,
      }, "error");
    }

    // === INTERACTIVE HANDLERS ===

    // Button replies (common actions + My Business management)
    if (
      message.type === "interactive" && message.interactive?.button_reply?.id
    ) {
      const buttonId = message.interactive.button_reply.id;

      logStructuredEvent("BUY_SELL_BUTTON_CLICKED", {
        buttonId,
        userPhone: `***${userPhone.slice(-4)}`,
        correlationId,
      });

      const { handleInteractiveButton } = await import(
        "./handlers/interactive-buttons.ts"
      );

      const result = await handleInteractiveButton(
        buttonId,
        userPhone,
        supabase,
        correlationId,
      );
      if (result.handled) {
        await recordMetric("buy_sell.button.handled", 1, { buttonId });
        return respond({
          success: true,
          message: result.action || "button_handled",
        });
      } else {
        await recordMetric("buy_sell.button.unhandled", 1, { buttonId });
      }
    }

    // === LOCATION HANDLER ===

    // Location sharing - pass to AI agent with location context
    if (message.type === "location" && message.location) {
      // Validate location data
      const lat = message.location.latitude;
      const lng = message.location.longitude;

      if (
        typeof lat !== "number" || typeof lng !== "number" ||
        isNaN(lat) || isNaN(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180
      ) {
        logStructuredEvent("BUY_SELL_INVALID_LOCATION", {
          lat,
          lng,
          userPhone: `***${userPhone.slice(-4)}`,
          correlationId,
        }, "warn");
        await sendText(
          userPhone,
          "⚠️ Invalid location data. Please share your location again.",
        );
        return respond({ success: true, message: "invalid_location" });
      }

      // Profile already looked up at the beginning

      if (profile) {
        // Load or create context with location
        const context: BuyAndSellContext = await MarketplaceAgent.loadContext(
          userPhone,
          supabase,
        );
        context.location = {
          lat,
          lng,
        };

        // Process location with agent
        const agent = new MarketplaceAgent(supabase, correlationId);
        const response = await agent.process("I shared my location", context);

        await sendText(userPhone, response.message);
        return respond({
          success: true,
          message: "location_processed_by_agent",
        });
      }
    }

    // === TEXT HANDLERS ===

    // Profile already looked up at the beginning

    if (profile) {
      const { getState } = await import(
        "../_shared/wa-webhook-shared/state/store.ts"
      );
      const state = await getState(supabase, profile.user_id);

      // Handle state transitions using state machine handler
      if (state) {
        logStructuredEvent("BUY_SELL_STATE_TRANSITION", {
          stateKey: state.key,
          userPhone: `***${userPhone.slice(-4)}`,
          correlationId,
        });

        const { handleStateTransition } = await import(
          "./handlers/state-machine.ts"
        );
        const { getProfileContext } = await import(
          "./handlers/interactive-buttons.ts"
        );

        const ctx = await getProfileContext(userPhone, supabase);
        if (ctx) {
          const result = await handleStateTransition(
            state,
            text,
            ctx,
            correlationId,
          );
          if (result.handled) {
            await recordMetric("buy_sell.state_transition.handled", 1, {
              stateKey: state.key,
            });
            return respond({
              success: true,
              message: "state_transition_handled",
            });
          } else {
            await recordMetric("buy_sell.state_transition.unhandled", 1, {
              stateKey: state.key || "unknown",
            });
          }
        }
      }
    }

    // === AI AGENT PROCESSING ===

    // Home/menu/reset commands → show welcome message and reset context
    const lower = text.toLowerCase();
    if (
      !text ||
      lower === "menu" ||
      lower === "home" ||
      lower === "start" ||
      lower === "stop" ||
      lower === "exit" ||
      lower === "reset"
    ) {
      // Reset conversation context
      await MarketplaceAgent.resetContext(userPhone, supabase);

      // Send localized welcome message
      const locale = profile?.language || "en";
      const { getWelcomeMessage } = await import("./core/agent.ts");
      const welcomeMessage = await getWelcomeMessage(locale);
      await sendText(userPhone, welcomeMessage);

      const duration = Date.now() - startTime;
      recordMetric("buy_sell.welcome_shown", 1, {
        duration_ms: duration,
      });

      return respond({ success: true, message: "welcome_shown" });
    }

    // Load context for regular messages (after filtering out reset commands)
    const context = await MarketplaceAgent.loadContext(userPhone, supabase);
    const isNewSession = !context.conversationHistory ||
      context.conversationHistory.length === 0;

    // For new sessions with actual text, show welcome first then process
    if (isNewSession && text) {
      const locale = profile?.language || "en";
      const { getWelcomeMessage } = await import("./core/agent.ts");
      const welcomeMessage = await getWelcomeMessage(locale);
      await sendText(userPhone, welcomeMessage);

      await logStructuredEvent("BUY_SELL_WELCOME_NEW_USER", {
        from: `***${userPhone.slice(-4)}`,
        firstMessage: text.slice(0, 50),
        correlationId,
      });
    }

    // Process message with AI agent (passing the pre-loaded context)
    const agent = new MarketplaceAgent(supabase, correlationId);
    const response = await agent.process(text, context);

    // Send response to user
    await sendText(userPhone, response.message);

    const duration = Date.now() - startTime;
    recordMetric("buy_sell.agent_message.processed", 1, {
      duration_ms: duration,
      action: response.action,
    });

    return respond({ success: true, action: response.action });
  } catch (error) {
    const duration = Date.now() - startTime;
    const { message: errorMessage, stack: errorStack, code: errorCode } =
      serializeError(error);
    const { isUserError, isSystemError, statusCode } = classifyError(error);

    logStructuredEvent(
      "BUY_SELL_ERROR",
      {
        error: errorMessage,
        errorCode,
        stack: errorStack,
        durationMs: duration,
        requestId,
        correlationId,
        errorType: isUserError
          ? "user_error"
          : (isSystemError ? "system_error" : "unknown_error"),
        statusCode,
      },
      isSystemError ? "error" : "warn",
    );

    recordMetric("buy_sell.message.error", 1, {
      error_type: isUserError
        ? "user_error"
        : (isSystemError ? "system_error" : "unknown_error"),
    });

    // Return appropriate status code
    return respond({
      error: isUserError
        ? "invalid_request"
        : (isSystemError ? "service_unavailable" : "internal_error"),
      message: isUserError
        ? errorMessage
        : "An error occurred. Please try again later.",
    }, { status: statusCode });
  }
});
