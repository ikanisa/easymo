import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { config } from "@easymo/wa-webhook-shared";
import { logStructuredEvent, createHealthCheckResponse, performHealthCheck } from "@easymo/wa-webhook-observability";

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  await logStructuredEvent("JOBS_WEBHOOK_REQUEST", {
    correlationId,
    method: req.method,
    path: url.pathname,
  });

  // Health check
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    const result = await performHealthCheck("wa-webhook-jobs", supabase, {
      "jobs_table": async () => {
        const { error } = await supabase.from("job_listings").select("id").limit(1);
        return !error;
      }
    });
    return createHealthCheckResponse(result);
  }

  // Webhook verification (GET request from WhatsApp)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === config.waVerifyToken) {
      await logStructuredEvent("JOBS_WEBHOOK_VERIFIED", { correlationId });
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  // Main webhook handler (POST request from WhatsApp)
  try {
    const payload = await req.json();
    
    await logStructuredEvent("JOBS_WEBHOOK_RECEIVED", {
      correlationId,
      entryCount: payload.entry?.length || 0,
    });

    // Process messages
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const messages = change.value?.messages || [];
        
        for (const message of messages) {
          await logStructuredEvent("JOBS_MESSAGE_PROCESSING", {
            correlationId,
            messageId: message.id,
            from: message.from,
            type: message.type,
          });

          // For now, just acknowledge. Full handler will be added later.
          console.log("Jobs message received:", {
            id: message.id,
            from: message.from,
            type: message.type,
          });
        }
      }
    }

    // Return 200 to WhatsApp
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logStructuredEvent("JOBS_WEBHOOK_ERROR", {
      correlationId,
      error: errorMessage,
    });
    
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

console.log("✅ wa-webhook-jobs service started");
