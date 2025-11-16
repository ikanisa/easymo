import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    try {
      const { error } = await supabase.from("wallet_transactions").select("id").limit(1);
      return new Response(JSON.stringify({
        status: error ? "unhealthy" : "healthy",
        service: "wa-webhook-wallet",
        timestamp: new Date().toISOString(),
        checks: { database: error ? "disconnected" : "connected" },
        version: "1.0.0",
      }, null, 2), {
        status: error ? 503 : 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({
        status: "unhealthy",
        service: "wa-webhook-wallet",
        error: err instanceof Error ? err.message : String(err),
      }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
  }

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const payload = await req.json();
    return new Response(JSON.stringify({ success: true, service: "wa-webhook-wallet" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "internal_error" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

console.log("✅ wa-webhook-wallet service started");
