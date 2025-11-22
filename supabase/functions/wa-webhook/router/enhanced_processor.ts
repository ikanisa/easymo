/**
 * Enhanced Webhook Processor with Advanced Error Recovery
 * 
 * This module extends the existing wa-webhook processor with:
 * - Dead letter queue for failed messages
 * - Conversation-level distributed locking
 * - Timeout protection
 * - Enhanced error recovery
 * 
 * Can be enabled via WA_ENHANCED_PROCESSING environment variable.
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import type { SupabaseClient } from "../deps.ts";
import type { PreparedWebhook } from "./pipeline.ts";
import type { WhatsAppMessage } from "../types.ts";
import {
  WEBHOOK_TIMEOUT_MS,
  acquireConversationLock,
  addToDeadLetterQueue,
  checkIdempotency,
  getOrCreateConversation,
  processWithTimeout,
  recordProcessedMessage,
  releaseConversationLock,
} from "../../_shared/webhook-utils.ts";
import { logStructuredEvent, logError, recordMetric } from "../../_shared/observability.ts";

// Feature flag for enhanced processing
const ENHANCED_PROCESSING_ENABLED = 
  Deno.env.get("WA_ENHANCED_PROCESSING")?.toLowerCase() === "true";

/**
 * Enhanced webhook processing wrapper
 * Adds DLQ, locking, and timeout protection to existing processor
 */
export async function handlePreparedWebhookEnhanced(
  supabase: SupabaseClient,
  prepared: PreparedWebhook,
  originalHandler: (supabase: SupabaseClient, prepared: PreparedWebhook) => Promise<Response>
): Promise<Response> {
  // If enhanced processing is disabled, use original handler
  if (!ENHANCED_PROCESSING_ENABLED) {
    return originalHandler(supabase, prepared);
  }

  const { correlationId, messages } = prepared;
  const startTime = Date.now();

  try {
    logStructuredEvent("ENHANCED_WEBHOOK_START", {
      correlationId,
      messageCount: messages.length,
    });

    // Process with timeout protection
    const response = await processWithTimeout(
      async () => {
        // Process each message with enhanced error handling
        for (const msg of messages) {
          if (!msg?.id) continue;

          try {
            await processMessageEnhanced(supabase, msg, correlationId, originalHandler, prepared);
          } catch (error) {
            // Individual message error - add to DLQ but continue processing other messages
            logError("message_processing", error, {
              messageId: msg.id,
              correlationId,
            });

            await addToDeadLetterQueue(
              supabase,
              msg,
              error instanceof Error ? error : new Error(String(error)),
              msg.id,
              correlationId,
              0
            );

            recordMetric("webhook.message_processing_error", 1, {
              message_type: msg.type || "unknown",
            });
          }
        }

        // Return success response
        return new Response(JSON.stringify({ status: "processed" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Correlation-Id": correlationId,
          },
        });
      },
      WEBHOOK_TIMEOUT_MS,
      correlationId
    );

    const duration = Date.now() - startTime;
    
    logStructuredEvent("ENHANCED_WEBHOOK_COMPLETE", {
      correlationId,
      durationMs: duration,
    });

    recordMetric("webhook.enhanced_processing_success", 1, {
      duration_ms: duration,
    });

    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logError("enhanced_webhook_processing", error, {
      correlationId,
      durationMs: duration,
    });

    recordMetric("webhook.enhanced_processing_error", 1);

    // Add entire batch to DLQ on catastrophic failure
    await addToDeadLetterQueue(
      supabase,
      prepared.payload,
      error instanceof Error ? error : new Error(String(error)),
      null,
      correlationId,
      0
    );

    return new Response(JSON.stringify({
      status: "error",
      message: "Processing failed",
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-Id": correlationId,
      },
    });
  }
}

/**
 * Process individual message with enhanced features
 */
async function processMessageEnhanced(
  supabase: SupabaseClient,
  msg: WhatsAppMessage,
  correlationId: string,
  originalHandler: (supabase: SupabaseClient, prepared: PreparedWebhook) => Promise<Response>,
  prepared: PreparedWebhook
): Promise<void> {
  const startTime = Date.now();
  
  // 1. Check idempotency using new table (in addition to existing wa_events)
  const alreadyProcessed = await checkIdempotency(
    supabase,
    msg.id,
    correlationId
  );

  if (alreadyProcessed) {
    logStructuredEvent("ENHANCED_IDEMPOTENCY_HIT", {
      messageId: msg.id,
      correlationId,
    });
    return;
  }

  // 2. Get or create conversation
  const conversationId = await getOrCreateConversation(
    supabase,
    msg.from, // user_id
    msg.from, // whatsapp_phone
    null, // agent_type - will be determined by routing
    correlationId
  );

  // 3. Try to acquire conversation lock
  const lockId = crypto.randomUUID();
  const lockAcquired = await acquireConversationLock(
    supabase,
    conversationId,
    lockId,
    correlationId
  );

  if (!lockAcquired) {
    // Another process is handling this conversation
    // Queue for retry via DLQ with short delay
    logStructuredEvent("CONVERSATION_LOCKED", {
      conversationId,
      messageId: msg.id,
      correlationId,
    }, "warn");

    await addToDeadLetterQueue(
      supabase,
      msg,
      new Error("Conversation locked by another process"),
      msg.id,
      correlationId,
      0
    );

    return;
  }

  try {
    // 4. Process message using original handler
    // Create a prepared payload with just this message to avoid duplicate processing
    const singleMessagePrepared = {
      ...prepared,
      messages: [msg],
    };
    
    await originalHandler(supabase, singleMessagePrepared);
    
    const duration = Date.now() - startTime;
    
    // 5. Record successful processing
    await recordProcessedMessage(
      supabase,
      msg.id,
      conversationId,
      correlationId,
      duration,
      msg
    );

    logStructuredEvent("ENHANCED_MESSAGE_PROCESSED", {
      messageId: msg.id,
      conversationId,
      correlationId,
      durationMs: duration,
    });

  } finally {
    // 6. Always release the lock
    await releaseConversationLock(
      supabase,
      conversationId,
      lockId,
      correlationId
    );
  }
}

/**
 * Get feature flag status
 */
export function isEnhancedProcessingEnabled(): boolean {
  return ENHANCED_PROCESSING_ENABLED;
}
