// wa-webhook-mobility - Standalone version
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
    event: "MOBILITY_WEBHOOK_REQUEST",
    correlationId,
    method: req.method,
    path: url.pathname,
    timestamp: new Date().toISOString(),
  }));

  // Health check
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    try {
      const { error } = await supabase.from("trips").select("id").limit(1);
      
      return new Response(JSON.stringify({
        status: error ? "unhealthy" : "healthy",
        service: "wa-webhook-mobility",
        timestamp: new Date().toISOString(),
        checks: { database: error ? "disconnected" : "connected" },
        version: "1.0.0",
        ...(error && { error: error.message }),
      }, null, 2), {
        status: error ? 503 : 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({
        status: "unhealthy",
        service: "wa-webhook-mobility",
        error: err instanceof Error ? err.message : String(err),
      }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
  }

  // Webhook verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // Main webhook handler
  try {
    const payload = await req.json();
    
    console.log(JSON.stringify({
      event: "MOBILITY_WEBHOOK_RECEIVED",
      correlationId,
      entryCount: payload.entry?.length || 0,
    }));

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const messages = change.value?.messages || [];
        
        for (const message of messages) {
          console.log("✅ Mobility message received:", {
            id: message.id,
            from: message.from,
            type: message.type,
          });
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      service: "wa-webhook-mobility" 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(JSON.stringify({
      event: "MOBILITY_WEBHOOK_ERROR",
      correlationId,
      error: err instanceof Error ? err.message : String(err),
    }));
    
    return new Response(JSON.stringify({ 
      error: "internal_error",
      service: "wa-webhook-mobility"
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

console.log("✅ wa-webhook-mobility service started");
