import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Cleanup Mobility Intents Cron Job
 * 
 * Runs daily to remove expired intent records older than 7 days.
 * This prevents database bloat while keeping recent history for analytics.
 * 
 * Schedule: Daily at 2:00 AM UTC (via Supabase cron)
 * Retention: 7 days
 */

interface CleanupResult {
  success: boolean;
  deleted_count: number;
  error?: string;
  timestamp: string;
  retention_days: number;
}

serve(async (req) => {
  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Configuration
    const RETENTION_DAYS = 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    console.log(`Starting cleanup of mobility_intents older than ${RETENTION_DAYS} days`);
    console.log(`Cutoff date: ${cutoffDate.toISOString()}`);

    // Delete expired intents older than retention period
    const { data, error } = await supabase
      .from("mobility_intents")
      .delete()
      .lt("expires_at", cutoffDate.toISOString())
      .select("id");

    if (error) {
      throw error;
    }

    const deletedCount = data?.length || 0;
    
    console.log(`✅ Cleanup complete: Deleted ${deletedCount} old intent records`);

    // Log to structured events for monitoring
    await supabase.from("system_events").insert({
      event_type: "INTENT_CLEANUP_COMPLETED",
      metadata: {
        deleted_count: deletedCount,
        retention_days: RETENTION_DAYS,
        cutoff_date: cutoffDate.toISOString(),
      },
    }).catch(() => {
      // Ignore if system_events table doesn't exist
      console.log("Note: system_events table not available for logging");
    });

    const result: CleanupResult = {
      success: true,
      deleted_count: deletedCount,
      timestamp: new Date().toISOString(),
      retention_days: RETENTION_DAYS,
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("❌ Cleanup failed:", error);

    const result: CleanupResult = {
      success: false,
      deleted_count: 0,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      retention_days: 7,
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
