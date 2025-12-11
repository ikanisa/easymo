import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const diagnostics = {
    timestamp: new Date().toISOString(),
    openai_key: Deno.env.get("OPENAI_API_KEY") ? "SET" : "NOT SET",
    gemini_key: Deno.env.get("GEMINI_API_KEY") ? "SET" : "NOT SET",
  };

  return new Response(JSON.stringify(diagnostics, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
