// agent-buy-sell - Natural language Buy & Sell AI Agent
// Uses OpenAI Responses API with Gemini fallback plus DB-backed memory.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { MarketplaceAgent, type MarketplaceContext } from "../wa-webhook-buy-sell/agent.ts";

interface BuySellRequest {
  userPhone: string;
  message: string;
  locale?: string;
  location?: { lat: number; lng: number };
  reset?: boolean;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const agent = new MarketplaceAgent(supabase);

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wa-internal-forward, x-correlation-id",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "healthy",
        service: "agent-buy-sell",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body: BuySellRequest = await req.json();
    if (!body.userPhone || !body.message) {
      return new Response(
        JSON.stringify({ error: "missing_params", message: "userPhone and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.reset) {
      await MarketplaceAgent.resetContext(body.userPhone, supabase);
    }

    const context: MarketplaceContext = await MarketplaceAgent.loadContext(body.userPhone, supabase);
    if (body.location) {
      context.location = body.location;
    }

    const response = await agent.process(body.message, context);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("agent-buy-sell error:", error);
    return new Response(
      JSON.stringify({ error: "agent_error", message: "Could not process request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
