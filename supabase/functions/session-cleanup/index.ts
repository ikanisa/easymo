import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/wa-webhook-shared/config.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

serve(async (req: Request): Promise<Response> => {
  const correlationId = crypto.randomUUID();
  const startTime = performance.now();
  
  try {
    await logStructuredEvent("SESSION_CLEANUP_STARTED", { correlationId }, "info");
    
    // Delete sessions older than 24 hours (configurable via env)
    const ttlHours = parseInt(Deno.env.get("SESSION_TTL_HOURS") || "24", 10);
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - ttlHours);
    
    // Delete stale sessions
    const { data: deletedSessions, error } = await supabase
      .from("user_sessions")
      .delete()
      .lt("last_interaction", cutoffTime.toISOString())
      .select("id, phone_number, last_interaction");
    
    if (error) {
      throw new Error(`Failed to delete sessions: ${error.message}`);
    }
    
    const deletedCount = deletedSessions?.length || 0;
    const duration = performance.now() - startTime;
    
    await logStructuredEvent("SESSION_CLEANUP_COMPLETED", {
      correlationId,
      deletedCount,
      ttlHours,
      cutoffTime: cutoffTime.toISOString(),
      durationMs: Math.round(duration)
    }, "info");
    
    // Also cleanup very old DLQ messages that are processed (keep for 7 days)
    const dlqCutoff = new Date();
    dlqCutoff.setDate(dlqCutoff.getDate() - 7);
    
    const { data: deletedDlq, error: dlqError } = await supabase
      .from("wa_dead_letter_queue")
      .delete()
      .eq("processed", true)
      .lt("processed_at", dlqCutoff.toISOString())
      .select("id");
    
    const deletedDlqCount = deletedDlq?.length || 0;
    
    if (deletedDlqCount > 0) {
      await logStructuredEvent("DLQ_CLEANUP_COMPLETED", {
        correlationId,
        deletedCount: deletedDlqCount,
        retentionDays: 7
      }, "info");
    }
    
    return new Response(JSON.stringify({
      success: true,
      sessions: {
        deleted: deletedCount,
        ttlHours,
        cutoffTime: cutoffTime.toISOString()
      },
      dlq: {
        deleted: deletedDlqCount,
        retentionDays: 7
      },
      durationMs: Math.round(duration)
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logStructuredEvent("SESSION_CLEANUP_ERROR", {
      correlationId,
      error: errorMessage
    }, "error");
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
