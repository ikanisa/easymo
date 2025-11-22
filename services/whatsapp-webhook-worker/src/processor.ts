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
import { resolveSecret } from "./secrets.js";

export interface WebhookPayload {
  id: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  timestamp: string;
  retryCount?: number;
}

export interface WebhookProcessingResult {
  success: boolean;
  messageId: string;
  error?: string;
  duration: number;
  agentResponse?: string;
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
 */
export class WebhookProcessor {
  private supabase!: SupabaseClient;
  private idempotencyStore: InstanceType<typeof IdempotencyStore>;
  private serviceRolePromise: Promise<string | undefined>;

  constructor() {
    this.serviceRolePromise = resolveSecret({
      ref: config.SUPABASE_SERVICE_ROLE_KEY,
      fallbackEnv: "SUPABASE_SERVICE_ROLE_KEY",
      label: "supabase_service_role",
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
    logger.info("WebhookProcessor initialized");
  }

  async disconnect(): Promise<void> {
    await this.idempotencyStore.disconnect();
  }

  /**
   * Process a webhook payload with idempotency
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
        agentResponse: result?.agentResponse
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
