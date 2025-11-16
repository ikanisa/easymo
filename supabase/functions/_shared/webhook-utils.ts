/**
 * Webhook Processing Utilities
 * 
 * Provides core utilities for WhatsApp webhook processing:
 * - Idempotency checking
 * - Distributed locking
 * - Dead letter queue management
 * - Timeout handling
 * 
 * @see docs/GROUND_RULES.md for error handling requirements
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, logError, recordMetric } from "./observability.ts";

export const WEBHOOK_TIMEOUT_MS = 10000; // 10 seconds
export const MAX_RETRIES = 3;
export const LOCK_TIMEOUT_MS = 120000; // 2 minutes

/**
 * Check if a WhatsApp message has already been processed (idempotency)
 */
export async function checkIdempotency(
  supabase: SupabaseClient,
  whatsappMessageId: string,
  correlationId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('processed_webhook_messages')
      .select('id')
      .eq('whatsapp_message_id', whatsappMessageId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw error;
    }
    
    const alreadyProcessed = !!data;
    
    if (alreadyProcessed) {
      logStructuredEvent("WEBHOOK_DUPLICATE_DETECTED", {
        whatsappMessageId,
        correlationId,
      });
      
      recordMetric("webhook.duplicate_message", 1);
    }
    
    return alreadyProcessed;
    
  } catch (error) {
    logError("idempotency_check", error, {
      whatsappMessageId,
      correlationId,
    });
    
    // On error, assume not processed to avoid losing messages
    return false;
  }
}

/**
 * Record that a message has been processed
 */
export async function recordProcessedMessage(
  supabase: SupabaseClient,
  whatsappMessageId: string,
  conversationId: string | null,
  correlationId: string,
  processingTimeMs: number,
  payload?: unknown
): Promise<void> {
  try {
    const { error } = await supabase
      .from('processed_webhook_messages')
      .insert({
        whatsapp_message_id: whatsappMessageId,
        conversation_id: conversationId,
        correlation_id: correlationId,
        processing_time_ms: processingTimeMs,
        payload: payload || null,
        processed_at: new Date().toISOString(),
      });
    
    if (error) {
      throw error;
    }
    
    logStructuredEvent("WEBHOOK_MESSAGE_RECORDED", {
      whatsappMessageId,
      conversationId,
      correlationId,
      processingTimeMs,
    });
    
    recordMetric("webhook.message_recorded", 1, {
      processing_time_ms: processingTimeMs,
    });
    
  } catch (error) {
    logError("record_processed_message", error, {
      whatsappMessageId,
      correlationId,
    });
    
    // Don't throw - recording failure shouldn't break the flow
  }
}

/**
 * Acquire a distributed lock for conversation processing
 */
export async function acquireConversationLock(
  supabase: SupabaseClient,
  conversationId: string,
  lockId: string,
  correlationId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('acquire_conversation_lock', {
        p_conversation_id: conversationId,
        p_lock_id: lockId,
      });
    
    if (error) {
      throw error;
    }
    
    const lockAcquired = data === true;
    
    if (lockAcquired) {
      logStructuredEvent("CONVERSATION_LOCK_ACQUIRED", {
        conversationId,
        lockId,
        correlationId,
      });
      
      recordMetric("webhook.lock_acquired", 1);
    } else {
      logStructuredEvent("CONVERSATION_LOCK_FAILED", {
        conversationId,
        lockId,
        correlationId,
      }, "warn");
      
      recordMetric("webhook.lock_failed", 1);
    }
    
    return lockAcquired;
    
  } catch (error) {
    logError("acquire_lock", error, {
      conversationId,
      lockId,
      correlationId,
    });
    
    return false;
  }
}

/**
 * Release a distributed lock for conversation processing
 */
export async function releaseConversationLock(
  supabase: SupabaseClient,
  conversationId: string,
  lockId: string,
  correlationId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('release_conversation_lock', {
        p_conversation_id: conversationId,
        p_lock_id: lockId,
      });
    
    if (error) {
      throw error;
    }
    
    const lockReleased = data === true;
    
    if (lockReleased) {
      logStructuredEvent("CONVERSATION_LOCK_RELEASED", {
        conversationId,
        lockId,
        correlationId,
      });
      
      recordMetric("webhook.lock_released", 1);
    }
    
    return lockReleased;
    
  } catch (error) {
    logError("release_lock", error, {
      conversationId,
      lockId,
      correlationId,
    });
    
    return false;
  }
}

/**
 * Add failed message to dead letter queue
 */
export async function addToDeadLetterQueue(
  supabase: SupabaseClient,
  payload: unknown,
  error: Error,
  whatsappMessageId: string | null,
  correlationId: string,
  retryCount = 0
): Promise<void> {
  try {
    const nextRetryAt = retryCount < MAX_RETRIES
      ? new Date(Date.now() + Math.pow(2, retryCount) * 60000) // Exponential backoff: 1min, 2min, 4min
      : null;
    
    const { error: insertError } = await supabase
      .from('webhook_dlq')
      .insert({
        payload,
        error: error.message,
        error_stack: error.stack,
        correlation_id: correlationId,
        whatsapp_message_id: whatsappMessageId,
        retry_count: retryCount,
        max_retries: MAX_RETRIES,
        next_retry_at: nextRetryAt?.toISOString() || null,
        resolution_status: retryCount < MAX_RETRIES ? 'pending' : 'failed',
        created_at: new Date().toISOString(),
      });
    
    if (insertError) {
      throw insertError;
    }
    
    logStructuredEvent("WEBHOOK_ADDED_TO_DLQ", {
      whatsappMessageId,
      correlationId,
      retryCount,
      nextRetryAt: nextRetryAt?.toISOString(),
      errorMessage: error.message,
    }, "error");
    
    recordMetric("webhook.dlq_added", 1, {
      retry_count: retryCount,
      max_retries_reached: retryCount >= MAX_RETRIES ? 'true' : 'false',
    });
    
  } catch (dlqError) {
    logError("add_to_dlq", dlqError, {
      correlationId,
      originalError: error.message,
    });
    
    // Critical: If we can't add to DLQ, log prominently
    console.error(JSON.stringify({
      event: "CRITICAL_DLQ_FAILURE",
      correlationId,
      originalError: error.message,
      dlqError: dlqError instanceof Error ? dlqError.message : String(dlqError),
    }));
  }
}

/**
 * Process webhook with timeout protection
 */
export async function processWithTimeout<T>(
  processFn: () => Promise<T>,
  timeoutMs: number,
  correlationId: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Processing timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([
      processFn(),
      timeoutPromise,
    ]);
    
    return result;
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      logStructuredEvent("WEBHOOK_PROCESSING_TIMEOUT", {
        correlationId,
        timeoutMs,
      }, "error");
      
      recordMetric("webhook.processing_timeout", 1, {
        timeout_ms: timeoutMs,
      });
    }
    
    throw error;
  }
}

/**
 * Update conversation state with audit trail
 */
export async function updateConversationState(
  supabase: SupabaseClient,
  conversationId: string,
  newState: string,
  fromState: string | null,
  reason: string,
  correlationId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    // Update conversation state
    const { error: updateError } = await supabase
      .from('webhook_conversations')
      .update({
        status: newState,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);
    
    if (updateError) {
      throw updateError;
    }
    
    // Record state transition
    const { error: transitionError } = await supabase
      .from('conversation_state_transitions')
      .insert({
        conversation_id: conversationId,
        from_state: fromState,
        to_state: newState,
        transition_reason: reason,
        correlation_id: correlationId,
        metadata: metadata || {},
        created_at: new Date().toISOString(),
      });
    
    if (transitionError) {
      throw transitionError;
    }
    
    logStructuredEvent("CONVERSATION_STATE_UPDATED", {
      conversationId,
      fromState,
      toState: newState,
      reason,
      correlationId,
    });
    
    recordMetric("webhook.state_transition", 1, {
      from_state: fromState || 'unknown',
      to_state: newState,
    });
    
  } catch (error) {
    logError("update_conversation_state", error, {
      conversationId,
      newState,
      correlationId,
    });
    
    throw error;
  }
}

/**
 * Get or create webhook conversation
 */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  userId: string,
  whatsappPhone: string,
  agentType: string | null,
  correlationId: string
): Promise<string> {
  try {
    // Try to get existing active conversation
    const { data: existing, error: selectError } = await supabase
      .from('webhook_conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (existing) {
      return existing.id;
    }
    
    // Create new conversation
    const { data: newConv, error: insertError } = await supabase
      .from('webhook_conversations')
      .insert({
        user_id: userId,
        whatsapp_phone: whatsappPhone,
        agent_type: agentType,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    
    if (insertError) {
      throw insertError;
    }
    
    logStructuredEvent("WEBHOOK_CONVERSATION_CREATED", {
      conversationId: newConv.id,
      userId,
      agentType,
      correlationId,
    });
    
    recordMetric("webhook.conversation_created", 1, {
      agent_type: agentType || 'unknown',
    });
    
    return newConv.id;
    
  } catch (error) {
    logError("get_or_create_conversation", error, {
      userId,
      correlationId,
    });
    
    throw error;
  }
}
