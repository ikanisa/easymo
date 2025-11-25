/**
 * Webhook Processing Utilities
 * 
 * Provides core utilities for WhatsApp webhook processing:
 * - Signature verification (timing-safe)
 * - Payload validation (Zod schemas)
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
import { timingSafeEqual } from "https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const WEBHOOK_TIMEOUT_MS = 10000; // 10 seconds
export const MAX_RETRIES = 3;
export const LOCK_TIMEOUT_MS = 120000; // 2 minutes

// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================
const WhatsAppTextMessageSchema = z.object({
  body: z.string().max(4096)
});

const WhatsAppMediaMessageSchema = z.object({
  id: z.string(),
  mime_type: z.string(),
  sha256: z.string(),
  caption: z.string().optional()
});

const WhatsAppLocationMessageSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().optional(),
  address: z.string().optional()
});

const WhatsAppInteractiveMessageSchema = z.object({
  type: z.enum(["button_reply", "list_reply"]),
  button_reply: z.object({
    id: z.string(),
    title: z.string()
  }).optional(),
  list_reply: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional()
  }).optional()
});

const WhatsAppMessageSchema = z.object({
  from: z.string().regex(/^\d{10,15}$/),
  id: z.string(),
  timestamp: z.string(),
  type: z.enum(["text", "image", "document", "audio", "video", "location", "contacts", "interactive", "reaction", "sticker"]),
  text: WhatsAppTextMessageSchema.optional(),
  image: WhatsAppMediaMessageSchema.optional(),
  document: WhatsAppMediaMessageSchema.optional(),
  audio: WhatsAppMediaMessageSchema.optional(),
  video: WhatsAppMediaMessageSchema.optional(),
  location: WhatsAppLocationMessageSchema.optional(),
  interactive: WhatsAppInteractiveMessageSchema.optional(),
  context: z.object({
    from: z.string(),
    id: z.string()
  }).optional()
});

const WhatsAppStatusSchema = z.object({
  id: z.string(),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  timestamp: z.string(),
  recipient_id: z.string(),
  conversation: z.object({
    id: z.string(),
    origin: z.object({
      type: z.string()
    })
  }).optional(),
  pricing: z.object({
    billable: z.boolean(),
    pricing_model: z.string(),
    category: z.string()
  }).optional(),
  errors: z.array(z.object({
    code: z.number(),
    title: z.string(),
    message: z.string(),
    error_data: z.object({
      details: z.string()
    }).optional()
  })).optional()
});

export const WhatsAppWebhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      value: z.object({
        messaging_product: z.literal("whatsapp"),
        metadata: z.object({
          display_phone_number: z.string(),
          phone_number_id: z.string()
        }),
        contacts: z.array(z.object({
          profile: z.object({
            name: z.string()
          }),
          wa_id: z.string()
        })).optional(),
        messages: z.array(WhatsAppMessageSchema).optional(),
        statuses: z.array(WhatsAppStatusSchema).optional(),
        errors: z.array(z.any()).optional()
      }),
      field: z.string()
    }))
  }))
});

/**
 * Verify webhook signature using HMAC-SHA256 with timing-safe comparison
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signature) return false;

  try {
    const [rawMethod, rawHash] = signature.split("=");
    const method = rawMethod?.toLowerCase();
    const receivedHash = rawHash?.trim().toLowerCase();
    if (!method || !receivedHash) return false;

    const hashAlgorithm = method === "sha256"
      ? "SHA-256"
      : method === "sha1"
      ? "SHA-1"
      : null;
    if (!hashAlgorithm) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(appSecret),
      { name: "HMAC", hash: hashAlgorithm },
      false,
      ["sign"],
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload),
    );

    const expectedHash = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return timingSafeEqual(
      encoder.encode(receivedHash),
      encoder.encode(expectedHash),
    );
  } catch (error) {
    logError("signature_verification", error instanceof Error ? error : new Error(String(error)), { signatureProvided: !!signature });
    return false;
  }
}

/**
 * Validate webhook payload structure using Zod schemas
 */
export function validateWebhookPayload(data: unknown) {
  try {
    return WhatsAppWebhookSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(`Invalid webhook payload: ${error.errors.map(e => e.message).join(", ")}`);
    }
    throw error;
  }
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
 * Metrics class for recording metrics with support for different types
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

  async gauge(metricName: string, value: number, tags?: Record<string, any>): Promise<void> {
    try {
      await this.supabase.from("webhook_metrics").insert({
        metric_type: "gauge",
        metric_name: metricName,
        metric_value: value,
        tags: tags || {},
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to record gauge:", error);
    }
  }

  async histogram(metricName: string, value: number, tags?: Record<string, any>): Promise<void> {
    try {
      await this.supabase.from("webhook_metrics").insert({
        metric_type: "histogram",
        metric_name: metricName,
        metric_value: value,
        tags: tags || {},
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to record histogram:", error);
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
 * Webhook processor for queuing and processing webhooks
 */
export class WebhookProcessor {
  constructor(
    private supabase: SupabaseClient,
    private logger: Logger,
    private metrics: Metrics
  ) {}

  async queueWebhook(params: {
    payload: any;
    correlationId: string;
    priority?: number;
    source?: string;
  }): Promise<void> {
    const { payload, correlationId, priority = 5, source = "whatsapp" } = params;

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
      throw new WebhookError("Failed to queue webhook", "500", "QUEUE_ERROR", true);
    }
  }

  async processQueuedWebhooks(): Promise<void> {
    // Get pending webhooks
    const { data: webhooks, error } = await this.supabase
      .from("webhook_queue")
      .select("*")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(10);

    if (error) {
      this.logger.error("Failed to fetch queued webhooks", { error });
      return;
    }

    // Process each webhook
    for (const webhook of webhooks || []) {
      await this.processWebhook(webhook);
    }
  }

  private async processWebhook(webhook: any): Promise<void> {
    const startTime = Date.now();

    try {
      // Mark as processing
      await this.supabase
        .from("webhook_queue")
        .update({ 
          status: "processing",
          started_at: new Date().toISOString()
        })
        .eq("id", webhook.id);

      // Process based on webhook type
      const value = webhook.payload.entry?.[0]?.changes?.[0]?.value;

      if (value?.messages) {
        await this.processMessages(value.messages, value.metadata);
      }

      if (value?.statuses) {
        await this.processStatuses(value.statuses);
      }

      // Mark as completed
      await this.supabase
        .from("webhook_queue")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", webhook.id);

      const processingTime = Date.now() - startTime;
      await this.metrics.record("webhook.processed", 1, {
        type: "success",
        processing_time: processingTime
      });

    } catch (error) {
      await this.handleProcessingError(webhook, error);
    }
  }

  private async processMessages(messages: any[], metadata: any): Promise<void> {
    for (const message of messages) {
      await this.processMessage(message, metadata);
    }
  }

  private async processMessage(message: any, metadata: any): Promise<void> {
    // Get or create conversation
    const conversation = await this.getOrCreateConversation(
      message.from,
      metadata.display_phone_number
    );

    // Build message data
    const messageData: any = {
      wa_message_id: message.id,
      conversation_id: conversation.id,
      direction: "inbound",
      type: message.type,
      metadata: message,
      created_at: new Date(parseInt(message.timestamp) * 1000).toISOString()
    };

    // Add type-specific fields
    switch (message.type) {
      case "text":
        messageData.text_body = message.text.body;
        break;
      case "image":
      case "document":
      case "audio":
      case "video":
        const media = message[message.type];
        messageData.media_url = media.id;
        messageData.media_mime_type = media.mime_type;
        messageData.media_sha256 = media.sha256;
        messageData.caption = media.caption;
        break;
      case "location":
        messageData.location_latitude = message.location.latitude;
        messageData.location_longitude = message.location.longitude;
        messageData.location_name = message.location.name;
        messageData.location_address = message.location.address;
        break;
      case "interactive":
        messageData.interactive_type = message.interactive.type;
        messageData.interactive_payload = message.interactive;
        break;
    }

    // Insert message with idempotency
    const { data, error } = await this.supabase
      .rpc("process_webhook_idempotent", {
        p_wa_message_id: message.id,
        p_payload: messageData
      });

    if (error && error.code !== "23505") {
      throw error;
    }

    // Trigger business logic for new messages
    if (data?.status === "processed") {
      await this.triggerMessageHandlers(conversation.id, messageData);
    }
  }

  private async processStatuses(statuses: any[]): Promise<void> {
    for (const status of statuses) {
      await this.supabase
        .rpc("update_message_status", {
          p_wa_message_id: status.id,
          p_new_status: status.status,
          p_metadata: status
        });

      await this.metrics.record("message.status_update", 1, {
        status: status.status
      });
    }
  }

  private async getOrCreateConversation(phoneNumber: string, businessPhone: string): Promise<any> {
    let { data: conversation } = await this.supabase
      .from("conversations")
      .select("*")
      .eq("phone_number", phoneNumber)
      .single();

    if (!conversation) {
      const { data: newConversation, error } = await this.supabase
        .from("conversations")
        .insert({
          phone_number: phoneNumber,
          metadata: {
            business_phone: businessPhone,
            created_via: "webhook"
          }
        })
        .select()
        .single();

      if (error) throw error;
      conversation = newConversation;
    }

    // Update last message timestamp
    await this.supabase
      .from("conversations")
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", conversation.id);

    return conversation;
  }

  private async triggerMessageHandlers(conversationId: string, message: any): Promise<void> {
    // Integration point for business logic
    this.logger.info("Triggering message handlers", {
      conversationId,
      messageType: message.type
    });
  }

  private async handleProcessingError(webhook: any, error: any): Promise<void> {
    this.logger.error("Webhook processing failed", {
      webhookId: webhook.id,
      error: error.message
    });

    const shouldRetry = webhook.retry_count < webhook.max_retries;
    const nextRetryAt = shouldRetry 
      ? new Date(Date.now() + Math.pow(2, webhook.retry_count) * 60000).toISOString()
      : null;

    await this.supabase
      .from("webhook_queue")
      .update({
        status: shouldRetry ? "failed" : "dead",
        error_message: error.message,
        error_details: { stack: error.stack },
        retry_count: webhook.retry_count + 1,
        next_retry_at: nextRetryAt
      })
      .eq("id", webhook.id);

    await this.metrics.record("webhook.processing_error", 1, {
      retryable: shouldRetry
    });
  }
}

/**
 * Circuit breaker pattern implementation with half-open state
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private successCount = 0;

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
        this.successCount = 0;
      } else {
        throw new CircuitBreakerOpenError();
      }
    }

    try {
      const result = await fn();
      
      if (this.state === "half-open") {
        this.successCount++;
        if (this.successCount >= 3) {
          this.state = "closed";
          this.failures = 0;
        }
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
      successCount: this.successCount,
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
  originalError: Error, // Renamed parameter to avoid confusion
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
        error: originalError.message, // Use originalError
        error_stack: originalError.stack, // Use originalError
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
      errorMessage: originalError.message, // Use originalError
    }, "error");
    
    recordMetric("webhook.dlq_added", 1, {
      retry_count: retryCount,
      max_retries_reached: retryCount >= MAX_RETRIES ? 'true' : 'false',
    });
    
  } catch (dlqError) {
    logError("add_to_dlq", dlqError instanceof Error ? dlqError : new Error(String(dlqError)), {
      correlationId,
      originalError: originalError.message, // Use originalError
    });
    
    // Critical: If we can't add to DLQ, log prominently
    console.error(JSON.stringify({
      event: "CRITICAL_DLQ_FAILURE",
      correlationId,
      originalError: originalError.message, // Use originalError
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
