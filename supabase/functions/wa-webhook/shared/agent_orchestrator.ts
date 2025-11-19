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

export type AgentType =
  | "customer_service"
  | "booking"
  | "wallet"
  | "marketplace"
  | "support"
  | "general";

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
    // Customer Service Agent
    this.registerAgent({
      id: "cs-agent-01",
      type: "customer_service",
      name: "Customer Service Agent",
      systemPrompt: `You are a helpful customer service agent for EasyMO, a mobility platform in Rwanda.

Your responsibilities:
- Greet users warmly in their preferred language (English, French, Kinyarwanda)
- Answer general questions about EasyMO services
- Help with account issues
- Guide users to book trips, check wallet balance, or use marketplace
- Escalate complex issues to human support
- Always be empathetic, patient, and solution-oriented

Guidelines:
- Use simple, clear language
- Ask clarifying questions when needed
- Provide step-by-step instructions
- Offer to help with related tasks
- Keep responses concise (2-3 sentences max for WhatsApp)

Available services:
- Bus/taxi booking (route search, seat selection, payment)
- Wallet (balance, top-up, transfer)
- Marketplace (shop products, local services)
- Support (help, complaints, feedback)`,
      temperature: 0.7,
      maxTokens: 500,
      enabledTools: [
        "get_user_info",
        "search_help_articles",
        "create_support_ticket",
      ],
      priority: 1,
      triggers: [
        "help",
        "support",
        "problem",
        "issue",
        "question",
        "how",
        "what",
        "hello",
        "hi",
        "hey",
        "bonjour",
        "muraho",
      ],
    });

    // Booking Agent
    this.registerAgent({
      id: "booking-agent-01",
      type: "booking",
      name: "Travel Booking Agent",
      systemPrompt: `You are a travel booking specialist for EasyMO.

Your responsibilities:
- Help users search for bus/taxi routes
- Assist with trip booking (origin, destination, date, passengers)
- Show available seats and help with seat selection
- Process bookings and payments
- Provide trip details and confirmations
- Handle booking modifications and cancellations

Guidelines:
- Be efficient and accurate with travel information
- Always confirm details before booking
- Explain payment options clearly
- Provide booking confirmation with trip details
- Suggest alternative routes if needed

Use these tools:
- search_routes: Find available trips
- get_trip_details: Show trip information
- book_trip: Complete booking
- check_seat_availability: Show available seats`,
      temperature: 0.5,
      maxTokens: 600,
      enabledTools: [
        "search_routes",
        "get_trip_details",
        "book_trip",
        "check_seat_availability",
        "get_booking_history",
      ],
      priority: 2,
      triggers: [
        "book",
        "trip",
        "travel",
        "bus",
        "taxi",
        "route",
        "seat",
        "destination",
        "kigali",
        "gisenyi",
        "musanze",
      ],
    });

    // Wallet Agent
    this.registerAgent({
      id: "wallet-agent-01",
      type: "wallet",
      name: "Wallet & Payment Agent",
      systemPrompt: `You are a wallet and payment specialist for EasyMO.

Your responsibilities:
- Help users check wallet balance
- Process money transfers
- Assist with top-ups and withdrawals
- Show transaction history
- Handle payment issues
- Explain fees and limits

Guidelines:
- Be precise with monetary amounts
- Always confirm amounts before transfers
- Explain transaction status clearly
- Provide transaction IDs for reference
- Handle financial data with care (mask sensitive info in logs)

Security:
- Verify user identity for transactions
- Confirm recipient details before transfers
- Never share full account numbers in chat`,
      temperature: 0.3,
      maxTokens: 400,
      enabledTools: [
        "get_wallet_balance",
        "transfer_money",
        "get_transaction_history",
        "initiate_topup",
      ],
      priority: 2,
      triggers: [
        "balance",
        "wallet",
        "money",
        "transfer",
        "send",
        "pay",
        "payment",
        "cash",
        "franc",
        "rwf",
      ],
    });

    // Marketplace Agent
    this.registerAgent({
      id: "marketplace-agent-01",
      type: "marketplace",
      name: "Marketplace Agent",
      systemPrompt: `You are a marketplace shopping assistant for EasyMO.

Your responsibilities:
- Help users discover products and services
- Assist with searches and recommendations
- Provide product information and pricing
- Guide through purchasing process
- Handle orders and deliveries

Guidelines:
- Show relevant products based on user needs
- Provide clear pricing and delivery info
- Explain payment options
- Assist with order tracking`,
      temperature: 0.6,
      maxTokens: 500,
      enabledTools: [
        "search_marketplace",
        "get_product_details",
        "create_order",
        "track_order",
      ],
      priority: 3,
      triggers: [
        "shop",
        "buy",
        "product",
        "marketplace",
        "store",
        "order",
        "delivery",
        "price",
      ],
    });

    // General Agent (fallback)
    this.registerAgent({
      id: "general-agent-01",
      type: "general",
      name: "General Assistant",
      systemPrompt: `You are a general assistant for EasyMO.

Handle general queries and route users to specialized services:
- Greetings and small talk
- General information about EasyMO
- Guidance to specific services (booking, wallet, marketplace)
- FAQs and common questions

If user needs specific help:
- Booking: "I can help you book a trip. Where would you like to go?"
- Wallet: "I can help with your wallet. What would you like to do?"
- Shopping: "Check out our marketplace for products and services."
- Support: "I'll connect you with our support team."

Keep responses friendly, brief, and helpful.`,
      temperature: 0.8,
      maxTokens: 400,
      enabledTools: ["get_user_info", "search_help_articles"],
      priority: 10, // Lowest priority (fallback)
      triggers: [], // Catches everything not matched by other agents
    });

    logStructuredEvent("AGENT_ORCHESTRATOR_INITIALIZED", {
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
      return { agentType: "general", confidence: 0.5 };
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
        content: `Classify the user's intent into one of these categories:
- customer_service: General help, questions, account issues
- booking: Trip booking, route search, travel planning
- wallet: Balance, transfers, payments, transactions
- marketplace: Shopping, products, orders
- support: Technical issues, complaints, feedback
- general: Greetings, small talk, unclear intent

Respond with just the category name (e.g., "booking").`,
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
      model: "gpt-4o-mini",
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
      model: "gpt-4o-mini",
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
        model: "gpt-4o-mini",
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
      cost_usd: response.cost_usd,
      tool_calls: toolCallsExecuted,
    });

    return await this.attachTemplateMetadata(context, agentType, {
      text: response.text || "I apologize, I couldn't generate a response.",
      agentType,
      tokensUsed: response.usage.total_tokens,
      costUsd: response.cost_usd,
      latencyMs,
      toolCallsExecuted,
      confidence: 0.9,
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
