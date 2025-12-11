/**
 * WhatsApp Buy & Sell Directory - Structured Flow (Simplified)
 *
 * SINGLE RESPONSIBILITY: Category browsing → Location → Nearby businesses
 * 
 * Scope:
 * - Show categories from buy_sell_categories table
 * - Handle category selection
 * - Request and process location sharing
 * - Search nearby businesses (search_businesses_nearby RPC)
 * - Pagination controls (Show More)
 * - WhatsApp deep links (wa.me/{phone})
 * 
 * NOT IN SCOPE (Moved to agent-buy-sell):
 * - AI chat / natural language queries
 * - Agent forwarding
 * - Session timeout management
 * - Marketplace payments
 * - Listings management
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
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
import { getCountryCode } from "../_shared/phone-utils.ts";
import { clearState } from "../_shared/wa-webhook-shared/state/store.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

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
    headers.set("X-Service", "wa-webhook-buy-sell-directory");
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
        service: "wa-webhook-buy-sell-directory",
        scope: "category_browsing_only",
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
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ?? Deno.env.get("WA_APP_SECRET");
    const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";
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
        isValidSignature = await verifyWebhookSignature(rawBody, signature, appSecret);
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
          reason: internalForward ? "internal_forward" : signature ? "signature_mismatch" : "no_signature",
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
    const messageId = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
    if (messageId) {
      const claimed = await claimEvent(messageId);
      if (!claimed) {
        await logStructuredEvent("BUY_SELL_DIR_DUPLICATE_BLOCKED", {
          message_id: messageId,
          from: `***${userPhone.slice(-4)}`,
          correlationId,
        });
        return respond({ success: true, message: "duplicate_blocked" });
      }
    }

    logStructuredEvent("BUY_SELL_DIR_MESSAGE_RECEIVED", {
      from: userPhone,
      type: message.type,
      hasLocation: !!message.location,
      requestId,
    });

    // === INTERACTIVE HANDLERS ===

    // Category selection (interactive list)
    if (message.type === "interactive" && message.interactive?.list_reply?.id) {
      const selectedId = message.interactive.list_reply.id;

      if (selectedId.startsWith("category_")) {
        await handleCategorySelection(userPhone, selectedId);
        return respond({ success: true, message: "category_selection_sent" });
      }
    }

    // Button replies (pagination + common actions)
    if (message.type === "interactive" && message.interactive?.button_reply?.id) {
      const buttonId = message.interactive.button_reply.id;

      // Handle Share easyMO button (auto-appended by reply.ts)
      if (buttonId === "share_easymo") {
        const { handleShareEasyMOButton } = await import("../_shared/wa-webhook-shared/utils/share-button-handler.ts");
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
          }, "wa-webhook-buy-sell-directory");
        }
        return respond({ success: true, message: "share_button_handled" });
      }

      // Pagination buttons
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

    // === LOCATION HANDLER ===

    // Location sharing (structured flow)
    if (message.type === "location" && message.location) {
      await handleLocationShared(
        userPhone,
        message.location.latitude,
        message.location.longitude,
      );
      return respond({ success: true, message: "location_processed" });
    }

    // === TEXT HANDLERS ===

    // Home/menu commands → show categories
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
      const userCountry = mapCountry(getCountryCode(userPhone));
      await showBuySellCategories(userPhone, userCountry);
      
      const duration = Date.now() - startTime;
      recordMetric("buy_sell_directory.message.processed", 1, {
        duration_ms: duration,
      });
      
      return respond({ success: true, message: "categories_shown" });
    }

    // Fallback: Show categories (default action for any unrecognized text)
    const userCountry = mapCountry(getCountryCode(userPhone));
    await showBuySellCategories(userPhone, userCountry);

    const duration = Date.now() - startTime;
    recordMetric("buy_sell_directory.message.processed", 1, {
      duration_ms: duration,
    });

    return respond({ success: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Properly serialize error for logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logStructuredEvent(
      "BUY_SELL_DIR_ERROR",
      {
        error: errorMessage,
        stack: errorStack,
        durationMs: duration,
        requestId,
        correlationId,
      },
      "error",
    );

    recordMetric("buy_sell_directory.message.error", 1);

    return respond({ error: errorMessage }, { status: 500 });
  }
});

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
