import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { IdempotencyStore } from "@easymo/messaging";

export interface WebhookPayload {
  id: string;
  headers: Record<string, string>;
  body: unknown;
  timestamp: string;
  retryCount?: number;
}

export interface WebhookProcessingResult {
  success: boolean;
  messageId: string;
  error?: string;
  duration: number;
}

/**
 * Processes WhatsApp webhook payloads
 * Reuses the existing wa-webhook handler logic
 */
export class WebhookProcessor {
  private supabase: SupabaseClient;
  private idempotencyStore: any;

  constructor() {
    this.supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.idempotencyStore = new IdempotencyStore({
      redisUrl: config.REDIS_URL,
      ttlSeconds: 24 * 60 * 60, // 24 hours
      logger,
      namespace: "webhook",
    });
  }

  async connect(): Promise<void> {
    await this.idempotencyStore.connect();
    logger.info("WebhookProcessor initialized");
  }

  async disconnect(): Promise<void> {
    await this.idempotencyStore.disconnect();
  }

  /**
   * Process a webhook payload with idempotency
   * This delegates to the Supabase Edge Function handler
   */
  async process(payload: WebhookPayload): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    const correlationId = payload.headers["x-correlation-id"] || payload.id;

    logger.info({
      msg: "webhook.processing.start",
      webhookId: payload.id,
      correlationId,
      retryCount: payload.retryCount || 0,
    });

    try {
      // Use idempotency to prevent duplicate processing
      const result = await this.idempotencyStore.execute(
        payload.id,
        async () => {
          // Call the Supabase wa-webhook function
          // In practice, this would invoke the handler directly
          // For now, we'll simulate the processing
          return await this.invokeWebhookHandler(payload);
        }
      );

      const duration = Date.now() - startTime;

      logger.info({
        msg: "webhook.processing.success",
        webhookId: payload.id,
        correlationId,
        duration,
      });

      return {
        success: true,
        messageId: payload.id,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error({
        msg: "webhook.processing.failed",
        webhookId: payload.id,
        correlationId,
        error: errorMessage,
        duration,
        retryCount: payload.retryCount || 0,
      });

      return {
        success: false,
        messageId: payload.id,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Invoke the webhook handler logic
   * This is where we'd call into the existing wa-webhook processing
   */
  private async invokeWebhookHandler(payload: WebhookPayload): Promise<void> {
    // TODO: Import and call the existing handlePreparedWebhook logic
    // For now, we simulate processing
    
    // Validate payload structure
    if (!payload.body || typeof payload.body !== "object") {
      throw new Error("Invalid webhook payload structure");
    }

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    logger.debug({
      msg: "webhook.handler.invoked",
      webhookId: payload.id,
    });
  }
}
