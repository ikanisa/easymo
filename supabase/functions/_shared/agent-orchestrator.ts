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
  location?: { latitude: number; longitude: number };
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
    
    // 2. Handle location messages - Save to cache for 30 minutes
    if (message.type === "location" && message.location) {
      await this.saveLocationToCache(user.id, message.location.latitude, message.location.longitude);
      console.log(JSON.stringify({
        event: "LOCATION_CACHED",
        correlationId,
        userId: user.id,
        lat: message.location.latitude,
        lng: message.location.longitude,
      }));
    }
    
    // 3. Determine which agent to route to (based on context or default)
    const agentSlug = await this.determineAgent(user.id, message.body);
    
    // 4. Get or create chat session for session persistence
    const sessionId = await this.getOrCreateChatSession(message.from, agentSlug, user.id);
    
    // 5. Get or create conversation (for existing workflow compatibility)
    const context = await this.getOrCreateConversation(user.id, agentSlug);
    
    // 6. Store the message in session history
    await this.addMessageToSession(sessionId, "user", message.body || "[Location shared]");
    
    // 7. Store the message
    const messageId = await this.storeMessage(context.conversationId, message);
    
    // 8. Get conversation history for context
    const conversationHistory = await this.getSessionHistory(sessionId);
    
    // 9. Parse intent from message with conversation context
    const intent = await this.parseIntent(message.body || "location_shared", context, conversationHistory);
    
    // 10. Store intent
    const intentId = await this.storeIntent(
      context,
      messageId,
      intent
    );
    
    // 11. Execute agent action based on intent
    await this.executeAgentAction(context, intentId, intent);
    
    // 12. Send response back to user and get the response text for session history
    const responseText = await this.sendResponse(context, intent);
    
    // 13. Store response in session history
    await this.addMessageToSession(sessionId, "assistant", responseText);
    
    console.log(JSON.stringify({
      event: "AGENT_MESSAGE_PROCESSED",
      correlationId,
      agentSlug,
      intentType: intent.type,
      confidence: intent.confidence,
      sessionId,
    }));
  }

  /**
   * Get or create a chat session for session persistence
   */
  private async getOrCreateChatSession(
    userPhone: string,
    agentType: string,
    userId?: string
  ): Promise<string> {
    try {
      // Try using the RPC function
      const { data, error } = await this.supabase.rpc("get_or_create_agent_session", {
        p_user_phone: userPhone,
        p_agent_type: agentType,
        p_user_id: userId || null,
        p_agent_id: null
      });
      
      if (error) {
        console.warn("Failed to get/create session via RPC:", error.message);
        // Fallback to direct query
        return await this.fallbackGetOrCreateSession(userPhone, agentType, userId);
      }
      
      return data;
    } catch (error) {
      console.warn("Session RPC error:", error);
      return await this.fallbackGetOrCreateSession(userPhone, agentType, userId);
    }
  }

  /**
   * Fallback method to get or create session without RPC
   */
  private async fallbackGetOrCreateSession(
    userPhone: string,
    agentType: string,
    userId?: string
  ): Promise<string> {
    // Check for existing active session
    const { data: existing } = await this.supabase
      .from("agent_chat_sessions")
      .select("id")
      .eq("user_phone", userPhone)
      .eq("agent_type", agentType)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .single();
    
    if (existing) {
      // Update last_message_at
      await this.supabase
        .from("agent_chat_sessions")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", existing.id);
      return existing.id;
    }
    
    // Create new session
    const { data: newSession } = await this.supabase
      .from("agent_chat_sessions")
      .insert({
        user_phone: userPhone,
        user_id: userId || null,
        agent_type: agentType,
        status: "active"
      })
      .select("id")
      .single();
    
    return newSession?.id || crypto.randomUUID();
  }

  /**
   * Add message to session history
   */
  private async addMessageToSession(
    sessionId: string,
    role: "user" | "assistant" | "system",
    content: string
  ): Promise<void> {
    try {
      // Try using the RPC function
      await this.supabase.rpc("add_agent_message", {
        p_session_id: sessionId,
        p_role: role,
        p_content: content,
        p_metadata: {}
      });
    } catch (error) {
      // Fallback: update directly
      const { data: session } = await this.supabase
        .from("agent_chat_sessions")
        .select("conversation_history")
        .eq("id", sessionId)
        .single();
      
      if (session) {
        const history = session.conversation_history || [];
        history.push({
          role,
          content,
          timestamp: new Date().toISOString()
        });
        
        await this.supabase
          .from("agent_chat_sessions")
          .update({ 
            conversation_history: history,
            last_message_at: new Date().toISOString()
          })
          .eq("id", sessionId);
      }
    }
  }

  /**
   * Get session conversation history
   */
  private async getSessionHistory(sessionId: string): Promise<Array<{ role: string; content: string }>> {
    try {
      const { data } = await this.supabase.rpc("get_agent_conversation", {
        p_session_id: sessionId,
        p_limit: 10
      });
      
      return data?.messages || [];
    } catch (error) {
      // Fallback: query directly
      const { data: session } = await this.supabase
        .from("agent_chat_sessions")
        .select("conversation_history")
        .eq("id", sessionId)
        .single();
      
      if (session?.conversation_history) {
        return session.conversation_history.slice(-10);
      }
      
      return [];
    }
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
   * Save user's location to cache (30-minute TTL)
   * Used when user shares GPS coordinates
   */
  private async saveLocationToCache(
    userId: string,
    lat: number,
    lng: number
  ): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('update_user_location_cache', {
        _user_id: userId,
        _lat: lat,
        _lng: lng,
      });
      
      if (error) {
        console.error(JSON.stringify({
          event: "LOCATION_CACHE_SAVE_FAILED",
          userId,
          error: error.message,
        }));
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: "LOCATION_CACHE_SAVE_ERROR",
        userId,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
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
    
    // Rides keywords (highest priority - time-sensitive)
    if (lowerBody.includes("ride") || lowerBody.includes("driver") || lowerBody.includes("passenger") || 
        lowerBody.includes("pick") || lowerBody.includes("drop") || lowerBody.includes("take me") ||
        lowerBody.includes("need transport") || lowerBody.includes("going to")) {
      return "rides";
    }
    
    // Insurance keywords
    if (lowerBody.includes("insurance") || lowerBody.includes("certificate") || 
        lowerBody.includes("carte jaune") || lowerBody.includes("policy") || 
        lowerBody.includes("cover") || lowerBody.includes("insure")) {
      return "insurance";
    }
    
    // Waiter keywords
    if (lowerBody.includes("menu") || lowerBody.includes("food") || lowerBody.includes("order")) {
      return "waiter";
    }
    
    // Jobs keywords
    if (lowerBody.includes("job") || lowerBody.includes("work") || lowerBody.includes("employ")) {
      return "jobs";
    }
    
    // Real Estate keywords
    if (lowerBody.includes("property") || lowerBody.includes("house") || lowerBody.includes("apartment") || lowerBody.includes("rent")) {
      return "real_estate";
    }
    
    // Farmer keywords
    if (lowerBody.includes("farm") || lowerBody.includes("produce") || lowerBody.includes("crop")) {
      return "farmer";
    }
    
    // Business Broker keywords
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
    context: AgentContext,
    conversationHistory?: Array<{ role: string; content: string }>
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
    
    // Use simple keyword matching with conversation context
    // (Production would use LLM with full conversation history)
    const intent = await this.simpleIntentParse(messageBody, context.agentSlug, conversationHistory);
    
    return intent;
  }

  /**
   * Simple intent parsing (placeholder for LLM integration)
   */
  private async simpleIntentParse(
    messageBody: string,
    agentSlug: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<ParsedIntent> {
    const lowerBody = messageBody.toLowerCase();
    
    // Use conversation history for context (e.g., follow-up questions)
    const hasRecentContext = conversationHistory && conversationHistory.length > 0;
    const lastAssistantMessage = conversationHistory?.filter(m => m.role === "assistant").pop()?.content || "";

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
      
      case "rides":
        if (lowerBody.includes("need") && (lowerBody.includes("ride") || lowerBody.includes("driver"))) {
          return {
            type: "find_driver",
            summary: `User needs a ride: ${messageBody}`,
            structuredPayload: this.extractRideParams(messageBody),
            confidence: 0.90,
          };
        }
        if (lowerBody.includes("passenger") || lowerBody.includes("looking for") || lowerBody.includes("empty seats")) {
          return {
            type: "find_passenger",
            summary: `Driver looking for passengers: ${messageBody}`,
            structuredPayload: this.extractRideParams(messageBody),
            confidence: 0.85,
          };
        }
        if (lowerBody.includes("schedule") || lowerBody.includes("book") || lowerBody.includes("tomorrow")) {
          return {
            type: "schedule_trip",
            summary: `User wants to schedule a trip: ${messageBody}`,
            structuredPayload: this.extractRideParams(messageBody),
            confidence: 0.85,
          };
        }
        if (lowerBody.includes("cancel") || lowerBody.includes("change")) {
          return {
            type: "cancel_trip",
            summary: `User wants to cancel/modify trip`,
            structuredPayload: {},
            confidence: 0.90,
          };
        }
        break;
      
      case "insurance":
        if (lowerBody.includes("upload") || lowerBody.includes("send") || lowerBody.includes("certificate") || lowerBody.includes("carte jaune")) {
          return {
            type: "submit_documents",
            summary: `User wants to submit insurance documents`,
            structuredPayload: {},
            confidence: 0.90,
          };
        }
        if (lowerBody.includes("quote") || lowerBody.includes("new") || lowerBody.includes("how much") || lowerBody.includes("cost")) {
          return {
            type: "get_quote",
            summary: `User wants insurance quote: ${messageBody}`,
            structuredPayload: this.extractInsuranceParams(messageBody),
            confidence: 0.85,
          };
        }
        if (lowerBody.includes("renew") || lowerBody.includes("extend") || lowerBody.includes("expir")) {
          return {
            type: "renew_policy",
            summary: `User wants to renew insurance policy`,
            structuredPayload: {},
            confidence: 0.90,
          };
        }
        if (lowerBody.includes("status") || lowerBody.includes("check") || lowerBody.includes("progress")) {
          return {
            type: "track_status",
            summary: `User checking insurance status`,
            structuredPayload: {},
            confidence: 0.85,
          };
        }
        break;
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
   * Extract ride parameters from message
   */
  private extractRideParams(message: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    
    // Extract locations (from X to Y)
    const fromToMatch = message.match(/from\s+([^to]+?)\s+to\s+(.+?)(?:\s|$|,|\.)/i);
    if (fromToMatch) {
      params.pickup_address = fromToMatch[1].trim();
      params.dropoff_address = fromToMatch[2].trim();
    }
    
    // Extract "take me to X" pattern
    const takeMeMatch = message.match(/take\s+me\s+to\s+(.+?)(?:\s|$|,|\.)/i);
    if (takeMeMatch) {
      params.dropoff_address = takeMeMatch[1].trim();
    }
    
    // Extract time indicators
    if (message.toLowerCase().includes("now") || message.toLowerCase().includes("immediately")) {
      params.scheduled_at = null;
      params.urgent = true;
    }
    
    if (message.toLowerCase().includes("tomorrow")) {
      params.scheduled_at = "tomorrow";
    }
    
    // Extract time (e.g., "at 3pm", "3:00")
    const timeMatch = message.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      params.scheduled_time = timeMatch[0].trim();
    }
    
    return params;
  }

  /**
   * Extract insurance parameters from message
   */
  private extractInsuranceParams(message: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    
    // Extract vehicle info
    const plateMatch = message.match(/(?:plate|number|registration)\s*:?\s*([A-Z0-9]+)/i);
    if (plateMatch) {
      params.vehicle_identifier = plateMatch[1];
    }
    
    // Extract vehicle type
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes("car") || lowerMsg.includes("vehicle")) {
      params.vehicle_type = "car";
    } else if (lowerMsg.includes("moto") || lowerMsg.includes("bike")) {
      params.vehicle_type = "motorcycle";
    } else if (lowerMsg.includes("truck")) {
      params.vehicle_type = "truck";
    }
    
    // Extract insurance type
    if (lowerMsg.includes("third party") || lowerMsg.includes("tiers")) {
      params.insurance_type = "third_party";
    } else if (lowerMsg.includes("comprehensive") || lowerMsg.includes("tous risques")) {
      params.insurance_type = "comprehensive";
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
      case "rides":
        await this.executeRidesAgentAction(context, intentId, intent);
        break;
      case "insurance":
        await this.executeInsuranceAgentAction(context, intentId, intent);
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
   * Rides agent actions
   */
  private async executeRidesAgentAction(
    context: AgentContext,
    intentId: string,
    intent: ParsedIntent
  ): Promise<void> {
    console.log(JSON.stringify({
      event: "RIDES_ACTION_REQUESTED",
      intentType: intent.type,
      params: intent.structuredPayload,
    }));

    if (intent.type === "find_driver") {
      // Create ride request
      // TODO: Query rides_driver_status for online drivers nearby
      // TODO: Create ai_agent_match_events with compatible drivers
    } else if (intent.type === "find_passenger") {
      // Find passengers along route
      // TODO: Query rides_trips for pending requests
      // TODO: Create matches
    } else if (intent.type === "schedule_trip") {
      // Create scheduled trip
      // TODO: Insert into rides_trips with scheduled_at
    } else if (intent.type === "cancel_trip") {
      // Cancel existing trip
      // TODO: Update rides_trips status to 'cancelled'
    }
  }

  /**
   * Insurance agent actions
   */
  private async executeInsuranceAgentAction(
    context: AgentContext,
    intentId: string,
    intent: ParsedIntent
  ): Promise<void> {
    console.log(JSON.stringify({
      event: "INSURANCE_ACTION_REQUESTED",
      intentType: intent.type,
      params: intent.structuredPayload,
    }));

    if (intent.type === "submit_documents") {
      // Guide user through document upload
      // TODO: Store in insurance_documents
    } else if (intent.type === "get_quote") {
      // Create quote request
      // TODO: Insert into insurance_quote_requests
    } else if (intent.type === "renew_policy") {
      // Initiate renewal
      // TODO: Query existing policies, create renewal request
    } else if (intent.type === "track_status") {
      // Check status
      // TODO: Query insurance_quote_requests for user
    }
  }

  /**
   * Send response back to user via WhatsApp
   * Returns the response text for session history
   */
  private async sendResponse(
    context: AgentContext,
    intent: ParsedIntent
  ): Promise<string> {
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
    
    return responseText;
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
      
      // Rides agent responses
      case "find_driver":
        return `🚗 Finding a driver for you...\n\n` +
               `Pickup: ${intent.structuredPayload.pickup_address || "Your location"}\n` +
               `Drop-off: ${intent.structuredPayload.dropoff_address || "Not specified"}\n\n` +
               `Searching nearby drivers... ⏱️`;
      
      case "find_passenger":
        return `👥 Looking for passengers along your route...\n\n` +
               `I'll find people going the same way! 🚙`;
      
      case "schedule_trip":
        return `📅 Scheduling your trip...\n\n` +
               `Time: ${intent.structuredPayload.scheduled_time || intent.structuredPayload.scheduled_at}\n` +
               `I'll confirm the details soon! ⏰`;
      
      case "cancel_trip":
        return `❌ Canceling your trip...\n\n` +
               `I'll update the status and notify the other party. 📱`;
      
      // Insurance agent responses
      case "submit_documents":
        return `📄 Ready to receive your documents!\n\n` +
               `Please send:\n` +
               `1️⃣ Insurance certificate\n` +
               `2️⃣ Carte jaune\n` +
               `3️⃣ Vehicle photos (optional)\n\n` +
               `Send them one by one, I'll confirm each! ✅`;
      
      case "get_quote":
        return `💰 Creating your insurance quote request...\n\n` +
               `Vehicle: ${intent.structuredPayload.vehicle_type || "Not specified"}\n` +
               `Type: ${intent.structuredPayload.insurance_type || "Standard"}\n\n` +
               `A partner will contact you within 24 hours! 📞`;
      
      case "renew_policy":
        return `🔄 Initiating policy renewal...\n\n` +
               `I'll check your existing policy and prepare the renewal.\n` +
               `You'll hear from us soon! 📋`;
      
      case "track_status":
        return `📊 Checking your insurance status...\n\n` +
               `Let me pull up your requests... 🔍`;
      
      default:
        return `I understand you said: "${intent.summary}"\n\n` +
               `How can I help you today? 😊`;
    }
  }
}
