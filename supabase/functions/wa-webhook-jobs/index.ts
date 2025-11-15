// wa-webhook-jobs - Standalone version for initial deployment
// This version works without shared packages - for testing purposes

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  console.log(JSON.stringify({
    event: "JOBS_WEBHOOK_REQUEST",
    correlationId,
    method: req.method,
    path: url.pathname,
    timestamp: new Date().toISOString(),
  }));

  // Health check
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    try {
      const { error } = await supabase.from("job_listings").select("id").limit(1);
      
      const response = {
        status: error ? "unhealthy" : "healthy",
        service: "wa-webhook-jobs",
        timestamp: new Date().toISOString(),
        checks: {
          database: error ? "disconnected" : "connected",
        },
        version: "1.0.0",
        ...(error && { error: error.message }),
      };

      return new Response(JSON.stringify(response, null, 2), {
        status: error ? 503 : 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          status: "unhealthy",
          service: "wa-webhook-jobs",
          error: err instanceof Error ? err.message : String(err),
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Webhook verification (GET request from WhatsApp)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      console.log(JSON.stringify({
        event: "JOBS_WEBHOOK_VERIFIED",
        correlationId,
      }));
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  // Main webhook handler (POST request from WhatsApp)
  try {
    const payload = await req.json();
    
    console.log(JSON.stringify({
      event: "JOBS_WEBHOOK_RECEIVED",
      correlationId,
      entryCount: payload.entry?.length || 0,
    }));

    // Process messages
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const messages = change.value?.messages || [];
        
        for (const message of messages) {
          console.log(JSON.stringify({
            event: "JOBS_MESSAGE_PROCESSING",
            correlationId,
            messageId: message.id,
            from: message.from,
            type: message.type,
          }));

          // For initial deployment, just log and acknowledge
          // Full handler will be added after testing infrastructure
          console.log("✅ Jobs message received:", {
            id: message.id,
            from: message.from,
            type: message.type,
            text: message.text?.body || "(no text)",
          });
        }
      }
    }

    // Return 200 to WhatsApp
    return new Response(JSON.stringify({ success: true, service: "wa-webhook-jobs" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Correlation-ID": correlationId },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      event: "JOBS_WEBHOOK_ERROR",
      correlationId,
      error: errorMessage,
    }));
    
    return new Response(
      JSON.stringify({ error: "internal_error", service: "wa-webhook-jobs" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

console.log("✅ wa-webhook-jobs service started (standalone version)");
console.log("📋 Service: wa-webhook-jobs");
console.log("🔗 Endpoints:");
console.log("   GET  /health - Health check");
console.log("   GET  / - Webhook verification");
console.log("   POST / - WhatsApp messages");
