import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { waRouterConfig } from "./router.config.ts";
import { AgentOrchestrator } from "../_shared/agent-orchestrator.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const orchestrator = new AgentOrchestrator(supabase);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();

  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    return new Response(JSON.stringify({
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
    }), { headers: { "Content-Type": "application/json" } });
  }

  try {
    const payload = await req.json();
    
    // Extract WhatsApp message from webhook payload
    const message = extractWhatsAppMessage(payload);
    
    if (!message) {
      console.warn(JSON.stringify({
        event: "NO_MESSAGE_IN_PAYLOAD",
        correlationId,
      }));
      return new Response(JSON.stringify({ success: true, message: "no_message" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Process message through orchestrator
    await orchestrator.processMessage(message);
    
    // Log event for debugging
    await captureAgentRequest(payload, correlationId);
    
    return new Response(JSON.stringify({ 
      success: true, 
      service: "wa-webhook-ai-agents",
      messageProcessed: true,
    }), {
      headers: { "Content-Type": "application/json", "X-Correlation-ID": correlationId },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "AI_AGENT_HANDLER_ERROR",
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    return new Response(JSON.stringify({ 
      error: "internal_error", 
      service: "wa-webhook-ai-agents",
      details: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", "X-Correlation-ID": correlationId },
    });
  }
});

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
  await supabase.from("wa_ai_agent_events").insert({
    correlation_id: correlationId,
    payload,
    received_at: new Date().toISOString(),
  }).catch((error) => {
    console.warn(JSON.stringify({
      event: "AI_AGENT_EVENT_LOG_FAILURE",
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    }));
  });
}
