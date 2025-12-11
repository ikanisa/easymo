/**
 * WhatsApp Buy & Sell Directory Webhook Handler
 *
 * Scope:
 * - Presents Buy & Sell categories from `buy_sell_categories`
 * - Collects user location and lists nearby businesses via search_businesses_nearby
 * - Pagination and menu navigation only
 * - NO AI agent, NO marketplace AI, NO payments (those live in wa-webhook-buy-sell-agent)
 * 
 * State Keys:
 * - directory_category: User selected a category, waiting for location
 * - directory_results: User viewing results, pagination state
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { claimEvent } from "../_shared/wa-webhook-shared/state/idempotency.ts";
import { getCountryCode, mapCountryCode } from "../_shared/phone-utils.ts";
import {
  ensureProfile,
  getState,
  setState,
  clearState,
} from "../_shared/wa-webhook-shared/state/store.ts";
import { showDirectoryCategories, handleShowMoreCategories } from "./handlers/categories.ts";
import { handleCategorySelection, handleLocationShared } from "./handlers/location.ts";
import { handleShowMore, handleNewSearch } from "./handlers/pagination.ts";

// =====================================================
// CONFIGURATION
// =====================================================

const SERVICE_NAME = "wa-webhook-buy-sell-directory";

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
        service: SERVICE_NAME,
        description: "Structured category browsing and location-based business search",
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

    // Verify WhatsApp signature
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
      logStructuredEvent("DIRECTORY_AUTH_CONFIG_ERROR", {
        error: "WHATSAPP_APP_SECRET not configured",
        correlationId,
      }, "error");
      return respond({ error: "server_misconfigured" }, { status: 500 });
    }

    let isValidSignature = false;
    if (signature) {
      try {
        isValidSignature = await verifyWebhookSignature(rawBody, signature, appSecret);
      } catch (err) {
        logStructuredEvent("DIRECTORY_SIGNATURE_ERROR", {
          error: err instanceof Error ? err.message : String(err),
          correlationId,
        }, "error");
      }
    }

    if (!isValidSignature && !allowUnsigned && !internalForward) {
      logStructuredEvent("DIRECTORY_AUTH_FAILED", {
        signatureProvided: !!signature,
        correlationId,
      }, "warn");
      return respond({ error: "unauthorized" }, { status: 401 });
    }

    // Parse payload after verification
    const payload = JSON.parse(rawBody);
    const message = extractWhatsAppMessage(payload);

    if (!message?.from) {
      return respond({ success: true, ignored: "no_message" });
    }

    const text = message.body?.trim() ?? "";
    const userPhone = message.from;

    // Deduplicate messages using message_id
    const messageId = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
    if (messageId) {
      const claimed = await claimEvent(messageId);
      if (!claimed) {
        await logStructuredEvent("DIRECTORY_DUPLICATE_BLOCKED", {
          message_id: messageId,
          from: `***${userPhone.slice(-4)}`,
          correlationId,
        });
        return respond({ success: true, message: "duplicate_blocked" });
      }
    }

    logStructuredEvent("DIRECTORY_MESSAGE_RECEIVED", {
      from: `***${userPhone.slice(-4)}`,
      type: message.type,
      hasLocation: !!message.location,
      requestId,
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const userCountry = mapCountryCode(getCountryCode(userPhone));

    // === HANDLE INTERACTIVE LIST SELECTIONS ===
    if (message.type === "interactive" && message.interactive?.list_reply?.id) {
      const selectedId = message.interactive.list_reply.id;

      // Category selection
      if (selectedId.startsWith("category_")) {
        await handleCategorySelection(userPhone, selectedId);
        return respond({ success: true, message: "category_selection_sent" });
      }

      // Show more categories
      if (selectedId === "buy_sell_show_more_categories") {
        await handleShowMoreCategories(userPhone);
        return respond({ success: true, message: "show_more_categories_processed" });
      }
    }

    // === HANDLE BUTTON REPLIES ===
    if (message.type === "interactive" && message.interactive?.button_reply?.id) {
      const buttonId = message.interactive.button_reply.id;

      // Handle Share easyMO button
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
          }, SERVICE_NAME);
        }
        return respond({ success: true, message: "share_button_handled" });
      }

      // Back/Home/Exit buttons - clear state and show categories
      if (buttonId === "back_home" || buttonId === "back_menu") {
        const profile = await ensureProfile(supabase, userPhone);
        await clearState(supabase, profile.user_id);
        
        await logStructuredEvent("DIRECTORY_STATE_CLEARED", {
          userId: profile.user_id,
          triggeredBy: buttonId,
        });
        
        await showDirectoryCategories(userPhone, userCountry);
        return respond({ success: true, message: "returned_to_categories" });
      }

      // Pagination: Show more results
      if (buttonId === "buy_sell_show_more" || buttonId === "directory_show_more") {
        await handleShowMore(userPhone);
        return respond({ success: true, message: "show_more_processed" });
      }

      // Pagination: Show more categories
      if (buttonId === "buy_sell_show_more_categories" || buttonId === "directory_show_more_categories") {
        await handleShowMoreCategories(userPhone);
        return respond({ success: true, message: "show_more_categories_processed" });
      }

      // New search
      if (buttonId === "buy_sell_new_search" || buttonId === "directory_new_search") {
        await handleNewSearch(userPhone);
        return respond({ success: true, message: "new_search_requested" });
      }
    }

    // === HANDLE LOCATION SHARING ===
    if (message.type === "location" && message.location) {
      await handleLocationShared(
        userPhone,
        message.location.latitude,
        message.location.longitude,
      );
      return respond({ success: true, message: "location_processed" });
    }

    // === HANDLE TEXT MESSAGES ===
    const lower = text.toLowerCase();
    
    // Home/menu/exit commands -> show categories
    if (
      !text ||
      lower === "menu" ||
      lower === "home" ||
      lower === "buy" ||
      lower === "sell" ||
      lower === "categories" ||
      lower === "stop" ||
      lower === "exit" ||
      lower === "browse"
    ) {
      const profile = await ensureProfile(supabase, userPhone);
      await clearState(supabase, profile.user_id);
      
      await showDirectoryCategories(userPhone, userCountry);
      
      const duration = Date.now() - startTime;
      recordMetric("directory.message.processed", 1, {
        duration_ms: duration,
        action: "show_categories",
      });
      
      return respond({ success: true, message: "categories_shown" });
    }

    // Default: Show categories for any unrecognized text
    await showDirectoryCategories(userPhone, userCountry);

    const duration = Date.now() - startTime;
    recordMetric("directory.message.processed", 1, {
      duration_ms: duration,
    });

    return respond({ success: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logStructuredEvent(
      "DIRECTORY_ERROR",
      {
        error: errorMessage,
        stack: errorStack,
        durationMs: duration,
        requestId,
        correlationId,
      },
      "error",
    );

    recordMetric("directory.message.error", 1);

    return respond({ error: errorMessage }, { status: 500 });
  }
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function extractWhatsAppMessage(payload: unknown): {
  from: string;
  body: string;
  type: string;
  id?: string;
  location?: { latitude: number; longitude: number };
  interactive?: { 
    list_reply?: { id: string; title: string }; 
    button_reply?: { id: string; title: string } 
  };
} | null {
  try {
    const p = payload as Record<string, unknown>;
    
    // Standard WhatsApp webhook format
    if (p?.entry) {
      const entry = p.entry as Array<{ changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }> }>;
      const msg = entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (msg) {
        return {
          from: msg.from as string,
          body:
            (typeof (msg.text as Record<string, unknown>)?.body === 'string' ? (msg.text as Record<string, unknown>)?.body : null) ||
            ((msg.interactive as any)?.button_reply?.title as string) ||
            ((msg.interactive as any)?.list_reply?.title as string) ||
            "",
          type: msg.type as string,
          id: msg.id as string,
          location: msg.location as { latitude: number; longitude: number },
          interactive: msg.interactive as { list_reply?: { id: string; title: string }; button_reply?: { id: string; title: string } },
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}
