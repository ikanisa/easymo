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
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
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

        if (selectedId === "chat_with_ai" || selectedId === "buy_sell_chat_ai") {
          const aiHandled = await forwardToBuySellAgent(userPhone, text || "Start Buy & Sell chat", correlationId);
          return respond({ success: aiHandled, message: aiHandled ? "ai_routed" : "ai_forward_failed" }, aiHandled ? undefined : { status: 502 });
        }
      }

      // Button replies (pagination)
      if (message.type === "interactive" && message.interactive?.button_reply?.id) {
        const buttonId = message.interactive.button_reply.id;

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

      // Home/menu commands -> show AI welcome (natural language chat)
      const lower = text.toLowerCase();
      if (
        !text ||
        lower === "menu" ||
        lower === "home" ||
        lower === "buy" ||
        lower === "sell"
      ) {
        const userCountry = mapCountry(getCountryCode(userPhone));
        await showAIWelcome(userPhone, userCountry);
        
        const duration = Date.now() - startTime;
        recordMetric("buy_sell.message.processed", 1, {
          duration_ms: duration,
        });
        
        return respond({ success: true, message: "ai_welcome_shown" });
      }

      // Fallback: unknown message - try AI agent first
      if (isBuySellAIEnabled()) {
        const handled = await forwardToBuySellAgent(userPhone, text, correlationId);
        if (handled) {
          const duration = Date.now() - startTime;
          recordMetric("buy_sell.message.processed", 1, { duration_ms: duration, ai_routed: true });
          return respond({ success: true, message: "ai_routed" });
        }
      }

      // If AI unavailable, show AI welcome
      const userCountry = mapCountry(getCountryCode(userPhone));
      await showAIWelcome(userPhone, userCountry);

      const duration = Date.now() - startTime;
      recordMetric("buy_sell.message.processed", 1, {
        duration_ms: duration,
      });

      return respond({ success: true });
    } catch (error) {
      const duration = Date.now() - startTime;
      logStructuredEvent(
        "BUY_SELL_ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          durationMs: duration,
          requestId,
          correlationId,
        },
        "error",
      );

      recordMetric("buy_sell.message.error", 1);

      return respond({ error: String(error) }, { status: 500 });
  }
});

function isBuySellAIEnabled(): boolean {
  return (Deno.env.get("BUY_SELL_AI_ENABLED") ?? "true").toLowerCase() !== "false";
}

async function forwardToBuySellAgent(
  userPhone: string,
  text: string,
  correlationId: string,
): Promise<boolean> {
  try {
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
    if (data?.message) {
      await sendText(userPhone, data.message);
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
