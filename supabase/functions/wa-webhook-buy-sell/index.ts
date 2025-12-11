/**
 * WhatsApp Buy & Sell Webhook Handler (Home Menu Workflow)
 *
 * Scope:
 * - Presents Buy & Sell categories from `buy_sell_categories`
 * - Collects user location and lists nearby businesses (7k+ directory) via search_businesses_nearby
 * - Pagination and menu navigation only
 * - No marketplace AI, payments, or listings here (those live in the AI agent service)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { claimEvent } from "../_shared/wa-webhook-shared/state/idempotency.ts";
import { extractWhatsAppMessage } from "./utils/index.ts";
import {
  handleCategorySelection,
  handleLocationShared,
} from "./handle_category.ts";
import {
  handleNewSearch,
  handleShowMore,
} from "./handle_pagination.ts";
import {
  handleShowMoreCategories,
  showBuySellCategories,
} from "./show_categories.ts";
import { showAIWelcome } from "./show_ai_welcome.ts";
import { getCountryCode } from "../_shared/phone-utils.ts";
import {
  ensureProfile,
  getState,
  setState,
  clearState,
} from "../_shared/wa-webhook-shared/state/store.ts";

// =====================================================
// CONFIGURATION
// =====================================================



serve(async (req: Request): Promise<Response> => {
  // Rate limiting (100 req/min for high-volume WhatsApp)
  const rateLimitCheck = await rateLimitMiddleware(req, {
    limit: 100,
    windowSeconds: 60,
  });

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!;
  }

  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

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
          headers: { "X-Request-ID": requestId, "X-Correlation-ID": correlationId },
        });
      }

      // Health check (no verification params)
      if (!mode && !token) {
        return respond({
          status: "healthy",
          service: "wa-webhook-buy-sell",
          aiEnabled: false,
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
      const signatureMeta = (() => {
        if (!signature) {
          return {
            provided: false,
            header: signatureHeader,
            method: null as string | null,
            sample: null as string | null,
          };
        }
        const [method, hash] = signature.split("=", 2);
        return {
          provided: true,
          header: signatureHeader,
          method: method?.toLowerCase() ?? null,
          sample: hash ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : null,
        };
      })();
      const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ?? Deno.env.get("WA_APP_SECRET");
      const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";
      const internalForward = req.headers.get("x-wa-internal-forward") === "true";

      if (!appSecret) {
        logStructuredEvent("BUY_SELL_AUTH_CONFIG_ERROR", {
          error: "WHATSAPP_APP_SECRET not configured",
          correlationId,
        }, "error");
        return respond({ error: "server_misconfigured" }, { status: 500 });
      }

      let isValidSignature = false;
      if (signature) {
        try {
          isValidSignature = await verifyWebhookSignature(rawBody, signature, appSecret);
          if (isValidSignature) {
            logStructuredEvent("BUY_SELL_SIGNATURE_VALID", {
              signatureHeader,
              signatureMethod: signatureMeta.method,
              correlationId,
            });
          }
        } catch (err) {
          logStructuredEvent("BUY_SELL_SIGNATURE_ERROR", {
            error: err instanceof Error ? err.message : String(err),
            correlationId,
          }, "error");
        }
      }

      if (!isValidSignature) {
        if (allowUnsigned || internalForward) {
          logStructuredEvent("BUY_SELL_AUTH_BYPASS", {
            reason: internalForward ? "internal_forward" : signature ? "signature_mismatch" : "no_signature",
            signatureHeader,
            signatureMethod: signatureMeta.method,
            signatureSample: signatureMeta.sample,
            userAgent: req.headers.get("user-agent"),
            correlationId,
          }, "warn");
        } else {
          logStructuredEvent("BUY_SELL_AUTH_FAILED", {
            signatureProvided: signatureMeta.provided,
            signatureHeader,
            signatureMethod: signatureMeta.method,
            signatureSample: signatureMeta.sample,
            userAgent: req.headers.get("user-agent"),
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
      const messageId = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
      if (messageId) {
        const claimed = await claimEvent(messageId);
        if (!claimed) {
          await logStructuredEvent("BUY_SELL_DUPLICATE_BLOCKED", {
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

      // Category selection (interactive list)
      if (message.type === "interactive" && message.interactive?.list_reply?.id) {
        const selectedId = message.interactive.list_reply.id;

        if (selectedId.startsWith("category_")) {
          await handleCategorySelection(userPhone, selectedId);
          return respond({ success: true, message: "category_selection_sent" });
        }

        // Handle "Chat with Agent" selection - show AI welcome and set state
        if (selectedId === "business_broker_agent" || selectedId === "chat_with_agent") {
          const userCountry = mapCountry(getCountryCode(userPhone));
          await showAIWelcome(userPhone, userCountry);
          return respond({ success: true, message: "ai_welcome_shown" });
        }
        
        // Note: Actual AI processing happens in agent-buy-sell function
        // This webhook only shows the welcome message and sets state
      }

      // Button replies (pagination + common actions)
      if (message.type === "interactive" && message.interactive?.button_reply?.id) {
        const buttonId = message.interactive.button_reply.id;

        // Handle Share easyMO button (auto-appended by reply.ts)
        if (buttonId === "share_easymo") {
          const { handleShareEasyMOButton } = await import("../_shared/wa-webhook-shared/utils/share-button-handler.ts");
          const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
          );
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id, language")
            .eq("whatsapp_number", userPhone)
            .single();
          
          if (profile?.user_id) {
            await handleShareEasyMOButton({
              from: userPhone,
              profileId: profile.user_id,
              locale: (profile.language || "en") as any,
              supabase,
            }, "wa-webhook-buy-sell");
          }
          return respond({ success: true, message: "share_button_handled" });
        }

        // Handle Back/Home/Exit buttons - clear AI state and show categories
        if (buttonId === "back_home" || buttonId === "back_menu" || buttonId === "exit_ai") {
          const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
          );
          
          // Use proper state management - ensureProfile returns user_id
          const profile = await ensureProfile(supabase, userPhone);
          
          // Clear state using clearState function (writes to chat_state table)
          await clearState(supabase, profile.user_id);
          
          await logStructuredEvent("BUY_SELL_AI_STATE_CLEARED", {
            userId: profile.user_id,
            triggeredBy: buttonId,
          });
          
          // Track AI exit metric
          await recordMetric("buy_sell.ai_session_exit", 1, {
            reason: "user_button",
            buttonId,
          });
          
          const userCountry = mapCountry(getCountryCode(userPhone));
          await showBuySellCategories(userPhone, userCountry);
          return respond({ success: true, message: "returned_to_categories" });
        }

        if (buttonId === "buy_sell_show_more") {
          await handleShowMore(userPhone);
          return respond({ success: true, message: "show_more_processed" });
        }

        if (buttonId === "buy_sell_show_more_categories") {
          await handleShowMoreCategories(userPhone);
          return respond({ success: true, message: "show_more_categories_processed" });
        }

        if (buttonId === "buy_sell_new_search") {
          await handleNewSearch(userPhone);
          return respond({ success: true, message: "new_search_requested" });
        }
      }

      // Location sharing (structured flow)
      if (message.type === "location" && message.location) {
        await handleLocationShared(
          userPhone,
          message.location.latitude,
          message.location.longitude,
        );
        return respond({ success: true, message: "location_processed" });
      }

      // Home/menu commands -> show categories (NOT AI welcome)
      // Also works as escape from AI mode
      const lower = text.toLowerCase();
      if (
        !text ||
        lower === "menu" ||
        lower === "home" ||
        lower === "buy" ||
        lower === "sell" ||
        lower === "categories" ||
        lower === "stop" ||
        lower === "exit"
      ) {
        // Create supabase client
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        
        // Clear AI state if user types menu/exit keywords
        if (lower === "menu" || lower === "home" || lower === "stop" || lower === "exit") {
          const profile = await ensureProfile(supabase, userPhone);
          
          // Use clearState to properly clear from chat_state table
          await clearState(supabase, profile.user_id);
          
          await logStructuredEvent("BUY_SELL_AI_STATE_CLEARED", {
            userId: profile.user_id,
            triggeredBy: "keyword",
            keyword: lower,
          });
          
          // Track AI exit metric
          await recordMetric("buy_sell.ai_session_exit", 1, {
            reason: "user_keyword",
            keyword: lower,
          });
        }
        
        const userCountry = mapCountry(getCountryCode(userPhone));
        await showBuySellCategories(userPhone, userCountry);
        
        const duration = Date.now() - startTime;
        recordMetric("buy_sell.message.processed", 1, {
          duration_ms: duration,
        });
        
        return respond({ success: true, message: "categories_shown" });
      }

      // Check if user is in AI chat mode (business_broker_chat state)
      // ONLY forward TEXT messages, NOT buttons/locations/media
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      // Use proper state management functions instead of direct table queries
      const profile = await ensureProfile(supabase, userPhone);
      
      // Get state using getState function (reads from chat_state table)
      const stateData = await getState(supabase, profile.user_id);
      
      // If user is in AI chat mode, forward ONLY text messages
      if (stateData?.key === "business_broker_chat" && (stateData?.data as any)?.active) {
        // Check for session timeout (30 minutes)
        const started = new Date((stateData.data as any)?.started_at || new Date());
        const elapsed = Date.now() - started.getTime();
        const THIRTY_MINUTES = 30 * 60 * 1000;
        
        if (elapsed > THIRTY_MINUTES) {
          // Session expired - clear state and show categories
          await clearState(supabase, profile.user_id);
          
          await logStructuredEvent("BUY_SELL_AI_SESSION_EXPIRED", {
            userId: profile.user_id,
            elapsedMs: elapsed,
          });
          
          // Track AI timeout metric
          await recordMetric("buy_sell.ai_session_exit", 1, {
            reason: "timeout",
            duration_ms: elapsed,
          });
          
          await sendText(userPhone, "⏱️ Your AI session has expired. Showing categories...");
          const userCountry = mapCountry(getCountryCode(userPhone));
          await showBuySellCategories(userPhone, userCountry);
          return respond({ success: true, message: "session_expired" });
        }
        
        // Only forward TEXT messages to AI
        if (message.type === "text" && text.trim()) {
          const forwarded = await forwardToBuySellAgent(userPhone, text, message.id, correlationId);
          
          if (forwarded) {
            const duration = Date.now() - startTime;
            recordMetric("buy_sell.ai_forwarded", 1, { duration_ms: duration });
            return respond({ success: true, message: "forwarded_to_ai" });
          }
          
          // If forward failed, fall through to show categories
          await logStructuredEvent("BUY_SELL_AI_FORWARD_FAILED", {
            from: `***${userPhone.slice(-4)}`,
            correlationId,
          }, "warn");
        } else {
          // User sent button/location/media while in AI mode
          // Don't forward to AI, show helpful message
          await logStructuredEvent("BUY_SELL_NON_TEXT_IN_AI_MODE", {
            userId: profile.user_id,
            messageType: message.type,
            buttonId: message.type === "interactive" ? message.interactive?.button_reply?.id : undefined,
          }, "warn");
          
          // Track user frustration metric
          await recordMetric("buy_sell.button_tap_in_ai_mode", 1, {
            messageType: message.type,
            sessionDuration: elapsed,
          });
          
          await sendText(userPhone, "⚠️ I can only understand text messages in AI mode.\n\nType 'menu' to return to categories.");
          return respond({ success: true, message: "non_text_in_ai_mode" });
        }
      }

      // Fallback: Show categories (category workflow by default)
      const userCountry = mapCountry(getCountryCode(userPhone));
      await showBuySellCategories(userPhone, userCountry);

      const duration = Date.now() - startTime;
      recordMetric("buy_sell.message.processed", 1, {
        duration_ms: duration,
      });

      return respond({ success: true });
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Properly serialize error for logging
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logStructuredEvent(
        "BUY_SELL_ERROR",
        {
          error: errorMessage,
          stack: errorStack,
          durationMs: duration,
          requestId,
          correlationId,
        },
        "error",
      );

      recordMetric("buy_sell.message.error", 1);

      return respond({ error: errorMessage }, { status: 500 });
  }
});

function isBuySellAIEnabled(): boolean {
  return (Deno.env.get("BUY_SELL_AI_ENABLED") ?? "true").toLowerCase() !== "false";
}

async function forwardToBuySellAgent(
  userPhone: string,
  text: string,
  messageId: string,
  correlationId: string,
): Promise<boolean> {
  try {
    // Create idempotency key from user phone and message ID
    const idempotencyKey = `buy_sell:${userPhone}:${messageId}`;
    
    // Check if this message was already processed
    const { data: existingRequest } = await supabase
      .from('agent_requests')
      .select('response')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    
    if (existingRequest) {
      await logStructuredEvent("AI_AGENT_IDEMPOTENT_HIT", {
        correlationId,
        phone: userPhone.slice(-4),
        idempotencyKey,
        cachedResponse: true
      });
      
      await recordMetric("buy_sell.ai_idempotent_hit", 1);
      
      // Already processed, skip
      return true;
    }
    
    const baseUrl = Deno.env.get("SUPABASE_URL");
    if (!baseUrl) return false;

    const apiKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Correlation-ID": correlationId,
      "X-WA-Internal-Forward": "true",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
      headers.apikey = apiKey;
    }

    const res = await fetch(`${baseUrl}/functions/v1/agent-buy-sell`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        userPhone,
        message: text,
        idempotencyKey,
        correlationId,
      }),
    });

    if (!res.ok) {
      await logStructuredEvent(
        "BUY_SELL_AGENT_FORWARD_FAILED",
        { status: res.status, correlationId },
        "warn",
      );
      return false;
    }

    const data = await res.json();
    
    // Cache the response for idempotency (before sending to user)
    try {
      await supabase
        .from('agent_requests')
        .insert({
          idempotency_key: idempotencyKey,
          agent_slug: 'buy_sell',
          request_payload: { userPhone, message: text },
          response: data,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
      
      await logStructuredEvent("AI_AGENT_RESPONSE_CACHED", {
        correlationId,
        idempotencyKey
      });
    } catch (cacheError) {
      // Log but don't fail - caching is best-effort
      await logStructuredEvent("AI_AGENT_CACHE_FAILED", {
        correlationId,
        error: cacheError instanceof Error ? cacheError.message : String(cacheError)
      }, "warn");
    }
    
    // Agent returns { response_text: "..." } or { message: "..." }
    const responseText = data?.response_text || data?.message;
    if (responseText) {
      await sendText(userPhone, responseText);
      return true;
    }
    return false;
  } catch (err) {
    await logStructuredEvent(
      "BUY_SELL_AI_FORWARD_ERROR",
      { error: err instanceof Error ? err.message : String(err), correlationId },
      "error",
    );
    return false;
  }
}

function mapCountry(countryCode: string | null): string {
  switch (countryCode) {
    case "250":
      return "RW";
    case "356":
      return "MT";
    default:
      return "RW";
  }
}
