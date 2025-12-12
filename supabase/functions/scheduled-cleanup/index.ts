// Scheduled Cleanup - Unified cleanup job handler
// Consolidates: cleanup-expired, cleanup-expired-intents, cleanup-mobility-intents, data-retention

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type JobType = "expired" | "expired-intents" | "mobility-intents" | "data-retention" | "expired-trips";

async function cleanupExpired() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
  
  const { data, error } = await supabase
    .from("temporary_data")
    .delete()
    .lt("expires_at", cutoff.toISOString());

  if (error) throw error;
  return { deleted: data?.length ?? 0, job: "expired" };
}

async function cleanupExpiredIntents() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
  
  const { data, error } = await supabase
    .from("payment_intents")
    .delete()
    .eq("status", "pending")
    .lt("created_at", cutoff.toISOString());

  if (error) throw error;
  return { deleted: data?.length ?? 0, job: "expired-intents" };
}

async function cleanupMobilityIntents() {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
  
  const { data, error } = await supabase
    .from("mobility_trip_requests")
    .delete()
    .eq("status", "pending")
    .lt("created_at", cutoff.toISOString());

  if (error) throw error;
  return { deleted: data?.length ?? 0, job: "mobility-intents" };
}

async function cleanupExpiredTrips() {
  // Call database function to mark expired trips
  const { data, error } = await supabase.rpc('cleanup_expired_trips');
  
  if (error) throw error;
  
  // data is array with single object: { expired_count, oldest_trip_age_minutes, cleanup_timestamp }
  const result = data?.[0] || { expired_count: 0, oldest_trip_age_minutes: 0 };
  
  return {
    expired: result.expired_count,
    oldestAgeMinutes: result.oldest_trip_age_minutes,
    job: "expired-trips",
  };
}

async function runDataRetention() {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
  
  // Delete old logs
  const { data: logs, error: logsError } = await supabase
    .from("system_logs")
    .delete()
    .lt("created_at", cutoff.toISOString());

  if (logsError) throw logsError;

  // Delete old analytics
  const { data: analytics, error: analyticsError } = await supabase
    .from("analytics_events")
    .delete()
    .lt("created_at", cutoff.toISOString());

  if (analyticsError) throw analyticsError;

  return {
    deleted: {
      logs: logs?.length ?? 0,
      analytics: analytics?.length ?? 0,
    },
    job: "data-retention",
  };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { jobType } = await req.json() as { jobType?: JobType };
    
    if (!jobType) {
      return new Response(
        JSON.stringify({ 
          error: "jobType required", 
          available: ["expired", "expired-intents", "mobility-intents", "data-retention", "expired-trips"] 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;
    
    switch (jobType) {
      case "expired":
        result = await cleanupExpired();
        break;
      case "expired-intents":
        result = await cleanupExpiredIntents();
        break;
      case "mobility-intents":
        result = await cleanupMobilityIntents();
        break;
      case "expired-trips":
        result = await cleanupExpiredTrips();
        break;
      case "data-retention":
        result = await runDataRetention();
        break;
      default:
        return new Response(
          JSON.stringify({ error: "invalid_job_type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: "cleanup_failed", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
