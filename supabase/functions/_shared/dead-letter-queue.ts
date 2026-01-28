/// <reference types="https://deno.land/x/types/index.d.ts" />

import { SupabaseClient } from "@supabase/supabase-js";

import { logStructuredEvent } from "./observability.ts";

export interface DLQMessage {
  message_id: string;
  from_number: string;
  payload: any;
  error_message: string;
  error_stack?: string;
  retry_count?: number;
}

/**
 * Add failed message to dead letter queue
 */
export async function addToDeadLetterQueue(
  supabase: SupabaseClient,
  message: DLQMessage,
  correlationId?: string
): Promise<void> {
  try {
    const nextRetry = new Date();
    const retryCount = message.retry_count || 0;
    
    // Exponential backoff: 1min, 2min, 4min, 8min...
    const delayMinutes = Math.pow(2, retryCount);
    nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes);

    const { error } = await supabase
      .from("webhook_dlq")
      .insert({
        phone_number: message.from_number,
        service: "wa-webhook-core",
        correlation_id: correlationId,
        payload: message.payload,
        error_message: message.error_message,
        error_type: "webhook_error",
        retry_count: retryCount,
        next_retry_at: nextRetry.toISOString(),
        status: "pending",
      });

    if (error) {
      await logStructuredEvent("DLQ_INSERT_ERROR", {
        correlationId,
        messageId: message.message_id,
        error: error.message,
      }, "error");
    } else {
      await logStructuredEvent("DLQ_MESSAGE_ADDED", {
        correlationId,
        messageId: message.message_id,
        retryCount,
        nextRetry: nextRetry.toISOString(),
      }, "info");
    }
  } catch (err) {
    // Last resort: console log if DLQ itself fails
    console.error("DLQ_CRITICAL_FAILURE", {
      correlationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Get messages ready for retry
 */
export async function getRetriableMessages(
  supabase: SupabaseClient,
  limit = 10
): Promise<any[]> {
  const { data, error } = await supabase
    .from("webhook_dlq")
    .select("*")
    .eq("status", "pending")
    .lt("retry_count", 3)
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(limit);

  if (error) {
    await logStructuredEvent("DLQ_FETCH_ERROR", { error: error.message }, "error");
    return [];
  }

  return data || [];
}

/**
 * Mark message as processed
 */
export async function markMessageProcessed(
  supabase: SupabaseClient,
  messageId: string,
  success: boolean
): Promise<void> {
  const update: any = {
    status: success ? "reprocessed" : "failed",
    reprocessed_at: success ? new Date().toISOString() : null,
    last_retry_at: new Date().toISOString(),
  };

  if (!success) {
    // Increment retry count
    const { data: current } = await supabase
      .from("webhook_dlq")
      .select("retry_count")
      .eq("id", messageId)
      .single();
    
    update.retry_count = (current?.retry_count ?? 0) + 1;
  }

  await supabase
    .from("webhook_dlq")
    .update(update)
    .eq("id", messageId);
}

/**
 * Circuit breaker state management
 */
const circuitState = new Map<string, { failures: number; openUntil: Date }>();

export async function isCircuitOpen(conversationId: string): Promise<boolean> {
  const state = circuitState.get(conversationId);
  
  if (!state) return false;
  
  if (new Date() > state.openUntil) {
    circuitState.delete(conversationId);
    return false;
  }
  
  return true;
}

export async function recordCircuitFailure(
  conversationId: string,
  threshold = 5,
  timeoutMs = 60000
): Promise<void> {
  const state = circuitState.get(conversationId) || { failures: 0, openUntil: new Date() };
  
  state.failures++;
  
  if (state.failures >= threshold) {
    state.openUntil = new Date(Date.now() + timeoutMs);
    await logStructuredEvent("CIRCUIT_BREAKER_OPENED", {
      conversationId,
      failures: state.failures,
      openUntil: state.openUntil.toISOString(),
    }, "warn");
  }
  
  circuitState.set(conversationId, state);
}

export function resetCircuit(conversationId: string): void {
  circuitState.delete(conversationId);
}
