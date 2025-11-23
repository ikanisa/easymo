/**
 * Webhook Processing Utilities
 * 
 * Provides core utilities for WhatsApp webhook processing:
 * - Signature verification
 * - Payload validation
 * - Webhook queue management
 * - Rate limiting
 * - Circuit breaker pattern
 * - Logging and metrics
 * 
 * @see docs/GROUND_RULES.md for error handling requirements
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, logError, recordMetric } from "./observability.ts";
import { 
  WebhookError, 
  ValidationError, 
  SignatureError, 
  RateLimitError,
  CircuitBreakerOpenError,
  TimeoutError
} from "./errors.ts";
import { createHmac } from "https://deno.land/std@0.224.0/crypto/mod.ts";

export const WEBHOOK_TIMEOUT_MS = 10000; // 10 seconds
export const MAX_RETRIES = 3;
export const LOCK_TIMEOUT_MS = 120000; // 2 minutes

/**
 * Verify webhook signature using HMAC-SHA256
 */
export function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  try {
    const key = new TextEncoder().encode(secret);
    const message = new TextEncoder().encode(body);
    
    const hmac = createHmac("sha256", key);
    hmac.update(message);
    const expectedSignature = "sha256=" + Array.from(hmac.digest())
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    return signature === expectedSignature;
  } catch (error) {
    logError("signature_verification", error, { signatureProvided: !!signature });
    return false;
  }
}

/**
 * Validate webhook payload structure
 */
export function validateWebhookPayload(payload: any): any {
  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Invalid payload structure");
  }

  if (!Array.isArray(payload.entry)) {
    throw new ValidationError("Missing entry array", "entry");
  }

  if (payload.entry.length === 0) {
    throw new ValidationError("Empty entry array", "entry");
  }

  return payload;
}

/**
 * Logger class with context support
 */
export class Logger {
  private context: Record<string, any> = {};
  private config: {
    service: string;
    environment: string;
  };

  constructor(config: { service: string; environment: string }) {
    this.config = config;
  }

  setContext(context: Record<string, any>) {
    this.context = { ...this.context, ...context };
  }

  private log(level: string, message: string, data?: Record<string, any>) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.config.service,
      environment: this.config.environment,
      message,
      ...this.context,
      ...data,
    };

    console.log(JSON.stringify(logEntry));

    // Also use structured event logging
    if (level === "error") {
      logError(message, new Error(message), { ...this.context, ...data });
    } else {
      logStructuredEvent(message.toUpperCase().replace(/ /g, "_"), {
        ...this.context,
        ...data,
      }, level as any);
    }
  }

  info(message: string, data?: Record<string, any>) {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, any>) {
    this.log("warn", message, data);
  }

  error(message: string, data?: Record<string, any>) {
    this.log("error", message, data);
  }

  debug(message: string, data?: Record<string, any>) {
    this.log("debug", message, data);
  }
}

/**
 * Metrics class for recording metrics
 */
export class Metrics {
  constructor(private supabase: SupabaseClient) {}

  async record(
    name: string,
    value: number,
    tags: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.supabase.from("webhook_metrics").insert({
        metric_type: "counter",
        metric_name: name,
        metric_value: value,
        tags,
        timestamp: new Date().toISOString(),
      });

      // Also use recordMetric from observability
      await recordMetric(name, value, tags);
    } catch (error) {
      // Don't throw - metrics failures shouldn't break the flow
      console.error("Failed to record metric:", error);
    }
  }
}

/**
 * Rate limiter using token bucket algorithm
 */
export class RateLimiter {
  constructor(private supabase: SupabaseClient) {}

  async checkLimit(
    identifier: string,
    bucket: string,
    tokensRequested = 1
  ): Promise<any> {
    try {
      const { data, error } = await this.supabase.rpc("check_rate_limit", {
        p_identifier: identifier,
        p_bucket: bucket,
        p_tokens_requested: tokensRequested,
      });

      if (error) throw error;

      if (!data.allowed) {
        throw new RateLimitError(
          `Rate limit exceeded for ${identifier}`,
          data.blocked_until ? 
            Math.ceil((new Date(data.blocked_until).getTime() - Date.now()) / 1000) : 
            60
        );
      }

      return data;
    } catch (error) {
      if (error instanceof RateLimitError) throw error;
      
      // On error, allow the request to proceed (fail open)
      logError("rate_limit_check", error, { identifier, bucket });
      return { allowed: true, max_tokens: 100, tokens_remaining: 100 };
    }
  }
}

/**
 * Webhook processor for queuing webhooks
 */
export class WebhookProcessor {
  constructor(
    private supabase: SupabaseClient,
    private logger: Logger,
    private metrics: Metrics
  ) {}

  async queueWebhook(options: {
    payload: any;
    correlationId: string;
    priority?: number;
    source?: string;
  }): Promise<void> {
    const { payload, correlationId, priority = 5, source = "whatsapp" } = options;

    try {
      const { error } = await this.supabase.from("webhook_queue").insert({
        source,
        payload,
        priority,
        correlation_id: correlationId,
        status: "pending",
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      this.logger.info("Webhook queued", { correlationId, priority, source });
      await this.metrics.record("webhook.queued", 1, { priority, source });
    } catch (error) {
      this.logger.error("Failed to queue webhook", {
        error: error.message,
        correlationId,
      });
      throw new WebhookError("Failed to queue webhook", 500, "QUEUE_ERROR", true);
    }
  }
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(
    private config: {
      threshold: number;
      timeout: number;
      resetTimeout: number;
    }
  ) {}

  async fire<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailTime > this.config.resetTimeout) {
        this.state = "half-open";
        this.failures = 0;
      } else {
        throw new CircuitBreakerOpenError();
      }
    }

    try {
      const result = await fn();
      
      if (this.state === "half-open") {
        this.state = "closed";
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailTime = Date.now();

      if (this.failures >= this.config.threshold) {
        this.state = "open";
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailTime: this.lastFailTime,
    };
  }
}

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
