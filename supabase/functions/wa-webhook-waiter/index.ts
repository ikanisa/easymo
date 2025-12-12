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
import { createClient } from "https://esm.sh/@supabase/supabase-js";
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
});
