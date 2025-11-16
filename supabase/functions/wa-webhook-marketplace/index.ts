import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    return new Response(JSON.stringify({ status: "healthy", service: "wa-webhook-marketplace", version: "1.0.0" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
});
