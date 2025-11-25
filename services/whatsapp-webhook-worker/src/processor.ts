import {
  type AgentResult,
  analyzeIntent,
  BookingAgent,
  FarmerAgent,
  JobsAgent,
  PropertyRentalAgent,
  runAgent,
  runGeneralBrokerAgent,
  SalesAgent,
  SupportAgent,
  TriageAgent,
} from "@easymo/agents";
import { IdempotencyStore } from "@easymo/messaging";
import { createClient,SupabaseClient } from "@supabase/supabase-js";

import { config } from "./config.js";
import { logger } from "./logger.js";
import { maskPhone,RateLimiter } from "./rate-limiter.js";
import { resolveSecret } from "./secrets.js";
import { verifyWebhookSignature } from "./signature.js";

export interface WebhookPayload {
  id: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  /** Raw JSON body for signature verification */
  rawBody?: string;
  timestamp: string;
  retryCount?: number;
}

export interface WebhookProcessingResult {
  success: boolean;
  messageId: string;
  error?: string;
  duration: number;
  agentResponse?: string;
  /** Indicates if signature was verified (when signature verification is enabled) */
  signatureVerified?: boolean;
}

interface WhatsAppMessage {
  from: string;
  type: string;
  text?: { body: string };
  interactive?: {
    button_reply?: { title: string };
    list_reply?: { title: string };
  };
}

/**
 * Processes WhatsApp webhook payloads
 * Reuses the existing wa-webhook handler logic
 * 
 * Security features (per docs/GROUND_RULES.md):
 * - Webhook signature verification using HMAC-SHA256
 * - Rate limiting per phone number
 */
export class WebhookProcessor {
  private supabase!: SupabaseClient;
  private idempotencyStore: InstanceType<typeof IdempotencyStore>;
  private serviceRolePromise: Promise<string | undefined>;
  private appSecretPromise: Promise<string | undefined>;

  // Rate limiting (per docs/GROUND_RULES.md recommendation)
  private rateLimiter = new RateLimiter({
    maxRequests: 60, // requests per window
    windowMs: 60 * 1000, // 1 minute
  });

  constructor() {
    this.serviceRolePromise = resolveSecret({
      ref: config.SUPABASE_SERVICE_ROLE_KEY,
      fallbackEnv: "SUPABASE_SERVICE_ROLE_KEY",
      label: "supabase_service_role",
    });

    this.appSecretPromise = resolveSecret({
      ref: config.WHATSAPP_APP_SECRET,
      fallbackEnv: "WHATSAPP_APP_SECRET",
      label: "whatsapp_app_secret",
      optional: true,
    });

    this.idempotencyStore = new IdempotencyStore({
      redisUrl: config.REDIS_URL,
      ttlSeconds: 24 * 60 * 60, // 24 hours
      logger,
      namespace: "webhook",
    });
  }

  async connect(): Promise<void> {
    const serviceRoleKey = await this.serviceRolePromise;
    if (!serviceRoleKey) {
      throw new Error("Supabase service role key unavailable");
    }
    this.supabase = createClient(config.SUPABASE_URL, serviceRoleKey);
    await this.idempotencyStore.connect();
    
    const appSecret = await this.appSecretPromise;
    if (!appSecret) {
      logger.warn({
        msg: "webhook.signature_verification_disabled",
        event: "SIGNATURE_VERIFICATION_DISABLED",
        reason: "WHATSAPP_APP_SECRET not configured"
      });
    }
    
    logger.info("WebhookProcessor initialized");
  }

  async disconnect(): Promise<void> {
    await this.idempotencyStore.disconnect();
  }

  /**
   * Process a webhook payload with idempotency
   * 
   * Security checks performed:
   * 1. Signature verification (if WHATSAPP_APP_SECRET is configured)
   * 2. Rate limiting per phone number
   * 3. Idempotency to prevent duplicate processing
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
      // 1. Verify signature (per docs/GROUND_RULES.md - ALL webhook endpoints MUST verify signatures)
      const appSecret = await this.appSecretPromise;
      const signature = payload.headers["x-hub-signature-256"];
      const allowUnsigned = config.WA_ALLOW_UNSIGNED_WEBHOOKS.toLowerCase() === "true";
      const isInternalForward = payload.headers["x-wa-internal-forward"] === "true";
      let signatureVerified = false;

      if (appSecret && payload.rawBody) {
        signatureVerified = verifyWebhookSignature(payload.rawBody, signature, appSecret);
        
        if (!signatureVerified) {
          if (allowUnsigned || isInternalForward) {
            logger.warn({
              msg: "webhook.signature_bypass",
              webhookId: payload.id,
              correlationId,
              reason: isInternalForward ? "internal_forward" : signature ? "signature_mismatch" : "no_signature",
              event: "SIGNATURE_BYPASS"
            });
          } else {
            logger.warn({
              msg: "webhook.signature_failed",
              webhookId: payload.id,
              correlationId,
              signatureProvided: !!signature,
              event: "SIGNATURE_FAILED"
            });
            return {
              success: false,
              messageId: payload.id,
              error: "Invalid or missing webhook signature",
              duration: Date.now() - startTime,
              signatureVerified: false,
            };
          }
        } else {
          logger.debug({
            msg: "webhook.signature_verified",
            webhookId: payload.id,
            correlationId,
            event: "SIGNATURE_VERIFIED"
          });
        }
      } else if (appSecret && !payload.rawBody) {
        logger.warn({
          msg: "webhook.signature_skipped",
          webhookId: payload.id,
          correlationId,
          reason: "rawBody not provided",
          event: "SIGNATURE_SKIPPED"
        });
      }

      // 2. Extract phone number for rate limiting
      const body = payload.body as { entry?: { changes?: { value?: { messages?: WhatsAppMessage[] } }[] }[] };
      const phoneNumber = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;

      if (phoneNumber) {
        // Periodically cleanup rate limiter (every ~100 requests)
        if (Math.random() < 0.01) {
          this.rateLimiter.cleanup();
        }

        const rateCheck = this.rateLimiter.check(phoneNumber);
        if (!rateCheck.allowed) {
          logger.warn({
            msg: "webhook.rate_limited",
            webhookId: payload.id,
            correlationId,
            phone: maskPhone(phoneNumber),
            resetAt: new Date(rateCheck.resetAt).toISOString(),
            event: "RATE_LIMITED"
          });
          return {
            success: false,
            messageId: payload.id,
            error: "Rate limit exceeded",
            duration: Date.now() - startTime,
            signatureVerified,
          };
        }
      }

      // 3. Use idempotency to prevent duplicate processing
      const result = await this.idempotencyStore.execute(
        payload.id,
        async () => {
          return await this.invokeWebhookHandler(payload);
        }
      );

      const duration = Date.now() - startTime;

      logger.info({
        msg: "webhook.processing.success",
        webhookId: payload.id,
        correlationId,
        duration,
        agentResponse: result?.agentResponse // Log the response
      });

      return {
        success: true,
        messageId: payload.id,
        duration,
        agentResponse: result?.agentResponse,
        signatureVerified,
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
   */
  private async invokeWebhookHandler(payload: WebhookPayload): Promise<{ agentResponse: string }> {
    // Validate payload structure
    if (!payload.body || typeof payload.body !== "object") {
      throw new Error("Invalid webhook payload structure");
    }

    // Extract message details (simplified for WhatsApp payload)
    // Assuming standard WhatsApp Cloud API format
    const body = payload.body as { entry?: { changes?: { value?: { messages?: WhatsAppMessage[] } }[] }[] };
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    
    if (!message) {
      logger.info("No message found in webhook payload (status update?)");
      return { agentResponse: "No message processed" };
    }

    const userId = message.from; // Phone number
    const messageType = message.type;
    let userText = "";

    if (messageType === "text") {
      userText = message.text?.body || "";
    } else if (messageType === "interactive") {
      userText = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "";
    } else {
      // Handle other types (image, audio) if needed, or skip
      logger.info(`Skipping unsupported message type: ${messageType}`);
      return { agentResponse: "Unsupported message type" };
    }

    logger.info({ msg: "Processing user message", userId, text: userText });

    // 1. Analyze Intent / Triage
    const intent = analyzeIntent(userText);
    logger.info({ 
      msg: "Intent analyzed", 
      agent: intent.agent,
      vertical: intent.vertical,
      isOutOfScope: intent.isOutOfScope,
      confidence: intent.confidence 
    });

    let agentResult: AgentResult;

    // 2. Route to appropriate agent
    // Check for out-of-scope requests FIRST
    if (intent.isOutOfScope) {
      logger.info({ msg: "Out-of-scope request detected", vertical: intent.vertical });
      agentResult = await runGeneralBrokerAgent(userId, userText);
    } else {
      // Route based on agent type
      switch (intent.agent) {
        case "booking":
          agentResult = await runAgent(BookingAgent, { userId, query: userText });
          break;
        case "real_estate":
          agentResult = await runAgent(new PropertyRentalAgent(), { userId, query: userText });
          break;
        case "farmer":
          agentResult = await runAgent(new FarmerAgent(), { userId, query: userText });
          break;
        case "jobs":
          agentResult = await runAgent(JobsAgent, { userId, query: userText });
          break;
        case "sales":
          agentResult = await runAgent(SalesAgent, { userId, query: userText });
          break;
        case "support":
          agentResult = await runAgent(SupportAgent, { userId, query: userText });
          break;
        case "redemption":
          // TODO: Use TokenRedemptionAgent when available/exported
          agentResult = await runAgent(TriageAgent, { userId, query: userText });
          break;
        case "general_broker":
          // Use GeneralBrokerAgent for general EasyMO queries
          agentResult = await runGeneralBrokerAgent(userId, userText);
          break;
        default:
          // Default to GeneralBrokerAgent (was TriageAgent)
          agentResult = await runGeneralBrokerAgent(userId, userText);
          break;
      }
    }

    // 3. Handle Result
    if (agentResult.success) {
      logger.info({ 
        msg: "Agent execution successful", 
        agent: intent.agent, 
        response: agentResult.finalOutput 
      });

      // Queue outbound WhatsApp message via Supabase notifications + worker
      try {
        const to = userId.startsWith("+") ? userId : `+${userId}`;
        const insertPayload: Record<string, unknown> = {
          to_wa_id: to,
          notification_type: "agent-reply",
          channel: "freeform",
          payload: { text: agentResult.finalOutput },
          status: "queued",
          retry_count: 0,
        };
        const { error } = await this.supabase
          .from("notifications")
          .insert(insertPayload);
        if (error) {
          logger.warn({ msg: "webhook.queue_notification_failed", error: error.message });
        } else {
          // best-effort trigger of the notification worker
          try {
            await this.supabase.functions.invoke("notification-worker", { body: {} });
          } catch (invokeErr) {
            logger.warn({ msg: "webhook.notification_worker_invoke_failed", error: String(invokeErr) });
          }
        }
      } catch (queueErr) {
        logger.warn({ msg: "webhook.queue_outbound_failed", error: String(queueErr) });
      }

      return { agentResponse: agentResult.finalOutput };
    } else {
      logger.error({ 
        msg: "Agent execution failed", 
        agent: intent.agent, 
        error: agentResult.error 
      });
      throw new Error(`Agent execution failed: ${agentResult.error}`);
    }
  }
}
