/**
 * Agent Orchestrator
 * 
 * Central hub for managing multiple specialized agents
 * Routes messages to appropriate agents based on intent
 * Handles agent-to-agent handoffs and conversation state
 * 
 * ADDITIVE ONLY - New file, complements existing ai_agent_handler.ts
 */

import type { SupabaseClient } from "../../_shared/supabase.ts";
import type { AgentContext } from "./agent_context.ts";
import type { ChatMessage, Tool, ToolCall } from "./openai_client.ts";
import { getOpenAIClient } from "./openai_client.ts";
import { getToolManager } from "./tool_manager.ts";
import { logStructuredEvent } from "../observe/log.ts";
import { getTemplateRegistry, type ApprovedTemplate } from "./template_registry.ts";
import { buildToneDirective } from "../../../../packages/localization/src/tone.ts";
import { AGENT_CONFIGURATIONS } from "./agent_configs.ts";

/**
 * Official 9 agents matching production agent_registry database.
 * 
 * Agent slug mapping (from removed agents):
 * - concierge-router → support
 * - mobility-orchestrator → rides
 * - pharmacy-agent → buy_and_sell
 * - hardware-agent → buy_and_sell
 * - shop-agent → buy_and_sell
 * - property-agent → real_estate
 * - legal-intake → buy_and_sell
 * - marketing-sales → sales_cold_caller
 * - marketplace → buy_and_sell (merged)
 * - business_broker → buy_and_sell (merged)
 * - sora-video → REMOVED
 * - locops → INTERNAL (not agent)
 * - analytics-risk → INTERNAL (not agent)
 * - payments-agent → INTERNAL (not agent)
 */
export type AgentType =
  | "farmer"           // Farmer AI Agent
  | "insurance"        // Insurance AI Agent
  | "sales_cold_caller" // Sales/Marketing Cold Caller AI Agent
  | "rides"            // Rides AI Agent
  | "jobs"             // Jobs AI Agent
  | "waiter"           // Waiter AI Agent
  | "real_estate"      // Real Estate AI Agent
  | "buy_and_sell"     // Buy & Sell AI Agent (unified commerce + business brokerage)
  | "support"          // Support AI Agent (includes concierge routing)
  // Deprecated types - kept for backward compatibility
  | "marketplace"      // DEPRECATED: Use buy_and_sell instead
  | "business_broker"; // DEPRECATED: Use buy_and_sell instead

export interface AgentConfig {
  id: string;
  type: AgentType;
  name: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  enabledTools: string[];
  priority: number;
  triggers: string[]; // Keywords that trigger this agent
}

export interface AgentResponse {
  text: string;
  agentType: AgentType;
  tokensUsed: number;
  costUsd: number;
  latencyMs: number;
  toolCallsExecuted: number;
  confidence: number;
  sessionData?: Record<string, any>;
  suggestedNextAgent?: AgentType;
  approvedTemplate?: ApprovedTemplate | null;
  // Chat-first architecture fields
  actionButtons?: Array<{ id: string; title: string }>;
  optionsPresented?: Array<{ id: string; title: string; description?: string }>;
  requiresSelection?: boolean;
}

export class AgentOrchestrator {
  private agents: Map<AgentType, AgentConfig> = new Map();
  private conversationAgents: Map<string, AgentType> = new Map(); // conversationId -> agentType
  private openai = getOpenAIClient();
  private toolManager = getToolManager();
  private templateRegistry = getTemplateRegistry();

  constructor() {
    this.initializeAgents();
  }

  /**
   * Initialize default agent configurations
   */
  private initializeAgents(): void {
    // Register all agents from centralized configuration
    for (const config of AGENT_CONFIGURATIONS) {
      this.registerAgent(config);
    }

    logStructuredEvent("agent_orchestrator_initialized", {
      agent_count: this.agents.size,
      agent_types: Array.from(this.agents.keys()),
    });
  }

  /**
   * Register an agent configuration
   */
  registerAgent(config: AgentConfig): void {
    this.agents.set(config.type, config);
  }

  /**
   * Classify user intent and select appropriate agent
   */
  async classifyIntent(
    context: AgentContext,
  ): Promise<{ agentType: AgentType; confidence: number }> {
    const message = context.currentMessage.toLowerCase();

    // Check for explicit agent triggers
    for (const [type, config] of this.agents.entries()) {
      for (const trigger of config.triggers) {
        if (message.includes(trigger.toLowerCase())) {
          return { agentType: type, confidence: 0.9 };
        }
      }
    }

    // Check conversation history for context
    const existingAgent = this.conversationAgents.get(context.conversationId);
    if (existingAgent && existingAgent !== "general") {
      // Continue with same agent if conversation is ongoing
      return { agentType: existingAgent, confidence: 0.7 };
    }

    // Use LLM for intent classification if no clear match
    try {
      const classification = await this.classifyWithLLM(context);
      return classification;
    } catch (error) {
      logStructuredEvent("INTENT_CLASSIFICATION_ERROR", {
        correlation_id: context.correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { agentType: "support", confidence: 0.5 };
    }
  }

  /**
   * Use LLM to classify intent
   */
  private async classifyWithLLM(
    context: AgentContext,
  ): Promise<{ agentType: AgentType; confidence: number }> {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `Classify the user's intent into one of these agent categories:
- farmer: Agricultural produce, farming, crops, harvest
- insurance: Insurance quotes, claims, policies, coverage
- sales_cold_caller: Marketing, campaigns, sales outreach
- rides: Transportation, trips, drivers, passengers, mobility
- jobs: Employment, job search, hiring, gigs
- waiter: Restaurant, bar, dining, food ordering, menu
- real_estate: Property, rentals, housing, apartments
- buy_and_sell: Shopping, products, pharmacy, hardware, groceries, business sales, acquisitions, legal services
- support: Help, account issues, technical problems, general questions

Respond with just the agent type (e.g., "rides").`,
        tool_calls: undefined,
        tool_call_id: undefined,
        name: undefined,
      },
      {
        role: "user",
        content: `Message: "${context.currentMessage}"\nContext: ${
          context.sessionData?.last_topic || "none"
        }`,
        tool_calls: undefined,
        tool_call_id: undefined,
        name: undefined,
      },
    ];

    const response = await this.openai.createChatCompletion({
      messages,
      model: "gpt-5"  // Per README.md: Mandatory GPT-5,
      temperature: 0.3,
      max_tokens: 50,
      user: context.userId,
    }, context.correlationId);

    const agentType = (response.text?.trim() || "general") as AgentType;
    const confidence = 0.8; // LLM classification confidence

    return { agentType, confidence };
  }

  /**
   * Process message with selected agent
   */
  async processWithAgent(
    context: AgentContext,
    agentType: AgentType,
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    const agent = this.agents.get(agentType);

    if (!agent) {
      throw new Error(`Agent not found: ${agentType}`);
    }

    await logStructuredEvent("AGENT_PROCESSING_START", {
      correlation_id: context.correlationId,
      agent_type: agentType,
      agent_id: agent.id,
      message_length: context.currentMessage.length,
    });

    // Track agent for this conversation
    this.conversationAgents.set(context.conversationId, agentType);

    // Build messages with conversation history
    const messages = await this.buildMessages(context, agent);

    // Get available tools for this agent
    const tools = await this.getAgentTools(agent);

    // Execute LLM call
    let response = await this.openai.createChatCompletion({
      messages,
      model: "gpt-5"  // Per README.md: Mandatory GPT-5,
      temperature: agent.temperature,
      max_tokens: agent.maxTokens,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? "auto" : undefined,
      user: context.userId,
    }, context.correlationId);

    let toolCallsExecuted = 0;
    let attempts = 0;
    const maxAttempts = 5; // Prevent infinite tool calling loops

    // Handle tool calls
    while (
      response.tool_calls && response.tool_calls.length > 0 &&
      attempts < maxAttempts
    ) {
      attempts++;

      // Execute each tool call
      for (const toolCall of response.tool_calls) {
        try {
          const result = await this.toolManager.executeTool(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
            {
              supabase: context.supabase,
              userId: context.userId,
              correlationId: context.correlationId,
            },
          );

          // Add tool result to messages
          messages.push({
            role: "assistant",
            content: null,
            tool_calls: [toolCall],
            tool_call_id: undefined,
            name: undefined,
          });

          messages.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            tool_calls: undefined,
          });

          toolCallsExecuted++;
        } catch (error) {
          messages.push({
            role: "tool",
            content: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            tool_calls: undefined,
          });
        }
      }

      // Get next response
      response = await this.openai.createChatCompletion({
        messages,
        model: "gpt-5"  // Per README.md: Mandatory GPT-5,
        temperature: agent.temperature,
        max_tokens: agent.maxTokens,
        tools,
        tool_choice: "auto",
        user: context.userId,
      }, context.correlationId);
    }

    const latencyMs = Date.now() - startTime;

    await logStructuredEvent("AGENT_PROCESSING_COMPLETE", {
      correlation_id: context.correlationId,
      agent_type: agentType,
      latency_ms: latencyMs,
      tokens_used: response.usage.total_tokens,
      sessionData: {
        last_agent: agentType,
        last_topic: this.extractTopic(context.currentMessage),
      },
    });
  }

  /**
   * Build message history for agent
   */
  private async buildMessages(
    context: AgentContext,
    agent: AgentConfig,
  ): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];

    // Add system prompt enriched with tone guidance
    const toneDetection = context.toneDetection ?? {
      locale: context.toneLocale ?? "en",
      swahiliScore: context.toneLocale === "sw" ? 1 : 0,
      englishScore: context.toneLocale === "en" ? 1 : 0,
    };
    const toneDirective = buildToneDirective(toneDetection);
    const languageReminder = toneDetection.locale === "sw"
      ? "Write your replies fully in Kiswahili unless the farmer switches back to English."
      : "Respond in natural English while mirroring any Kiswahili phrases the user sends.";
    const promptContent = `${agent.systemPrompt}\n\n${toneDirective}\n\n${languageReminder}`.trim();
    messages.push({
      role: "system",
      content: promptContent,
      tool_calls: undefined,
      tool_call_id: undefined,
      name: undefined,
    });

    // Add conversation history (last 5 messages)
    for (const histMsg of context.messageHistory.slice(-5)) {
      messages.push({
        role: histMsg.role,
        content: histMsg.content,
        tool_calls: undefined,
        tool_call_id: undefined,
        name: undefined,
      });
    }

    // Add current message
    messages.push({
      role: "user",
      content: context.currentMessage,
      tool_calls: undefined,
      tool_call_id: undefined,
      name: undefined,
    });

    return messages;
  }

  /**
   * Get tools available for agent
   */
  private async getAgentTools(agent: AgentConfig): Promise<Tool[]> {
    const tools: Tool[] = [];

    for (const toolName of agent.enabledTools) {
      const toolDef = await this.toolManager.getToolDefinition(toolName);
      if (toolDef) {
        tools.push(toolDef);
      }
    }

    return tools;
  }

  /**
   * Extract topic from message
   */
  private extractTopic(message: string): string {
    const topics = [
      "booking",
      "wallet",
      "marketplace",
      "support",
      "balance",
      "trip",
      "payment",
    ];
    const lowerMessage = message.toLowerCase();

    for (const topic of topics) {
      if (lowerMessage.includes(topic)) {
        return topic;
      }
    }

    return "general";
  }

  /**
   * Transfer conversation to different agent
   */
  transferToAgent(conversationId: string, agentType: AgentType): void {
    this.conversationAgents.set(conversationId, agentType);

    logStructuredEvent("AGENT_TRANSFER", {
      conversation_id: conversationId,
      new_agent: agentType,
    });
  }

  /**
   * End conversation and cleanup
   */
  endConversation(conversationId: string): void {
    this.conversationAgents.delete(conversationId);

    logStructuredEvent("CONVERSATION_ENDED", {
      conversation_id: conversationId,
    });
  }

  private async attachTemplateMetadata(
    context: AgentContext,
    agentType: AgentType,
    response: AgentResponse,
  ): Promise<AgentResponse> {
    try {
      const localeHint = context.userProfile?.language || context.sessionData?.preferred_language || context.language;
      const template = await this.templateRegistry.get(
        context.supabase,
        agentType,
        localeHint,
      );
      return { ...response, approvedTemplate: template };
    } catch (error) {
      await logStructuredEvent("AI_TEMPLATE_ATTACH_FAILED", {
        agent_type: agentType,
        correlation_id: context.correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { ...response, approvedTemplate: null };
    }
  }
}

/**
 * Singleton instance
 */
let orchestratorInstance: AgentOrchestrator | null = null;

export function getAgentOrchestrator(): AgentOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new AgentOrchestrator();
  }
  return orchestratorInstance;
}
