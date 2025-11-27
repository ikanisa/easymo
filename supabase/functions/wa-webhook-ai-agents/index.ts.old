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
    const verifyToken = Deno.env.get("WA_VERIFY_TOKEN");
    
    if (!verifyToken) {
      await logStructuredEvent("AI_AGENTS_VERIFY_TOKEN_NOT_SET", { correlationId }, "error");
      return respond({ error: "server_misconfigured" }, { status: 500 });
    }
    
    if (mode === "subscribe" && token && token === verifyToken) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return respond({ error: "forbidden" }, { status: 403 });
  }

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();
    
    // Verify WhatsApp signature (SECURITY FIX)
    const signatureHeader = req.headers.has("x-hub-signature-256")
      ? "x-hub-signature-256"
      : req.headers.has("x-hub-signature")
      ? "x-hub-signature"
      : null;
    const signature = signatureHeader ? req.headers.get(signatureHeader) : null;
    const signatureMeta = (() => {
      if (!signature) {
        return {
          provided: false,
          header: signatureHeader,
          method: null as string | null,
          sample: null as string | null,
        };
      }
      const [method, hash] = signature.split("=", 2);
      return {
        provided: true,
        header: signatureHeader,
        method: method?.toLowerCase() ?? null,
        sample: hash ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : null,
      };
    })();
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
    
    if (!appSecret) {
      await logStructuredEvent("AI_AGENTS_AUTH_CONFIG_ERROR", {
        error: "WHATSAPP_APP_SECRET not configured",
        correlationId,
      }, "error");
      return respond({ error: "server_misconfigured" }, { status: 500 });
    }
    
    if (!signature) {
      await logStructuredEvent("AI_AGENTS_MISSING_SIGNATURE", {
        correlationId,
        signatureHeader,
      }, "warn");
      return respond({ error: "missing_signature" }, { status: 401 });
    }
    
    const isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
    if (!isValid) {
      await logStructuredEvent("AI_AGENTS_INVALID_SIGNATURE", {
        correlationId,
        signatureHeader,
        signatureMethod: signatureMeta.method,
        signatureSample: signatureMeta.sample,
      }, "error");
      return respond({ error: "invalid_signature" }, { status: 401 });
    }
    await logStructuredEvent("AI_AGENTS_SIGNATURE_VALID", {
      correlationId,
      signatureHeader,
      signatureMethod: signatureMeta.method,
    }, "debug");
    
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
 * Handles international phone number formats
 */
function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return "***";
  
  // For E.164 format (+country_code...)
  if (phone.startsWith("+")) {
    // Show country code and last 4 digits: +250****1234
    const countryCodeEnd = Math.min(4, phone.length - 4);
    return `${phone.substring(0, countryCodeEnd)}****${phone.substring(phone.length - 4)}`;
  }
  
  // For other formats, show first 2 and last 2: 07****34
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
} | null {
  try {
    // Handle WhatsApp Business API webhook format
    if (payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const msg = payload.entry[0].changes[0].value.messages[0];
      const extracted: any = {
        from: msg.from,
        body: msg.text?.body || msg.interactive?.button_reply?.title || "",
        type: msg.type,
        timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
        id: msg.id,
      };
      
      // Extract location if present
      if (msg.type === "location" && msg.location) {
        extracted.location = {
          latitude: msg.location.latitude,
          longitude: msg.location.longitude,
        };
      }
      
      return extracted;
    }
    
    // Handle direct message format (for testing)
    if (payload?.from && payload?.body) {
      const extracted: any = {
        from: payload.from,
        body: payload.body,
        type: payload.type || "text",
        timestamp: payload.timestamp || new Date().toISOString(),
        id: payload.id || crypto.randomUUID(),
      };
      
      // Extract location if present
      if (payload.location) {
        extracted.location = payload.location;
      }
      
      return extracted;
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
