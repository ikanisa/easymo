import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { waRouterConfig } from "./router.config.ts";
import { AgentOrchestrator } from "../_shared/agent-orchestrator.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const orchestrator = new AgentOrchestrator(supabase);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const requestId = req.headers.get("X-Request-ID") ?? crypto.randomUUID();

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", "wa-webhook-ai-agents");
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    return respond({
      status: "healthy",
      service: "wa-webhook-ai-agents",
      version: "3.0.0",
      timestamp: new Date().toISOString(),
      features: {
        agentOrchestrator: true,
        intentParsing: true,
        multiAgent: true,
      },
      proactive: {
        featureToggles: waRouterConfig.featureToggles,
        locales: Object.keys(waRouterConfig.proactiveTemplates),
      },
    });
  }

  // WhatsApp verification handshake (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return respond({ error: "forbidden" }, { status: 403 });
  }

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();
    
    // Verify WhatsApp signature (SECURITY FIX)
    const signature = req.headers.get("x-hub-signature-256");
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
    
    if (!appSecret) {
      await logStructuredEvent("AI_AGENTS_AUTH_CONFIG_ERROR", {
        error: "WHATSAPP_APP_SECRET not configured",
        correlationId,
      }, "error");
      return respond({ error: "server_misconfigured" }, { status: 500 });
    }
    
    if (!signature) {
      await logStructuredEvent("AI_AGENTS_MISSING_SIGNATURE", { correlationId }, "warn");
      return respond({ error: "missing_signature" }, { status: 401 });
    }
    
    const isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
    if (!isValid) {
      await logStructuredEvent("AI_AGENTS_INVALID_SIGNATURE", { correlationId }, "error");
      return respond({ error: "invalid_signature" }, { status: 401 });
    }
    
    const payload = JSON.parse(rawBody);
    
    // Extract WhatsApp message from webhook payload
    const message = extractWhatsAppMessage(payload);
    
    if (!message) {
      await logStructuredEvent("AI_AGENTS_NO_MESSAGE", { correlationId }, "warn");
      return respond({ success: true, message: "no_message" });
    }

    // Process message through orchestrator
    await orchestrator.processMessage(message);
    
    // Log event for debugging
    await captureAgentRequest(payload, correlationId);
    
    await logStructuredEvent("AI_AGENTS_MESSAGE_PROCESSED", {
      correlationId,
      messageType: message.type,
      from: maskPhone(message.from),
    });
    
    return respond({ 
      success: true, 
      service: "wa-webhook-ai-agents",
      messageProcessed: true,
    });
  } catch (error) {
    await logStructuredEvent("AI_AGENT_HANDLER_ERROR", {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, "error");
    
    return respond({ 
      error: "internal_error", 
      service: "wa-webhook-ai-agents",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
});

/**
 * Mask phone number for logging (PII protection)
 */
function maskPhone(phone: string): string {
  if (!phone) return "***";
  const match = phone.match(/^(\+\d{3})\d+(\d{4})$/);
  if (match) {
    return `${match[1]}****${match[2]}`;
  }
  return "***";
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
} | null {
  try {
    // Handle WhatsApp Business API webhook format
    if (payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const msg = payload.entry[0].changes[0].value.messages[0];
      return {
        from: msg.from,
        body: msg.text?.body || msg.interactive?.button_reply?.title || "",
        type: msg.type,
        timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
        id: msg.id,
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
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting WhatsApp message:", error);
    return null;
  }
}

async function captureAgentRequest(payload: unknown, correlationId: string) {
  try {
    await supabase.from("wa_ai_agent_events").insert({
      correlation_id: correlationId,
      payload,
      received_at: new Date().toISOString(),
    });
  } catch (error) {
    await logStructuredEvent("AI_AGENT_EVENT_LOG_FAILURE", {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    }, "warn");
  }
}
