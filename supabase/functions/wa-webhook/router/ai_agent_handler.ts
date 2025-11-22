/**
 * AI Agent Handler
 * 
 * Routes WhatsApp messages to AI agents for intelligent processing
 * Falls back to existing handlers if AI is not applicable
 * 
 *
 * This handler respects the additive-only guards by:
 * - Being a completely new file
 * - Not modifying existing handlers
 * - Providing fallback to existing flows
 */

import type { SupabaseClient } from "../../_shared/supabase.ts";
import type { WhatsAppMessage } from "../types.ts";
import type { ChatState } from "../state/chat_state.ts";
import type { RouterContext } from "../types.ts";
import type {
  DetectionResult,
  ToneLocale,
} from "../../../../packages/localization/src/index.ts";

import { buildAgentContext, saveAgentInteraction, type AgentContext } from "../shared/agent_context.ts";
import { logStructuredEvent } from "../observe/log.ts";
import { sendText as sendRpcText, sendTemplateMessage } from "../rpc/whatsapp.ts";
import { fetchFeatureFlag } from "../../_shared/feature-flags.ts";
import { AdvancedRateLimiter } from "../shared/advanced_rate_limiter.ts";
import { getConfig } from "../shared/config_manager.ts";
import { getMetricsAggregator, type RequestMetrics } from "../shared/metrics_aggregator.ts";
import { maskE164 } from "../utils/text.ts";
import type { ApprovedTemplate } from "../shared/template_registry.ts";
import type { AgentResponse as OrchestratorAgentResponse } from "../shared/agent_orchestrator.ts";

// Chat-first integration imports
import { parseEmojiSelection, isSelectionMessage } from "../shared/message_formatter.ts";
import { formatAgentResponse } from "../shared/response_formatter.ts";
import {
  getAgentChatSession,
  saveAgentChatSession,
  updateSessionSelection,
  type AgentChatSession,
} from "../shared/agent_session.ts";

/**
 * Feature flag for AI agent system
 */
const AI_AGENTS_ENABLED_FLAG = "ai_agents_enabled";

/**
 * Singleton rate limiter instance
 */
let rateLimiterInstance: AdvancedRateLimiter | null = null;

function getRateLimiter(): AdvancedRateLimiter {
  if (!rateLimiterInstance) {
    const config = getConfig();
    rateLimiterInstance = new AdvancedRateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: config.rateLimitPerMinute,
      blacklistThreshold: config.rateLimitBlacklistThreshold,
      blacklistDuration: config.rateLimitBlacklistDuration,
    });
  }
  return rateLimiterInstance;
}

/**
 * Message patterns that should be routed to AI agents
 */
const AI_ELIGIBLE_PATTERNS = [
  // Greetings
  /^(hi|hello|hey|good morning|good afternoon|bonjour|salut|muraho)/i,
  
  // Questions
  /\b(how|what|when|where|why|who|can|could|would|should)\b/i,
  
  // Help requests
  /\b(help|assist|support|problem|issue|question)\b/i,
  
  // Booking related
  /\b(book|reserve|trip|travel|bus|vehicle|ride)\b/i,
  
  // Payment related
  /\b(pay|payment|transfer|balance|wallet|money)\b/i,
  
  // General conversational
  /^(thanks|thank you|merci|urakoze|ok|okay|yes|no|oui|non|yego|oya)/i,
];

/**
 * Determines if a message should be processed by AI agents
 */
export function isAIEligibleMessage(message: WhatsAppMessage, state: ChatState): boolean {
  // Check if message is text
  if (message.type === "text" && message.text?.body) {
    const text = message.text.body.trim();
    
    // Check against patterns
    return AI_ELIGIBLE_PATTERNS.some(pattern => pattern.test(text));
  }
  
  // Interactive messages from AI agent sessions
  if (message.type === "interactive" && state?.data?.ai_session) {
    return true;
  }
  
  return false;
}

/**
 * Try to handle message with AI agent
 * Returns true if handled, false if should fallback to existing handlers
 */
export async function tryAIAgentHandler(
  ctx: RouterContext,
  msg: WhatsAppMessage,
  state: ChatState
): Promise<boolean> {
  const correlationId = crypto.randomUUID();
  const maskedMsisdn = maskE164(msg.from);
  
  try {
    // Check feature flag
    const aiEnabled = await fetchFeatureFlag(ctx.supabase, AI_AGENTS_ENABLED_FLAG, false);
    if (!aiEnabled) {
      return false;
    }
    
    // Check if message is AI-eligible
    if (!isAIEligibleMessage(msg, state)) {
      return false;
    }
    
    // Check rate limit BEFORE processing
    const rateLimiter = getRateLimiter();
    const rateLimitResult = await rateLimiter.checkRateLimit(
      msg.from,
      correlationId
    );

    if (!rateLimitResult.allowed) {
      await logStructuredEvent("AI_RATE_LIMIT_EXCEEDED", {
        correlation_id: correlationId,
        msisdn_masked: maskedMsisdn,
        retry_after: rateLimitResult.retryAfter,
        blacklisted: rateLimitResult.blacklisted,
      });

      // Send user-friendly rate limit message
      const message = rateLimitResult.blacklisted
        ? "⛔ Your account has been temporarily suspended due to excessive requests. Please try again later."
        : `⏰ You're sending messages too quickly. Please wait ${rateLimitResult.retryAfter}s before trying again.`;

      await sendText(ctx.supabase, msg.from, {
        body: message,
        correlationId,
        audit: {
          reason: rateLimitResult.blacklisted ? "rate_limit_blacklisted" : "rate_limited",
        },
      });

      return true; // Handled (rejected)
    }

      await logStructuredEvent("AI_AGENT_REQUEST_START", {
      correlation_id: correlationId,
      msisdn_masked: maskedMsisdn,
      message_type: msg.type,
      rate_limit_remaining: rateLimitResult.remaining,
    });
    
    // Check for emoji selection from previous agent interaction
    let sessionData: AgentChatSession | null = null;
    let selectedOption: number | null = null;
    
    if (msg.type === "text" && msg.text?.body) {
      sessionData = await getAgentChatSession(ctx.supabase, msg.from);
      
      if (sessionData && isSelectionMessage(msg.text.body)) {
        selectedOption = parseEmojiSelection(
          msg.text.body,
          sessionData.options_presented?.length || 0
        );
        
        if (selectedOption) {
          await logStructuredEvent("AGENT_OPTION_SELECTED", {
            correlation_id: correlationId,
            agent_type: sessionData.agent_type,
            selection: selectedOption,
            session_id: sessionData.session_id,
          });
          
          // Update session with selection
          await updateSessionSelection(
            ctx.supabase,
            sessionData.session_id,
            selectedOption
          );
        }
      }
    }
    
    // Build agent context
    const toneLocale: ToneLocale = (ctx.toneLocale ?? (ctx.locale === "sw" ? "sw" : "en")) as ToneLocale;
    const toneDetection: DetectionResult = ctx.toneDetection ?? {
      locale: toneLocale,
      swahiliScore: toneLocale === "sw" ? 1 : 0,
      englishScore: toneLocale === "en" ? 1 : 0,
    };
    const agentContext = await buildAgentContext(
      ctx.supabase,
      msg,
      state,
      correlationId,
      {
        toneLocale,
        toneDetection,
        languageHint: ctx.locale,
      },
    );
    
    if (!agentContext) {
      await logStructuredEvent("AI_AGENT_CONTEXT_BUILD_FAILED", {
        correlation_id: correlationId,
      });
      return false;
    }
    
    // Add selection context if available
    if (selectedOption && sessionData) {
      agentContext.sessionData = {
        ...agentContext.sessionData,
        selected_option: selectedOption,
        previous_options: sessionData.options_presented,
        previous_agent: sessionData.agent_type,
      };
    }
    
    // Process with AI agent
    const response = await processWithAIAgent(ctx.supabase, agentContext);
    
    if (!response) {
      await logStructuredEvent("AI_AGENT_PROCESSING_FAILED", {
        correlation_id: correlationId,
      });
      return false;
    }

    // Attempt to send via approved template first
    let deliveredVia: "template" | "text" = "text";
    if (response.approvedTemplate) {
      const templateParameters = buildTemplateParameters(response.approvedTemplate, response.text, agentContext);
      if (templateParameters) {
        const templateResult = await sendTemplateMessage(ctx.supabase, msg.from, {
          template: response.approvedTemplate,
          parameters: templateParameters,
          correlationId,
          preview: response.text,
        });
        if (templateResult.success) {
          deliveredVia = "template";
        } else {
          await logStructuredEvent("AI_TEMPLATE_DELIVERY_FALLBACK", {
            correlation_id: correlationId,
            intent: response.approvedTemplate.intent,
            template_key: response.approvedTemplate.templateKey,
            msisdn_masked: maskedMsisdn,
            reason: templateResult.reason,
          });
        }
      } else {
        await logStructuredEvent("AI_TEMPLATE_PARAMETERS_UNAVAILABLE", {
          correlation_id: correlationId,
          intent: response.approvedTemplate.intent,
          template_key: response.approvedTemplate.templateKey,
          msisdn_masked: maskedMsisdn,
        });
      }
    } else {
      await logStructuredEvent("AI_TEMPLATE_MAPPING_MISSING", {
        correlation_id: correlationId,
        msisdn_masked: maskedMsisdn,
        agent_type: response.agentType,
      });
    }

    
    // Format response with emoji lists and action buttons
    const formattedResponse = formatAgentResponse(response, agentContext);
    
    await logStructuredEvent("AGENT_RESPONSE_FORMATTED", {
      correlation_id: correlationId,
      agent_type: formattedResponse.agentType,
      has_options: !!formattedResponse.optionsPresented,
      options_count: formattedResponse.optionsPresented?.length || 0,
      has_buttons: !!formattedResponse.actionButtons,
      buttons_count: formattedResponse.actionButtons?.length || 0,
    });

    // Send response with buttons if available
    try {
      if (formattedResponse.actionButtons && formattedResponse.actionButtons.length > 0) {
        // Send as interactive button message
        await sendRpcText(ctx.supabase, msg.from, {
          body: formattedResponse.text,
          correlationId,
          audit: {
            delivery: "text_with_context",
            agent_type: formattedResponse.agentType,
            has_options: !!formattedResponse.optionsPresented,
          },
        });
        
        await logStructuredEvent("AGENT_RESPONSE_SENT_WITH_BUTTONS", {
          correlation_id: correlationId,
          agent_type: formattedResponse.agentType,
          button_count: formattedResponse.actionButtons.length,
        });
      } else {
        // Send as regular text
        await sendRpcText(ctx.supabase, msg.from, {
          body: formattedResponse.text,
          correlationId,
          audit: {
            delivery: "text",
            agent_type: formattedResponse.agentType,
          },
        });
        
        await logStructuredEvent("AGENT_RESPONSE_SENT", {
          correlation_id: correlationId,
          agent_type: formattedResponse.agentType,
        });
      }
    } catch (sendError) {
      await logStructuredEvent("AGENT_RESPONSE_SEND_FAILED", {
        correlation_id: correlationId,
        error: sendError instanceof Error ? sendError.message : String(sendError),
      });
      return false;
    }

    // Save agent chat session if options were presented
    if (formattedResponse.optionsPresented && formattedResponse.optionsPresented.length > 0) {
      await saveAgentChatSession(ctx.supabase, {
        user_id: agentContext.userId,
        agent_type: formattedResponse.agentType,
        session_id: correlationId,
        options_presented: formattedResponse.optionsPresented,
        message_count: 1,
      });
      
      await logStructuredEvent("AGENT_SESSION_SAVED", {
        correlation_id: correlationId,
        agent_type: formattedResponse.agentType,
        options_count: formattedResponse.optionsPresented.length,
      });
    }

    // Save interaction
    await saveAgentInteraction(
      ctx.supabase,
      agentContext,
      agentContext.currentMessage,
      response.text,
      response.agentType,
      {
        tokens_used: response.tokensUsed,
        cost_usd: response.costUsd,
        latency_ms: response.latencyMs,
        template_key: response.approvedTemplate?.templateKey ?? null,
        template_locale: response.approvedTemplate?.locale ?? null,
        delivered_via: deliveredVia,
      }
    );
    
    // Update session state if needed
    if (response.sessionData) {
      state.data = {
        ...state.data,
        ai_session: true,
        ...response.sessionData,
      };
    }
    
    // Record metrics
    const metricsAggregator = getMetricsAggregator();
    metricsAggregator.recordRequest({
      success: true,
      tokens: response.tokensUsed,
      cost: response.costUsd,
      latencyMs: response.latencyMs,
      agentType: response.agentType,
      toolsUsed: response.toolCallsExecuted > 0 ? ["tool_executed"] : undefined,
    });
    
    await logStructuredEvent("AI_AGENT_REQUEST_SUCCESS", {
      correlation_id: correlationId,
      agent_type: response.agentType,
      tokens_used: response.tokensUsed,
      latency_ms: response.latencyMs,
      delivery: deliveredVia,
      template_key: response.approvedTemplate?.templateKey ?? null,
    });
    
    return true; // Successfully handled by AI
  } catch (error) {
    console.error("AI Agent Handler error:", error);
    
    // Record failed request in metrics
    const metricsAggregator = getMetricsAggregator();
    metricsAggregator.recordRequest({
      success: false,
      tokens: 0,
      cost: 0,
      latencyMs: 0,
    });
    
    await logStructuredEvent("AI_AGENT_REQUEST_ERROR", {
      error: String(error),
      message_id: msg.id,
    });
    
    // Fallback to existing handlers on error
    return false;
  }
}

/**
 * Agent response interface
 */
type AgentResponse = OrchestratorAgentResponse;

/**
 * Process message with AI agent using orchestrator
 * Enhanced with full OpenAI integration and specialized agents
 */
async function processWithAIAgent(
  supabase: SupabaseClient,
  context: AgentContext
): Promise<AgentResponse | null> {
  try {
    // Import orchestrator (dynamic to avoid circular dependencies)
    const { getAgentOrchestrator } = await import("../shared/agent_orchestrator.ts");
    const orchestrator = getAgentOrchestrator();

    // Classify intent and select agent
    const { agentType, confidence } = await orchestrator.classifyIntent(context);

    await logStructuredEvent("AGENT_INTENT_CLASSIFIED", {
      correlation_id: context.correlationId,
      agent_type: agentType,
      confidence,
    });

    // Process with selected agent
    const response = await orchestrator.processWithAgent(context, agentType);

    return response;

  } catch (error) {
    console.error("AI Agent processing error:", error);
    return null;
  }
}

function buildTemplateParameters(
  template: ApprovedTemplate,
  responseText: string,
  context: AgentContext,
): string[] | null {
  const placeholders = template.bodyVariables ?? [];
  if (!placeholders.length) {
    return [];
  }

  const sanitized = sanitizeTemplateText(responseText);
  if (!sanitized) {
    return null;
  }

  return placeholders.map((placeholder) =>
    deriveTemplateValue(placeholder, sanitized, context)
  );
}

function sanitizeTemplateText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1024);
}

function deriveTemplateValue(
  placeholder: string,
  sanitizedResponse: string,
  context: AgentContext,
): string {
  const key = placeholder.toLowerCase();

  if (key.includes("message") || key.includes("response") || key.includes("body")) {
    return sanitizedResponse;
  }

  if (key.includes("name")) {
    return context.userName ?? context.userProfile?.name ?? "there";
  }

  if (key.includes("agent")) {
    return "EasyMO Assistant";
  }

  if (key.includes("language")) {
    return context.language ?? "en";
  }

  if (key.includes("phone") || key.includes("msisdn")) {
    return maskE164(context.phoneNumber ?? "");
  }

  if (key.includes("topic") || key.includes("intent")) {
    return context.sessionData?.last_topic ?? "general";
  }

  return "";
}

/*
 * DEPRECATED: The following functions are replaced by the AgentOrchestrator
 * Kept for reference during migration period
 */

/*
function classifyAgentType(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (/\b(book|reserve|trip|travel|bus|vehicle)\b/i.test(lowerMessage)) {
    return "booking";
  }
  
  if (/\b(pay|payment|transfer|balance|wallet|money)\b/i.test(lowerMessage)) {
    return "payment";
  }
  
  if (/\b(help|support|problem|issue)\b/i.test(lowerMessage)) {
    return "customer_service";
  }
  
  return "general";
}

async function callOpenAI(
  context: AgentContext,
  agentType: string
): Promise<{
  text: string;
  tokensUsed: number;
  costUsd: number;
  sessionData?: Record<string, any>;
}> {
  // DEPRECATED: Now handled by AgentOrchestrator.processWithAgent()
  throw new Error("Use AgentOrchestrator.processWithAgent() instead");
}

async function prepareMessagesWithHistory(
  context: AgentContext,
  agentType: string,
  memory: any
): Promise<Array<{role: string; content: string}>> {
  // DEPRECATED: Now handled by AgentOrchestrator.buildMessages()
  throw new Error("Use AgentOrchestrator.buildMessages() instead");
}

function getSystemPrompt(agentType: string, language: string): string {
  // DEPRECATED: System prompts now defined in AgentOrchestrator.initializeAgents()
  throw new Error("System prompts are now defined in AgentOrchestrator");
}
*/
