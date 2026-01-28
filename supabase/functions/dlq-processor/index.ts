import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getRetriableMessages } from "../_shared/dead-letter-queue.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { supabase } from "../_shared/wa-webhook-shared/config.ts";

serve(async (req: Request): Promise<Response> => {
  const correlationId = crypto.randomUUID();
  const startTime = performance.now();
  
  try {
    await logStructuredEvent("DLQ_PROCESSOR_STARTED", { correlationId }, "info");
    
    // Get messages ready for retry (max 3 retries, past next_retry_at)
    const messages = await getRetriableMessages(supabase, 50);
    
    if (messages.length === 0) {
      await logStructuredEvent("DLQ_PROCESSOR_NO_MESSAGES", { correlationId }, "debug");
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0,
        message: "No messages ready for retry"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    await logStructuredEvent("DLQ_PROCESSOR_FOUND_MESSAGES", { 
      correlationId, 
      count: messages.length 
    }, "info");
    
    let successCount = 0;
    let failureCount = 0;
    let abandonedCount = 0;
    
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    
    for (const msg of messages) {
      const msgCorrelationId = `${correlationId}-msg-${msg.id}`;
      
      try {
        // Mark as retrying
        await supabase
          .from("wa_dead_letter_queue")
          .update({ 
            retry_count: msg.retry_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq("id", msg.id);
        
        // Re-route the message to wa-webhook-core
        const response = await fetch(`${SUPABASE_URL}/functions/v1/wa-webhook-core`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            "X-Correlation-ID": msgCorrelationId,
            "X-DLQ-Retry": "true",
            "X-WA-Internal-Forward": "true"
          },
          body: JSON.stringify(msg.payload),
          signal: AbortSignal.timeout(10000) // 10s timeout
        });
        
        if (response.ok) {
          // Mark as processed
          await supabase
            .from("wa_dead_letter_queue")
            .update({ 
              processed: true,
              processed_at: new Date().toISOString()
            })
            .eq("id", msg.id);
          
          successCount++;
          await logStructuredEvent("DLQ_MESSAGE_PROCESSED", {
            correlationId: msgCorrelationId,
            messageId: msg.message_id,
            retryAttempt: msg.retry_count + 1
          }, "info");
        } else {
          throw new Error(`Retry failed with status ${response.status}`);
        }
      } catch (error) {
        failureCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check if we should abandon (>= 3 retries)
        if (msg.retry_count + 1 >= 3) {
          await supabase
            .from("wa_dead_letter_queue")
            .update({ 
              processed: false,
              error_message: `${msg.error_message} | Final retry failed: ${errorMessage}`,
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);
          
          abandonedCount++;
          await logStructuredEvent("DLQ_MESSAGE_ABANDONED", {
            correlationId: msgCorrelationId,
            messageId: msg.message_id,
            retries: msg.retry_count + 1,
            error: errorMessage
          }, "error");
        } else {
          // Calculate next retry with exponential backoff
          const nextRetry = new Date();
          const delayMinutes = Math.pow(2, msg.retry_count + 1); // 2, 4, 8 minutes
          nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes);
          
          await supabase
            .from("wa_dead_letter_queue")
            .update({ 
              next_retry_at: nextRetry.toISOString(),
              error_message: `${msg.error_message} | Retry ${msg.retry_count + 1} failed: ${errorMessage}`,
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);
          
          await logStructuredEvent("DLQ_MESSAGE_RETRY_SCHEDULED", {
            correlationId: msgCorrelationId,
            messageId: msg.message_id,
            retryAttempt: msg.retry_count + 1,
            nextRetry: nextRetry.toISOString(),
            error: errorMessage
          }, "warn");
        }
      }
    }
    
    const duration = performance.now() - startTime;
    
    await logStructuredEvent("DLQ_PROCESSOR_COMPLETED", {
      correlationId,
      total: messages.length,
      success: successCount,
      failures: failureCount,
      abandoned: abandonedCount,
      durationMs: Math.round(duration)
    }, "info");
    
    return new Response(JSON.stringify({
      success: true,
      processed: messages.length,
      successful: successCount,
      failed: failureCount,
      abandoned: abandonedCount,
      durationMs: Math.round(duration)
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logStructuredEvent("DLQ_PROCESSOR_ERROR", {
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
