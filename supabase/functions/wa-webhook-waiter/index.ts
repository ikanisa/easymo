/**
 * Waiter AI Agent Webhook Handler
 * 
 * Handles visitor interactions at bars/restaurants:
 * - Conversational ordering with Gemini AI
 * - Menu browsing
 * - Payment processing (MOMO USSD / Revolut)
 * - Order confirmation and tracking
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleWaiterMessage } from "./agent.ts";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    if (req.method === "GET") {
      // Webhook verification
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const body = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return new Response("No message", { status: 200 });
    }

    const from = message.from;
    const messageType = message.type;
    const messageId = message.id;

    await logStructuredEvent("WAITER_MESSAGE_RECEIVED", {
      requestId,
      from,
      messageType,
      messageId,
    });

    const ctx = {
      supabase,
      from,
      message,
      messageType,
      requestId,
      locale: "en",
    };

    await handleWaiterMessage(ctx);

    recordMetric("waiter.message.processed", 1, {
      duration_ms: Date.now() - startTime,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("waiter_webhook.error", error);
    
    await logStructuredEvent("WAITER_WEBHOOK_ERROR", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { logStructuredEvent } from "../_shared/observability.ts";

const SERVICE_NAME = "wa-webhook-waiter";
const SERVICE_VERSION = "1.0.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

/**
 * Waiter AI Webhook Handler
 * Handles visitor (customer) messages for restaurant/bar ordering
 * 
 * Flow:
 * 1. Visitor scans QR code at bar/restaurant table
 * 2. Opens WhatsApp chat with waiter bot
 * 3. AI agent helps them browse menu and place order
 * 4. Generates payment link (MOMO USSD or Revolut)
 * 5. Notifies bar owner of new order
 */
serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Service", SERVICE_NAME);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Health check
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    try {
      const { error } = await supabase.from("bars").select("id").limit(1);
      return respond({
        status: error ? "unhealthy" : "healthy",
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        timestamp: new Date().toISOString(),
      }, { status: error ? 503 : 200 });
    } catch (err) {
      return respond({
        status: "unhealthy",
        error: err instanceof Error ? err.message : String(err),
      }, { status: 503 });
    }
  }

  // Webhook verification (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return respond({ error: "forbidden" }, { status: 403 });
  }

  // Main webhook handler (POST)
  if (req.method === "POST") {
    try {
      const payload = await req.json();
      
      await logStructuredEvent("WAITER_WEBHOOK_RECEIVED", {
        requestId,
        from: payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from,
        status: "stub_handler",
      });

      // CRITICAL: This is a STUB implementation
      // The webhook accepts traffic but does NOT process it
      // Production implementation requires:
      // 1. Parse incoming WhatsApp message from payload
      // 2. Get/create conversation session from waiter_conversations table
      // 3. Process message with AI (OpenAI/Gemini)
      // 4. Handle menu browsing, cart management, checkout
      // 5. Generate payment links (MoMo/Revolut)
      // 6. Send responses via WhatsApp Cloud API
      // 7. Notify bar owner of new orders
      // WITHOUT these implementations, this webhook will silently fail in production

      await logStructuredEvent("WAITER_MESSAGE_STUB_WARNING", {
        requestId,
        warning: "Message received but not processed - stub implementation only",
        from: payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from,
      });

      return respond({ success: true }, { status: 200 });
    } catch (err) {
      console.error("waiter_webhook.error", err);
      await logStructuredEvent("WAITER_WEBHOOK_ERROR", {
        requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return respond({ error: "internal_server_error" }, { status: 500 });
    }
  }

  return respond({ error: "method_not_allowed" }, { status: 405 });
});
