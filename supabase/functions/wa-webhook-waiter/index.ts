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
      });

      // TODO: Implement full waiter AI agent logic
      // 1. Parse incoming WhatsApp message
      // 2. Get/create conversation session
      // 3. Process message with AI
      // 4. Handle menu browsing, cart management
      // 5. Process checkout and payments
      // 6. Notify bar owner

      await logStructuredEvent("WAITER_MESSAGE_PROCESSED", {
        requestId,
        status: "placeholder",
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
