/**
 * AI Agent Handler
 * 
 * Routes WhatsApp messages to AI agents for intelligent processing
 * Falls back to existing handlers if AI is not applicable
 * 
 * This handler respects the additive-only guards by:
 * - Being a completely new file
 * - Not modifying existing handlers
 * - Providing fallback to existing flows
 */

import type { SupabaseClient } from "../../_shared/supabase.ts";
import type { WhatsAppMessage } from "../types.ts";
import type { ChatState } from "../state/store.ts";
import type { RouterContext } from "../types.ts";

import { buildAgentContext, saveAgentInteraction, type AgentContext } from "../shared/agent_context.ts";
import { logStructuredEvent } from "../observe/log.ts";
import { sendText } from "../rpc/whatsapp.ts";
import { fetchFeatureFlag } from "../../_shared/feature-flags.ts";
import { AdvancedRateLimiter } from "../shared/advanced_rate_limiter.ts";
import { getConfig } from "../shared/config_manager.ts";
import { getMetricsAggregator, type RequestMetrics } from "../shared/metrics_aggregator.ts";

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
        phone_number: msg.from,
        retry_after: rateLimitResult.retryAfter,
        blacklisted: rateLimitResult.blacklisted,
      });
      
      // Send user-friendly rate limit message
      const message = rateLimitResult.blacklisted
        ? "⛔ Your account has been temporarily suspended due to excessive requests. Please try again later."
        : `⏰ You're sending messages too quickly. Please wait ${rateLimitResult.retryAfter}s before trying again.`;
      
      await sendText(ctx, msg.from, { body: message });
      
      return true; // Handled (rejected)
    }
    
    await logStructuredEvent("AI_AGENT_REQUEST_START", {
      correlation_id: correlationId,
      phone_number: msg.from,
      message_type: msg.type,
      rate_limit_remaining: rateLimitResult.remaining,
    });
    
    // Build agent context
    const agentContext = await buildAgentContext(
      ctx.supabase,
      msg,
      state,
      correlationId
    );
    
    if (!agentContext) {
      await logStructuredEvent("AI_AGENT_CONTEXT_BUILD_FAILED", {
        correlation_id: correlationId,
      });
      return false;
    }
    
    // Process with AI agent
    const response = await processWithAIAgent(ctx.supabase, agentContext);
    
    if (!response) {
      await logStructuredEvent("AI_AGENT_PROCESSING_FAILED", {
        correlation_id: correlationId,
      });
      return false;
    }
    
    // Send response to WhatsApp
    await sendText(ctx.supabase, msg.from, response.text);
    
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
interface AgentResponse {
  text: string;
  agentType: string;
  tokensUsed?: number;
  costUsd?: number;
  latencyMs?: number;
  sessionData?: Record<string, any>;
}

/**
 * Process message with AI agent using orchestrator
 * Enhanced with full OpenAI integration and specialized agents
 */
async function processWithAIAgent(
  supabase: SupabaseClient,
  context: AgentContext
): Promise<AgentResponse | null> {
  const startTime = Date.now();
  
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
    
    const latencyMs = Date.now() - startTime;
    
    return {
      text: response.text,
      agentType,
      tokensUsed: response.tokensUsed,
      costUsd: response.costUsd,
      latencyMs,
      sessionData: response.sessionData,
    };
    
  } catch (error) {
    console.error("AI Agent processing error:", error);
    return null;
  }
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
