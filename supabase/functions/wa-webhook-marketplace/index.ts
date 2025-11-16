import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();

  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    return new Response(JSON.stringify({
      status: "healthy",
      service: "wa-webhook-marketplace",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
    }), { headers: { "Content-Type": "application/json" } });
  }

  try {
    const payload = await req.json();
    await logMarketplaceIntent(payload, correlationId);
    return new Response(JSON.stringify({ success: true, service: "wa-webhook-marketplace" }), {
      headers: { "Content-Type": "application/json", "X-Correlation-ID": correlationId },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "MARKETPLACE_HANDLER_ERROR",
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    }));
    return new Response(JSON.stringify({ error: "internal_error", service: "wa-webhook-marketplace" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "X-Correlation-ID": correlationId },
    });
  }
});

async function logMarketplaceIntent(payload: unknown, correlationId: string) {
  await supabase.from("wa_marketplace_events").insert({
    correlation_id: correlationId,
    payload,
    received_at: new Date().toISOString(),
  }).catch((error) => {
    console.warn(JSON.stringify({
      event: "MARKETPLACE_LOGGING_FAILED",
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    }));
  });
}
