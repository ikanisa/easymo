/**
 * WA-Webhook-Unified - Unified AI Agent Microservice
 * 
 * Consolidates all AI agent-based WhatsApp webhook services:
 * - wa-webhook-ai-agents (Farmer, Waiter, Support, Insurance, Rides, Sales, Business Broker)
 * - wa-webhook-marketplace (Buy/Sell, Shops)
 * - wa-webhook-jobs (Job Board)
 * - wa-webhook-property (Real Estate)
 * 
 * Features:
 * - Unified session management
 * - Hybrid intent classification (keyword + LLM)
 * - Seamless cross-domain agent handoffs
 * - Structured flows for complex processes
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { UnifiedOrchestrator } from "./core/orchestrator.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { storeDLQEntry } from "../_shared/dlq-manager.ts";
import { MessageDeduplicator } from "../_shared/message-deduplicator.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const orchestrator = new UnifiedOrchestrator(supabase);
const deduplicator = new MessageDeduplicator(supabase);

serve(async (req: Request): Promise<Response> => {
  // Rate limiting (100 req/min for high-volume WhatsApp)
  const rateLimitCheck = await rateLimitMiddleware(req, {
    limit: 100,
    windowSeconds: 60,
  });

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!;
  }

  const url = new URL(req.url);
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const requestId = req.headers.get("X-Request-ID") ?? crypto.randomUUID();

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", "wa-webhook-unified");
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Health check endpoint
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    return respond({
      status: "healthy",
      service: "wa-webhook-unified",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      architecture: "consolidated-ai-agents",
      aiProviders: {
        primary: "gemini-2.5-pro",
        secondary: "gpt-5",
      },
      features: {
        unifiedOrchestrator: true,
        multiDomain: true,
        agentHandoffs: true,
        structuredFlows: true,
        dualAiProviders: true,
        providerFallback: true,
      },
      agents: [
        { type: "waiter", name: "Waiter Agent" },
        { type: "farmer", name: "Farmer Agent" },
        { type: "support", name: "Support Agent" },
        { type: "sales_cold_caller", name: "Sales Agent" },
        { type: "buy_sell", name: "Buy & Sell Agent", consolidates: ["business_broker", "marketplace"] },
        { type: "jobs", name: "Jobs Agent" },
        { type: "real_estate", name: "Property Agent" },
        { type: "rides", name: "Rides Agent" },
        { type: "insurance", name: "Insurance Agent" },
      ],
      domains: [
        "waiter",
        "farmer",
        "jobs",
        "real_estate",
        "buy_sell",
        "insurance",
        "rides",
        "support",
      ],
    });
  }

  // WhatsApp verification handshake (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = Deno.env.get("WA_VERIFY_TOKEN");
    
    if (!verifyToken) {
      await logStructuredEvent("UNIFIED_VERIFY_TOKEN_NOT_SET", { correlationId }, "error");
      return respond({ error: "server_misconfigured" }, { status: 500 });
    }
    
    if (mode === "subscribe" && token && token === verifyToken) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return respond({ error: "forbidden" }, { status: 403 });
  }

  // Only POST is allowed for webhook messages
  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed" }, { status: 405 });
  }

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();
    
    // Verify WhatsApp signature
    const signatureHeader = req.headers.has("x-hub-signature-256")
      ? "x-hub-signature-256"
      : req.headers.has("x-hub-signature")
      ? "x-hub-signature"
      : null;
    const signature = signatureHeader ? req.headers.get(signatureHeader) : null;
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
    
    if (!appSecret) {
      await logStructuredEvent("UNIFIED_AUTH_CONFIG_ERROR", {
        error: "WHATSAPP_APP_SECRET not configured",
        correlationId,
      }, "error");
      return respond({ error: "server_misconfigured" }, { status: 500 });
    }
    
    // Allow bypass for internal forwarding or testing
    const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";
    const internalForward = req.headers.get("x-wa-internal-forward") === "true";
    
    if (!signature && !allowUnsigned && !internalForward) {
      await logStructuredEvent("UNIFIED_MISSING_SIGNATURE", {
        correlationId,
        signatureHeader,
      }, "warn");
      return respond({ error: "missing_signature" }, { status: 401 });
    }
    
    if (signature && !allowUnsigned && !internalForward) {
      const isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
      if (!isValid) {
        await logStructuredEvent("UNIFIED_INVALID_SIGNATURE", {
          correlationId,
          signatureHeader,
        }, "error");
        return respond({ error: "invalid_signature" }, { status: 401 });
      }
    }
    
    const payload = JSON.parse(rawBody);
    
    // Extract WhatsApp message from webhook payload
    const message = extractWhatsAppMessage(payload);
    
    if (!message) {
      await logStructuredEvent("UNIFIED_NO_MESSAGE", { correlationId }, "warn");
      return respond({ success: true, message: "no_message" });
    }

    await logStructuredEvent("UNIFIED_MESSAGE_RECEIVED", {
      correlationId,
      messageType: message.type,
      from: maskPhone(message.from),
    });

    // Check for duplicate messages
    const shouldProcess = await deduplicator.shouldProcess({
      messageId: message.id,
      from: message.from,
      type: message.type,
      timestamp: message.timestamp,
      body: message.body,
    });

    if (!shouldProcess) {
      await logStructuredEvent("UNIFIED_DUPLICATE_MESSAGE", {
        correlationId,
        messageId: message.id,
        from: maskPhone(message.from),
      }, "info");
      return respond({ success: true, message: "duplicate_ignored" });
    }

    // Check if this is from admin panel (needs synchronous response)
    const isAdminPanel = req.headers.get("X-Admin-Panel") === "true" || 
                        req.headers.get("x-admin-panel") === "true" ||
                        payload.entry?.[0]?.id === "admin-desktop-app";
    
    const forceAgent = req.headers.get("X-Force-Agent") || 
                       req.headers.get("x-force-agent") ||
                       message.context?.force_agent;

    // Process message through unified orchestrator
    const result = await orchestrator.processMessage(
      message, 
      correlationId,
      { skipSend: isAdminPanel } // Don't send WhatsApp message if from admin panel
    );
    
    await logStructuredEvent("UNIFIED_MESSAGE_PROCESSED", {
      correlationId,
      messageType: message.type,
      from: maskPhone(message.from),
      agentType: result.agentType,
    });
    
    // Return response text for admin panel
    if (isAdminPanel) {
      return respond({ 
        success: true, 
        service: "wa-webhook-unified",
        messageProcessed: true,
        agentResponse: result.responseText,
        agentType: result.agentType,
        message: result.responseText,
        response: result.responseText,
      });
    }
    
    return respond({ 
      success: true, 
      service: "wa-webhook-unified",
      messageProcessed: true,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    await logStructuredEvent("UNIFIED_HANDLER_ERROR", {
      correlationId,
      error: errorMessage,
      stack: errorStack,
    }, "error");
    
    // Store failed message in DLQ for retry
    try {
      const rawBody = await req.clone().text();
      const payload = JSON.parse(rawBody);
      const message = extractWhatsAppMessage(payload);
      
      if (message) {
        await storeDLQEntry(supabase, {
          phone_number: message.from,
          service: "wa-webhook-unified",
          correlation_id: correlationId,
          request_id: requestId,
          payload: payload,
          error_message: errorMessage,
          error_type: error instanceof Error ? error.constructor.name : "UnknownError",
          status_code: 500,
          retry_count: 0,
        });
        
        await logStructuredEvent("UNIFIED_MESSAGE_QUEUED_FOR_RETRY", {
          correlationId,
          phone: maskPhone(message.from),
        }, "info");
      }
    } catch (dlqError) {
      // DLQ failed - log but don't fail the request
      await logStructuredEvent("UNIFIED_DLQ_STORE_FAILED", {
        correlationId,
        dlqError: dlqError instanceof Error ? dlqError.message : String(dlqError),
      }, "error");
    }
    
    return respond({ 
      error: "internal_error", 
      service: "wa-webhook-unified",
      details: errorMessage,
    }, { status: 500 });
  }
});

/**
 * Mask phone number for logging (PII protection)
 */
function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return "***";
  
  if (phone.startsWith("+")) {
    const countryCodeEnd = Math.min(4, phone.length - 4);
    return `${phone.substring(0, countryCodeEnd)}****${phone.substring(phone.length - 4)}`;
  }
  
  return `${phone.substring(0, 2)}****${phone.substring(phone.length - 2)}`;
}

/**
 * Extract WhatsApp message from webhook payload
 */
function extractWhatsAppMessage(payload: any): {
  from: string;
  body: string;
  type: string;
  timestamp: string;
  id: string;
  location?: { latitude: number; longitude: number };
  interactive?: any;
} | null {
  try {
    // Handle WhatsApp Business API webhook format
    if (payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const msg = payload.entry[0].changes[0].value.messages[0];
      return {
        from: msg.from,
        body: msg.text?.body || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "",
        type: msg.type,
        timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
        id: msg.id,
        location: msg.location ? {
          latitude: msg.location.latitude,
          longitude: msg.location.longitude,
        } : undefined,
        interactive: msg.interactive,
      };
    }
    
    // Handle direct message format (for testing)
    if (payload?.from && payload?.body) {
      return {
        from: payload.from,
        body: payload.body,
        type: payload.type || "text",
        timestamp: payload.timestamp || new Date().toISOString(),
        id: payload.id || crypto.randomUUID(),
        location: payload.location,
        interactive: payload.interactive,
      };
    }
    
    return null;
  } catch (error) {
    await logStructuredEvent("MESSAGE_EXTRACTION_ERROR", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

await logStructuredEvent("SERVICE_STARTED", {
  service: "wa-webhook-unified",
  timestamp: new Date().toISOString(),
});
