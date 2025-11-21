/**
 * AI Agent Orchestrator - Core Logic
 * 
 * Manages WhatsApp message routing to appropriate AI agents,
 * intent parsing, and domain action execution.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Types from our schema
interface WhatsAppMessage {
  from: string;
  body: string;
  type: string;
  timestamp: string;
  id: string;
}

interface AgentContext {
  userId: string;
  agentId: string;
  conversationId: string;
  agentSlug: string;
  language: string;
}

interface ParsedIntent {
  type: string;
  subtype?: string;
  summary: string;
  structuredPayload: Record<string, unknown>;
  confidence: number;
}

export class AgentOrchestrator {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Main entry point: Process incoming WhatsApp message
   */
  async processMessage(message: WhatsAppMessage): Promise<void> {
    const correlationId = crypto.randomUUID();
    
    console.log(JSON.stringify({
      event: "AGENT_MESSAGE_RECEIVED",
      correlationId,
      from: message.from,
      messageType: message.type,
    }));

    // 1. Get or create WhatsApp user
    const user = await this.getOrCreateUser(message.from);
    
    // 2. Determine which agent to route to (based on context or default)
    const agentSlug = await this.determineAgent(user.id, message.body);
    
    // 3. Get or create conversation
    const context = await this.getOrCreateConversation(user.id, agentSlug);
    
    // 4. Store the message
    const messageId = await this.storeMessage(context.conversationId, message);
    
    // 5. Parse intent from message
    const intent = await this.parseIntent(message.body, context);
    
    // 6. Store intent
    const intentId = await this.storeIntent(
      context,
      messageId,
      intent
    );
    
    // 7. Execute agent action based on intent
    await this.executeAgentAction(context, intentId, intent);
    
    // 8. Send response back to user
    await this.sendResponse(context, intent);
    
    console.log(JSON.stringify({
      event: "AGENT_MESSAGE_PROCESSED",
      correlationId,
      agentSlug,
      intentType: intent.type,
      confidence: intent.confidence,
    }));
  }

  /**
   * Get or create WhatsApp user by phone number
   */
  private async getOrCreateUser(phoneNumber: string): Promise<{ id: string; preferredLanguage: string }> {
    const { data: existing } = await this.supabase
      .from("whatsapp_users")
      .select("id, preferred_language")
      .eq("phone_number", phoneNumber)
      .single();

    if (existing) {
      return existing;
    }

    const { data: newUser } = await this.supabase
      .from("whatsapp_users")
      .insert({
        phone_number: phoneNumber,
        preferred_language: "en",
        user_roles: ["guest"],
        metadata: {},
      })
      .select("id, preferred_language")
      .single();

    return newUser!;
  }

  /**
   * Determine which agent should handle this message
   * Can be based on:
   * - User's last active conversation
   * - Keywords in message
   * - User context/roles
   */
  private async determineAgent(userId: string, messageBody: string): Promise<string> {
    // Check for active conversation
    const { data: activeConv } = await this.supabase
      .from("whatsapp_conversations")
      .select("agent_id, ai_agents(slug)")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .single();

    if (activeConv?.ai_agents) {
      return (activeConv.ai_agents as { slug: string }).slug;
    }

    // Keyword-based routing
    const lowerBody = messageBody.toLowerCase();
    
    if (lowerBody.includes("menu") || lowerBody.includes("food") || lowerBody.includes("order")) {
      return "waiter";
    }
    if (lowerBody.includes("job") || lowerBody.includes("work") || lowerBody.includes("employ")) {
      return "jobs";
    }
    if (lowerBody.includes("property") || lowerBody.includes("house") || lowerBody.includes("apartment") || lowerBody.includes("rent")) {
      return "real_estate";
    }
    if (lowerBody.includes("farm") || lowerBody.includes("produce") || lowerBody.includes("crop")) {
      return "farmer";
    }
    if (lowerBody.includes("business") || lowerBody.includes("shop") || lowerBody.includes("service")) {
      return "business_broker";
    }

    // Default to jobs agent (most common use case)
    return "jobs";
  }

  /**
   * Get or create conversation for user × agent
   */
  private async getOrCreateConversation(
    userId: string,
    agentSlug: string
  ): Promise<AgentContext> {
    // Get agent
    const { data: agent } = await this.supabase
      .from("ai_agents")
      .select("id, default_language")
      .eq("slug", agentSlug)
      .eq("is_active", true)
      .single();

    if (!agent) {
      throw new Error(`Agent not found: ${agentSlug}`);
    }

    // Check for existing active conversation
    const { data: existing } = await this.supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("agent_id", agent.id)
      .eq("status", "active")
      .single();

    if (existing) {
      // Update last_message_at
      await this.supabase
        .from("whatsapp_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", existing.id);

      return {
        userId,
        agentId: agent.id,
        conversationId: existing.id,
        agentSlug,
        language: agent.default_language,
      };
    }

    // Create new conversation
    const { data: newConv } = await this.supabase
      .from("whatsapp_conversations")
      .insert({
        user_id: userId,
        agent_id: agent.id,
        context: agentSlug,
        status: "active",
        last_message_at: new Date().toISOString(),
        metadata: {},
      })
      .select("id")
      .single();

    return {
      userId,
      agentId: agent.id,
      conversationId: newConv!.id,
      agentSlug,
      language: agent.default_language,
    };
  }

  /**
   * Store WhatsApp message in database
   */
  private async storeMessage(
    conversationId: string,
    message: WhatsAppMessage
  ): Promise<string> {
    const { data } = await this.supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversationId,
        direction: "inbound",
        wa_message_id: message.id,
        message_type: message.type,
        body: message.body,
        payload: message,
        sent_at: message.timestamp,
      })
      .select("id")
      .single();

    return data!.id;
  }

  /**
   * Parse intent from user message using LLM
   */
  private async parseIntent(
    messageBody: string,
    context: AgentContext
  ): Promise<ParsedIntent> {
    // Get agent's system instructions
    const { data: agent } = await this.supabase
      .from("ai_agents")
      .select(`
        default_system_instruction_code,
        ai_agent_system_instructions!inner(instructions, guardrails)
      `)
      .eq("id", context.agentId)
      .single();

    const systemInstructions = (agent as any)?.ai_agent_system_instructions;
    
    // Use OpenAI/Gemini to parse intent
    // For now, use simple keyword matching (production would use LLM)
    const intent = await this.simpleIntentParse(messageBody, context.agentSlug);
    
    return intent;
  }

  /**
   * Simple intent parsing (placeholder for LLM integration)
   */
  private async simpleIntentParse(
    messageBody: string,
    agentSlug: string
  ): Promise<ParsedIntent> {
    const lowerBody = messageBody.toLowerCase();

    switch (agentSlug) {
      case "jobs":
        if (lowerBody.includes("find") || lowerBody.includes("search")) {
          return {
            type: "search_jobs",
            summary: `User searching for jobs: ${messageBody}`,
            structuredPayload: this.extractJobSearchParams(messageBody),
            confidence: 0.85,
          };
        }
        if (lowerBody.includes("post") || lowerBody.includes("hire")) {
          return {
            type: "post_job",
            summary: `User wants to post a job`,
            structuredPayload: {},
            confidence: 0.75,
          };
        }
        break;

      case "real_estate":
        if (lowerBody.includes("find") || lowerBody.includes("search") || lowerBody.includes("bedroom")) {
          return {
            type: "search_property",
            summary: `User searching for property: ${messageBody}`,
            structuredPayload: this.extractPropertySearchParams(messageBody),
            confidence: 0.85,
          };
        }
        break;

      case "waiter":
        if (lowerBody.includes("order") || lowerBody.includes("want")) {
          return {
            type: "order_food",
            summary: `User wants to order: ${messageBody}`,
            structuredPayload: { items: [] },
            confidence: 0.80,
          };
        }
        if (lowerBody.includes("menu")) {
          return {
            type: "view_menu",
            summary: `User wants to see menu`,
            structuredPayload: {},
            confidence: 0.90,
          };
        }
        break;

      case "farmer":
        if (lowerBody.includes("sell") || lowerBody.includes("list")) {
          return {
            type: "list_produce",
            summary: `Farmer wants to list produce`,
            structuredPayload: {},
            confidence: 0.80,
          };
        }
        if (lowerBody.includes("buy") || lowerBody.includes("find")) {
          return {
            type: "search_produce",
            summary: `User searching for produce`,
            structuredPayload: {},
            confidence: 0.80,
          };
        }
        break;

      case "business_broker":
        return {
          type: "search_business",
          summary: `User searching for businesses: ${messageBody}`,
          structuredPayload: { query: messageBody },
          confidence: 0.85,
        };
    }

    return {
      type: "unknown",
      summary: messageBody,
      structuredPayload: {},
      confidence: 0.50,
    };
  }

  /**
   * Extract job search parameters from message
   */
  private extractJobSearchParams(message: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    
    // Extract location
    const locationMatch = message.match(/in\s+(\w+)/i);
    if (locationMatch) {
      params.location = locationMatch[1];
    }

    // Extract salary
    const salaryMatch = message.match(/(\d+)k/i);
    if (salaryMatch) {
      params.min_salary = parseInt(salaryMatch[1]) * 1000;
    }

    // Extract category from keywords
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes("software") || lowerMsg.includes("dev")) {
      params.category = "software";
    } else if (lowerMsg.includes("sales") || lowerMsg.includes("market")) {
      params.category = "sales";
    }

    return params;
  }

  /**
   * Extract property search parameters from message
   */
  private extractPropertySearchParams(message: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    
    // Extract bedrooms
    const bedroomMatch = message.match(/(\d+)\s*(?:bed|br|bedroom)/i);
    if (bedroomMatch) {
      params.bedrooms = parseInt(bedroomMatch[1]);
    }

    // Extract location
    const locationMatch = message.match(/in\s+(\w+)/i);
    if (locationMatch) {
      params.location = locationMatch[1];
    }

    // Extract budget
    const budgetMatch = message.match(/(\d+)k/i);
    if (budgetMatch) {
      params.max_monthly_rent = parseInt(budgetMatch[1]) * 1000;
    }

    return params;
  }

  /**
   * Store parsed intent in database
   */
  private async storeIntent(
    context: AgentContext,
    messageId: string,
    intent: ParsedIntent
  ): Promise<string> {
    const { data } = await this.supabase
      .from("ai_agent_intents")
      .insert({
        conversation_id: context.conversationId,
        agent_id: context.agentId,
        message_id: messageId,
        intent_type: intent.type,
        intent_subtype: intent.subtype,
        raw_text: null,
        summary: intent.summary,
        structured_payload: intent.structuredPayload,
        confidence: intent.confidence,
        status: "pending",
        metadata: {},
      })
      .select("id")
      .single();

    return data!.id;
  }

  /**
   * Execute agent-specific action based on intent
   */
  private async executeAgentAction(
    context: AgentContext,
    intentId: string,
    intent: ParsedIntent
  ): Promise<void> {
    console.log(JSON.stringify({
      event: "EXECUTING_AGENT_ACTION",
      agentSlug: context.agentSlug,
      intentType: intent.type,
      intentId,
    }));

    switch (context.agentSlug) {
      case "jobs":
        await this.executeJobsAgentAction(context, intentId, intent);
        break;
      case "real_estate":
        await this.executeRealEstateAgentAction(context, intentId, intent);
        break;
      case "waiter":
        await this.executeWaiterAgentAction(context, intentId, intent);
        break;
      case "farmer":
        await this.executeFarmerAgentAction(context, intentId, intent);
        break;
      case "business_broker":
        await this.executeBusinessBrokerAgentAction(context, intentId, intent);
        break;
      default:
        console.warn(`No action handler for agent: ${context.agentSlug}`);
    }

    // Mark intent as applied
    await this.supabase
      .from("ai_agent_intents")
      .update({
        status: "applied",
        applied_at: new Date().toISOString(),
      })
      .eq("id", intentId);
  }

  /**
   * Jobs agent actions
   */
  private async executeJobsAgentAction(
    context: AgentContext,
    intentId: string,
    intent: ParsedIntent
  ): Promise<void> {
    if (intent.type === "search_jobs") {
      // Search job_posts table (would need to exist)
      // For now, just log
      console.log(JSON.stringify({
        event: "JOBS_SEARCH_REQUESTED",
        params: intent.structuredPayload,
      }));
      
      // TODO: Query job_posts table and create match events
    }
  }

  /**
   * Real estate agent actions
   */
  private async executeRealEstateAgentAction(
    context: AgentContext,
    intentId: string,
    intent: ParsedIntent
  ): Promise<void> {
    if (intent.type === "search_property") {
      console.log(JSON.stringify({
        event: "PROPERTY_SEARCH_REQUESTED",
        params: intent.structuredPayload,
      }));
      
      // TODO: Query properties table and create match events
    }
  }

  /**
   * Waiter agent actions
   */
  private async executeWaiterAgentAction(
    context: AgentContext,
    intentId: string,
    intent: ParsedIntent
  ): Promise<void> {
    if (intent.type === "view_menu") {
      console.log(JSON.stringify({
        event: "MENU_VIEW_REQUESTED",
      }));
    } else if (intent.type === "order_food") {
      console.log(JSON.stringify({
        event: "FOOD_ORDER_REQUESTED",
        items: intent.structuredPayload.items,
      }));
    }
  }

  /**
   * Farmer agent actions
   */
  private async executeFarmerAgentAction(
    context: AgentContext,
    intentId: string,
    intent: ParsedIntent
  ): Promise<void> {
    console.log(JSON.stringify({
      event: "FARMER_ACTION_REQUESTED",
      intentType: intent.type,
    }));
  }

  /**
   * Business broker agent actions
   */
  private async executeBusinessBrokerAgentAction(
    context: AgentContext,
    intentId: string,
    intent: ParsedIntent
  ): Promise<void> {
    console.log(JSON.stringify({
      event: "BUSINESS_SEARCH_REQUESTED",
      query: intent.structuredPayload.query,
    }));
  }

  /**
   * Send response back to user via WhatsApp
   */
  private async sendResponse(
    context: AgentContext,
    intent: ParsedIntent
  ): Promise<void> {
    // Get agent persona for tone/style
    const { data: persona } = await this.supabase
      .from("ai_agent_personas")
      .select("role_name, tone_style")
      .eq("agent_id", context.agentId)
      .eq("is_default", true)
      .single();

    // Generate response based on intent
    const responseText = this.generateResponse(intent, persona);

    // Store outbound message
    await this.supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: context.conversationId,
        direction: "outbound",
        message_type: "text",
        body: responseText,
        payload: { generated: true },
        sent_at: new Date().toISOString(),
      });

    // TODO: Actually send via WhatsApp API
    console.log(JSON.stringify({
      event: "RESPONSE_GENERATED",
      agentSlug: context.agentSlug,
      intentType: intent.type,
      responseLength: responseText.length,
    }));
  }

  /**
   * Generate response text based on intent and persona
   */
  private generateResponse(
    intent: ParsedIntent,
    persona: { role_name: string; tone_style: string } | null
  ): string {
    const roleName = persona?.role_name || "Assistant";

    switch (intent.type) {
      case "search_jobs":
        return `🔍 Searching for jobs matching your criteria...\n\n` +
               `Looking for: ${JSON.stringify(intent.structuredPayload)}\n\n` +
               `I'll find the best matches for you! 💼`;
      
      case "search_property":
        return `🏠 Searching for properties...\n\n` +
               `Criteria: ${JSON.stringify(intent.structuredPayload)}\n\n` +
               `I'll show you the top 5 matches! 🔑`;
      
      case "view_menu":
        return `📋 Here's our menu:\n\n` +
               `(Menu items would appear here)\n\n` +
               `What would you like to order? 🍽️`;
      
      case "order_food":
        return `✅ Processing your order...\n\n` +
               `I'll confirm the details shortly! 👨‍🍳`;
      
      case "search_business":
        return `🏢 Searching local businesses...\n\n` +
               `Finding matches for: ${intent.structuredPayload.query}\n\n` +
               `Stand by for results! 📍`;
      
      default:
        return `I understand you said: "${intent.summary}"\n\n` +
               `How can I help you today? 😊`;
    }
  }
}
