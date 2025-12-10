/**
 * Cleanup Expired Records
 * Removes expired nonces and idempotency keys
 * Should be scheduled to run hourly via pg_cron or external scheduler
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify admin token
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("EASYMO_ADMIN_TOKEN");
  if (!apiKey || apiKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date().toISOString();

  // Cleanup expired nonces
  const { count: noncesDeleted } = await supabase
    .from("webhook_nonces")
    .delete()
    .lt("expires_at", now)
    .select("*", { count: "exact", head: true });

  // Cleanup expired idempotency keys
  const { count: keysDeleted } = await supabase
    .from("idempotency_keys")
    .delete()
    .lt("expires_at", now)
    .select("*", { count: "exact", head: true });

  // Cleanup old security audit logs (older than 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { count: auditLogsDeleted } = await supabase
    .from("security_audit_log")
    .delete()
    .lt("created_at", ninetyDaysAgo)
    .select("*", { count: "exact", head: true });

  // Aggregate hourly webhook stats
  await supabase.rpc("aggregate_webhook_stats_hourly");

  return new Response(
    JSON.stringify({
      success: true,
      cleaned: {
        nonces: noncesDeleted || 0,
        idempotency_keys: keysDeleted || 0,
        audit_logs: auditLogsDeleted || 0,
      },
      timestamp: now,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
