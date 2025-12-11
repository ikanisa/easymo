/**
 * WhatsApp Buy & Sell AI Agent Webhook Handler
 *
 * Scope:
 * - Natural language AI chat to discover businesses and services
 * - Handles AI-powered intent recognition and entity extraction
 * - Session management with timeout (30 minutes)
 * - Delegates to agent-buy-sell for AI processing
 * 
 * State Keys:
 * - agent_chat: User in AI conversation mode
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { sendText, sendButtons } from "../_shared/wa-webhook-shared/wa/client.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { claimEvent } from "../_shared/wa-webhook-shared/state/idempotency.ts";
import { getCountryCode, mapCountryCode } from "../_shared/phone-utils.ts";
import {
  ensureProfile,
  getState,
  setState,
  clearState,
} from "../_shared/wa-webhook-shared/state/store.ts";

// =====================================================
// CONFIGURATION
// =====================================================

const SERVICE_NAME = "wa-webhook-buy-sell-agent";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface AgentChatState {
  active: boolean;
  started_at: string;
  agent_type: string;
}

serve(async (req: Request): Promise<Response> => {
  // Rate limiting
  const rateLimitCheck = await rateLimitMiddleware(req, {
    limit: 100,
    windowSeconds: 60,
  });

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!;
  }

  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Health check and webhook verification endpoint (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // WhatsApp webhook verification
    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { 
        status: 200,
        headers: { "X-Request-ID": requestId, "X-Correlation-ID": correlationId },
      });
    }

    // Health check
    if (!mode && !token) {
      return respond({
        status: "healthy",
        service: SERVICE_NAME,
        description: "AI-powered natural language business discovery",
        timestamp: new Date().toISOString(),
      });
    }

    return respond({ error: "forbidden" }, { status: 403 });
  }

  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed" }, { status: 405 });
  }

  const startTime = Date.now();

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
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ?? Deno.env.get("WA_APP_SECRET");
    const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";
    const internalForward = req.headers.get("x-wa-internal-forward") === "true";

    if (!appSecret) {
      logStructuredEvent("AGENT_AUTH_CONFIG_ERROR", {
        error: "WHATSAPP_APP_SECRET not configured",
        correlationId,
      }, "error");
      return respond({ error: "server_misconfigured" }, { status: 500 });
    }

    let isValidSignature = false;
    if (signature) {
      try {
        isValidSignature = await verifyWebhookSignature(rawBody, signature, appSecret);
      } catch (err) {
        logStructuredEvent("AGENT_SIGNATURE_ERROR", {
          error: err instanceof Error ? err.message : String(err),
          correlationId,
        }, "error");
      }
    }

    if (!isValidSignature && !allowUnsigned && !internalForward) {
      logStructuredEvent("AGENT_AUTH_FAILED", {
        signatureProvided: !!signature,
        correlationId,
      }, "warn");
      return respond({ error: "unauthorized" }, { status: 401 });
    }

    // Parse payload after verification
    const payload = JSON.parse(rawBody);
    const message = extractWhatsAppMessage(payload);

    if (!message?.from) {
      return respond({ success: true, ignored: "no_message" });
    }

    const text = message.body?.trim() ?? "";
    const userPhone = message.from;

    // Deduplicate messages
    const messageId = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
    if (messageId) {
      const claimed = await claimEvent(messageId);
      if (!claimed) {
        await logStructuredEvent("AGENT_DUPLICATE_BLOCKED", {
          message_id: messageId,
          from: `***${userPhone.slice(-4)}`,
          correlationId,
        });
        return respond({ success: true, message: "duplicate_blocked" });
      }
    }

    logStructuredEvent("AGENT_MESSAGE_RECEIVED", {
      from: `***${userPhone.slice(-4)}`,
      type: message.type,
      requestId,
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const profile = await ensureProfile(supabase, userPhone);
    const userCountry = mapCountryCode(getCountryCode(userPhone));

    // === HANDLE EXIT COMMANDS ===
    const lower = text.toLowerCase();
    const exitKeywords = ["exit", "menu", "stop", "home", "back", "categories", "browse"];
    
    if (exitKeywords.includes(lower)) {
      await clearState(supabase, profile.user_id);
      
      await logStructuredEvent("AGENT_SESSION_EXIT", {
        userId: profile.user_id,
        reason: "user_keyword",
        keyword: lower,
      });
      
      recordMetric("buy_sell.ai_session_exit", 1, {
        reason: "user_keyword",
        keyword: lower,
      });
      
      await sendText(userPhone, "👋 Goodbye! Type 'buy' or 'sell' to browse categories.");
      return respond({ success: true, message: "session_exited" });
    }

    // === HANDLE BUTTON EXITS ===
    if (message.type === "interactive" && message.interactive?.button_reply?.id) {
      const buttonId = message.interactive.button_reply.id;
      
      if (buttonId === "exit_ai" || buttonId === "back_home" || buttonId === "back_menu") {
        await clearState(supabase, profile.user_id);
        
        await logStructuredEvent("AGENT_SESSION_EXIT", {
          userId: profile.user_id,
          reason: "button",
          buttonId,
        });
        
        recordMetric("buy_sell.ai_session_exit", 1, {
          reason: "button",
          buttonId,
        });
        
        await sendText(userPhone, "👋 Goodbye! Type 'buy' or 'sell' to browse categories.");
        return respond({ success: true, message: "session_exited" });
      }
    }

    // === GET OR START AI SESSION ===
    let stateData = await getState(supabase, profile.user_id);
    
    // If no active session, start one and show welcome
    if (stateData?.key !== "agent_chat" || !(stateData?.data as AgentChatState)?.active) {
      await setState(supabase, profile.user_id, {
        key: "agent_chat",
        data: {
          active: true,
          started_at: new Date().toISOString(),
          agent_type: "business_broker",
        } as AgentChatState,
      });
      
      recordMetric("buy_sell.ai_session_start", 1, {
        country: userCountry,
      });
      
      await showAIWelcome(userPhone);
      return respond({ success: true, message: "ai_welcome_shown" });
    }

    // === CHECK SESSION TIMEOUT ===
    const sessionState = stateData.data as AgentChatState;
    const started = new Date(sessionState.started_at);
    const elapsed = Date.now() - started.getTime();
    
    if (elapsed > SESSION_TIMEOUT_MS) {
      await clearState(supabase, profile.user_id);
      
      await logStructuredEvent("AGENT_SESSION_EXPIRED", {
        userId: profile.user_id,
        elapsedMs: elapsed,
      });
      
      recordMetric("buy_sell.ai_session_exit", 1, {
        reason: "timeout",
        duration_ms: elapsed,
      });
      
      await sendText(userPhone, "⏱️ Your AI session has expired.\n\nType 'chat' to start a new conversation, or 'browse' to see categories.");
      return respond({ success: true, message: "session_expired" });
    }

    // === HANDLE NON-TEXT MESSAGES ===
    if (message.type !== "text" || !text.trim()) {
      await logStructuredEvent("AGENT_NON_TEXT_MESSAGE", {
        userId: profile.user_id,
        messageType: message.type,
      }, "warn");
      
      recordMetric("buy_sell.ai_non_text", 1, {
        messageType: message.type,
      });
      
      await sendText(userPhone, "💬 Please type your question, or say 'exit' to return to menu.");
      return respond({ success: true, message: "non_text_handled" });
    }

    // === FORWARD TO AI AGENT ===
    const aiResponse = await forwardToAIAgent(userPhone, text, message.id ?? messageId, correlationId);
    
    if (aiResponse.success && aiResponse.message) {
      await sendText(userPhone, aiResponse.message);
      
      const duration = Date.now() - startTime;
      recordMetric("buy_sell.ai_forwarded", 1, { duration_ms: duration });
      
      return respond({ success: true, message: "ai_response_sent" });
    }

    // AI forward failed - send fallback
    await logStructuredEvent("AGENT_FORWARD_FAILED", {
      from: `***${userPhone.slice(-4)}`,
      correlationId,
    }, "warn");
    
    await sendText(userPhone, "I'm having trouble understanding right now. Please try again, or type 'menu' to browse categories.");
    
    return respond({ success: true, message: "ai_fallback_sent" });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logStructuredEvent(
      "AGENT_ERROR",
      {
        error: errorMessage,
        stack: errorStack,
        durationMs: duration,
        requestId,
        correlationId,
      },
      "error",
    );

    recordMetric("agent.message.error", 1);

    return respond({ error: errorMessage }, { status: 500 });
  }
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function showAIWelcome(userPhone: string): Promise<void> {
  const welcomeMessage = `🤖 *AI Chat Mode*

I'm your AI business assistant.

I can help you find ANY local business or service:
💊 Pharmacies  🍔 Restaurants  ✂️ Salons
📱 Electronics  🏗️ Hardware  🏪 Shops

Just tell me what you're looking for!

Examples:
• "I need medicine"
• "phone repair near me"
• "hungry want pizza"
• "haircut"

💡 Type 'menu' anytime to exit AI mode

What are you looking for?`;

  await sendButtons(userPhone, welcomeMessage, [
    { id: "exit_ai", title: "← Back to Categories" },
  ]);

  await logStructuredEvent("AGENT_WELCOME_SHOWN", {
    wa_id: `***${userPhone.slice(-4)}`,
  });
}

async function forwardToAIAgent(
  userPhone: string,
  text: string,
  messageId: string,
  correlationId: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    // Create idempotency key
    const idempotencyKey = `agent_chat:${userPhone}:${messageId}`;
    
    // Check if this message was already processed
    const { data: existingRequest } = await supabase
      .from('agent_requests')
      .select('response')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    
    if (existingRequest?.response) {
      await logStructuredEvent("AGENT_IDEMPOTENT_HIT", {
        correlationId,
        idempotencyKey,
        cachedResponse: true
      });
      
      const cachedMessage = existingRequest.response?.response_text || existingRequest.response?.message;
      return { success: true, message: cachedMessage };
    }
    
    const baseUrl = Deno.env.get("SUPABASE_URL");
    if (!baseUrl) return { success: false };

    const apiKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Correlation-ID": correlationId,
      "X-WA-Internal-Forward": "true",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
      headers.apikey = apiKey;
    }

    const res = await fetch(`${baseUrl}/functions/v1/agent-buy-sell`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        userPhone,
        message: text,
        idempotencyKey,
        correlationId,
      }),
    });

    if (!res.ok) {
      await logStructuredEvent(
        "AGENT_FORWARD_HTTP_ERROR",
        { status: res.status, correlationId },
        "warn",
      );
      return { success: false };
    }

    const data = await res.json();
    
    // Cache the response
    try {
      await supabase
        .from('agent_requests')
        .insert({
          idempotency_key: idempotencyKey,
          agent_slug: 'buy_sell_agent',
          request_payload: { userPhone, message: text },
          response: data,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
    } catch {
      // Caching is best-effort
    }
    
    const responseText = data?.response_text || data?.message;
    return { success: !!responseText, message: responseText };
  } catch (err) {
    await logStructuredEvent(
      "AGENT_FORWARD_EXCEPTION",
      { error: err instanceof Error ? err.message : String(err), correlationId },
      "error",
    );
    return { success: false };
  }
}

function extractWhatsAppMessage(payload: unknown): {
  from: string;
  body: string;
  type: string;
  id?: string;
  interactive?: { 
    button_reply?: { id: string; title: string } 
  };
} | null {
  try {
    const p = payload as Record<string, unknown>;
    
    if (p?.entry) {
      const entry = p.entry as Array<{ changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }> }>;
      const msg = entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (msg) {
        return {
          from: msg.from as string,
          body:
            (typeof (msg.text as Record<string, unknown>)?.body === 'string' ? (msg.text as Record<string, unknown>)?.body : null) ||
            ((msg.interactive as any)?.button_reply?.title as string) ||
            "",
          type: msg.type as string,
          id: msg.id as string,
          interactive: msg.interactive as { button_reply?: { id: string; title: string } },
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}
