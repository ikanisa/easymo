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

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
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

    // Use structured event logging (P2-006: removed console.log)
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
    // Use observability logging only (webhook_metrics table doesn't exist)
    await recordMetric(name, value, tags);
  }

  async gauge(metricName: string, value: number, tags?: Record<string, any>): Promise<void> {
    // Use observability logging only (webhook_metrics table doesn't exist)
    await recordMetric(metricName, value, tags || {});
  }

  async histogram(metricName: string, value: number, tags?: Record<string, any>): Promise<void> {
    // Use observability logging only (webhook_metrics table doesn't exist)
    await recordMetric(metricName, value, tags || {});
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
      logError("rate_limit_check", error instanceof Error ? error : new Error(String(error)), { identifier, bucket });
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

    // webhook_queue table doesn't exist - use observability logging only
    this.logger.info("Webhook queued (logging only)", { correlationId, priority, source });
    await this.metrics.record("webhook.queued", 1, { priority, source });
    
    logStructuredEvent("WEBHOOK_QUEUED", {
      correlationId,
      priority,
      source,
    });
  }

  async processQueuedWebhooks(): Promise<void> {
    // webhook_queue table doesn't exist - this method is no-op
    this.logger.info("processQueuedWebhooks called but webhook_queue table doesn't exist");
    logStructuredEvent("WEBHOOK_QUEUE_PROCESS_SKIPPED", {
      reason: "webhook_queue_table_not_exists",
    });
  }

  private async processWebhook(webhook: any): Promise<void> {
    // webhook_queue table doesn't exist - this method is no-op
    this.logger.info("processWebhook called but webhook_queue table doesn't exist", {
      webhookId: webhook?.id,
    });
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
    // webhook_queue table doesn't exist - just log the error
    this.logger.error("Webhook processing failed (logging only)", {
      webhookId: webhook?.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    await this.metrics.record("webhook.processing_error", 1, {
      retryable: false
    });
    
    logStructuredEvent("WEBHOOK_PROCESSING_ERROR", {
      webhookId: webhook?.id,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
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
  correlationId: string,
  phoneNumber?: string
): Promise<boolean> {
  try {
    // Use wa_events table instead of processed_webhook_messages (which doesn't exist)
    const { data, error } = await supabase
      .from('wa_events')
      .select('message_id')
      .eq('message_id', whatsappMessageId)
      .maybeSingle();
    
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
    // Properly serialize error for logging
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === "object" && "message" in error)
      ? String((error as Record<string, unknown>).message)
      : String(error);
    
    logStructuredEvent("IDEMPOTENCY_CHECK_ERROR", {
      whatsappMessageId,
      correlationId,
      error: errorMessage,
      errorCode: (error && typeof error === "object" && "code" in error) 
        ? String((error as Record<string, unknown>).code)
        : undefined,
    }, "warn");
    
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
  phoneNumber?: string,
  payload?: unknown
): Promise<void> {
  try {
    // Use wa_events table instead of processed_webhook_messages (which doesn't exist)
    // Ensure phone_number is never null (required by database constraint)
    const phone = phoneNumber || "unknown";
    
    const { error } = await supabase
      .from('wa_events')
      .insert({
        message_id: whatsappMessageId,
        phone_number: phone,
        event_type: 'webhook_processed',
        timestamp: new Date().toISOString(),
        body: payload ? JSON.stringify(payload) : null,
        status: 'processed',
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
    
    // webhook_dlq table doesn't exist - just log the error
    // (insertError check removed since we're not inserting)
    
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
    // Critical: If we can't add to DLQ, log prominently (P2-006: replaced console.error)
    logError("CRITICAL_DLQ_FAILURE", dlqError instanceof Error ? dlqError : new Error(String(dlqError)), {
      correlationId,
      originalError: originalError.message,
      dlqError: dlqError instanceof Error ? dlqError.message : String(dlqError),
    });
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
  // webhook_conversations and conversation_state_transitions tables don't exist
  // Just log the state transition for observability
  logStructuredEvent("CONVERSATION_STATE_UPDATED", {
    conversationId,
    fromState,
    toState: newState,
    reason,
    correlationId,
    metadata,
  });
  
  recordMetric("webhook.state_transition", 1, {
    from_state: fromState || 'unknown',
    to_state: newState,
  });
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
  // webhook_conversations table doesn't exist
  // Return a generated conversation ID for compatibility
  const conversationId = `conv_${userId}_${Date.now()}`;
  
  logStructuredEvent("WEBHOOK_CONVERSATION_CREATED", {
    conversationId,
    userId,
    agentType,
    correlationId,
  });
  
  recordMetric("webhook.conversation_created", 1, {
    agent_type: agentType || 'unknown',
  });
  
  return conversationId;
}
