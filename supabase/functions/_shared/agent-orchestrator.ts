/**
 * AI Agent Orchestrator - Core Logic
 * 
 * Manages WhatsApp message routing to appropriate AI agents,
 * intent parsing, and domain action execution.
 * 
 * NOW WITH DATABASE-DRIVEN CONFIGURATION & TOOL EXECUTION:
 * - Loads personas, system instructions, tools, tasks, KBs from database
 * - Caches configs for 5 minutes to reduce DB load
 * - Falls back to hardcoded configs if DB fails
 * - Executes tools with validation and logging
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { AgentConfigLoader, type AgentConfig } from "./agent-config-loader.ts";
import { ToolExecutor } from "./tool-executor.ts";

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
  private configLoader: AgentConfigLoader;
  private toolExecutor: ToolExecutor;

  constructor(private supabase: SupabaseClient) {
    this.configLoader = new AgentConfigLoader(supabase);
    this.toolExecutor = new ToolExecutor(supabase);
  }

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
      .select("id, language")
      .eq("phone", phoneNumber)
      .single();

    if (existing) {
      return { id: existing.id, preferredLanguage: existing.language };
    }

    const { data: newUser } = await this.supabase
      .from("whatsapp_users")
      .insert({
        phone: phoneNumber,
        language: "en",
      })
      .select("id, language")
      .single();

    return { id: newUser!.id, preferredLanguage: newUser!.language };
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
    
    // Rides keywords (highest priority - time-sensitive) → rides workflow
    if (lowerBody.includes("ride") || lowerBody.includes("driver") || lowerBody.includes("passenger") || 
        lowerBody.includes("pick") || lowerBody.includes("drop") || lowerBody.includes("take me") ||
        lowerBody.includes("need transport") || lowerBody.includes("going to")) {
      return "rides";
    }
    
    // Insurance keywords → insurance workflow
    if (lowerBody.includes("insurance") || lowerBody.includes("certificate") || 
        lowerBody.includes("carte jaune") || lowerBody.includes("policy") || 
        lowerBody.includes("cover") || lowerBody.includes("insure")) {
      return "insurance";
    }
    
    // All other queries → buy_sell agent (marketplace, business, general support)
    return "buy_sell";
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
   * NOW LOADS SYSTEM INSTRUCTIONS FROM DATABASE
   */
  private async parseIntent(
    messageBody: string,
    context: AgentContext,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<ParsedIntent> {
    // Load agent configuration from database
    const config = await this.configLoader.loadAgentConfig(context.agentSlug);
    
    // Log what we loaded
    console.log(JSON.stringify({
      event: "INTENT_PARSING_WITH_CONFIG",
      agentSlug: context.agentSlug,
      hasInstructions: !!config.systemInstructions,
      hasPersona: !!config.persona,
      toolsCount: config.tools.length,
      loadedFrom: config.loadedFrom,
    }));
    
    // Use system instructions if available
    const systemInstructions = config.systemInstructions?.instructions || null;
    const guardrails = config.systemInstructions?.guardrails || null;
    
    // Use simple keyword matching with conversation context
    // (Production would use LLM with full conversation history + system instructions)
    const intent = await this.simpleIntentParse(
      messageBody, 
      context.agentSlug, 
      conversationHistory,
      config
    );
    
    return intent;
  }

  /**
   * Simple intent parsing (placeholder for LLM integration)
   * NOW RECEIVES AGENT CONFIG WITH TOOLS AND TASKS
   */
  private async simpleIntentParse(
    messageBody: string,
    agentSlug: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    config?: AgentConfig
  ): Promise<ParsedIntent> {
    const lowerBody = messageBody.toLowerCase();
    
    // Use conversation history for context (e.g., follow-up questions)
    const hasRecentContext = conversationHistory && conversationHistory.length > 0;
    const lastAssistantMessage = conversationHistory?.filter(m => m.role === "assistant").pop()?.content || "";

    switch (agentSlug) {
      case "buy_sell":
        // Marketplace and business queries
        if (lowerBody.includes("buy") || lowerBody.includes("find") || lowerBody.includes("search")) {
          return {
            type: "search_products",
            summary: `User searching for products or businesses: ${messageBody}`,
            structuredPayload: { query: messageBody },
            confidence: 0.85,
          };
        }
        if (lowerBody.includes("sell") || lowerBody.includes("list")) {
          return {
            type: "create_listing",
            summary: `User wants to list product or business`,
            structuredPayload: {},
            confidence: 0.80,
          };
        }
        if (lowerBody.includes("business") || lowerBody.includes("shop") || lowerBody.includes("service")) {
          return {
            type: "search_business",
            summary: `User searching for businesses: ${messageBody}`,
            structuredPayload: { query: messageBody },
            confidence: 0.85,
          };
        }
        break;
      
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
   * NOW WITH TOOL EXECUTION FROM DATABASE
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

    // Load agent config to get available tools
    const config = await this.configLoader.loadAgentConfig(context.agentSlug);

    // Find tool that matches the intent type
    const tool = config.tools.find(t => 
      t.name === intent.type || 
      t.name.includes(intent.type) ||
      intent.type.includes(t.name)
    );

    if (tool) {
      // Execute the tool with structured payload as inputs
      const toolContext = {
        userId: context.userId,
        agentId: context.agentId,
        conversationId: context.conversationId,
        agentSlug: context.agentSlug,
      };

      const result = await this.toolExecutor.executeTool(
        tool,
        intent.structuredPayload,
        toolContext
      );

      console.log(JSON.stringify({
        event: "TOOL_EXECUTED_FOR_INTENT",
        toolName: tool.name,
        success: result.success,
        executionTime: result.executionTime,
      }));

      // Store tool result in intent metadata
      await this.supabase
        .from("ai_agent_intents")
        .update({
          metadata: {
            tool_executed: tool.name,
            tool_result: result.success ? result.data : null,
            tool_error: result.error,
          },
        })
        .eq("id", intentId);
    } else {
      // Fallback to legacy action handlers
      console.log(JSON.stringify({
        event: "NO_TOOL_FOUND_USING_LEGACY",
        intentType: intent.type,
        availableTools: config.tools.map(t => t.name),
      }));

      await this.executeLegacyAgentAction(context, intentId, intent);
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
   * Legacy action handlers (fallback when no tool matches)
   */
  private async executeLegacyAgentAction(
    context: AgentContext,
    intentId: string,
    intent: ParsedIntent
  ): Promise<void> {
    switch (context.agentSlug) {
      case "buy_sell":
        // Buy & Sell agent - handled via tools
        console.log("Buy & Sell agent action - using tools");
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
      // Query driver_status for online drivers nearby
      const { findNearbyDrivers, createDriverMatchEvents, formatDriversForWhatsApp } = await import(
        "../wa-webhook-shared/tools/rides-matcher.ts"
      );
      
      const { drivers, total } = await findNearbyDrivers(
        this.supabase,
        intent.structuredPayload as any
      );
      
      // Create match events for compatible drivers
      await createDriverMatchEvents(
        this.supabase,
        context.userId,
        context.agentId,
        context.conversationId,
        drivers,
        intent.structuredPayload as any
      );
      
      console.log(JSON.stringify({
        event: "DRIVER_MATCHES_CREATED",
        driverCount: drivers.length,
        totalOnline: total,
      }));
    } else if (intent.type === "find_passenger") {
      // Find passengers along route
      // Query trips for pending requests (passengers looking for rides)
      // This would match drivers with passengers going the same route
      console.log(JSON.stringify({
        event: "PASSENGER_MATCHING_REQUESTED",
        note: "Feature requires route matching algorithm",
      }));
    } else if (intent.type === "schedule_trip") {
      // Create scheduled trip
      // Insert into trips with scheduled_at
      const { createTripRequest } = await import(
        "../wa-webhook-shared/tools/rides-matcher.ts"
      );
      
      const { tripId, error } = await createTripRequest(
        this.supabase,
        context.userId,
        intent.structuredPayload as any
      );
      
      if (tripId) {
        console.log(JSON.stringify({
          event: "SCHEDULED_TRIP_CREATED",
          tripId,
        }));
      } else {
        console.error("Failed to create scheduled trip:", error);
      }
    } else if (intent.type === "cancel_trip") {
      // Cancel existing trip
      // Update trips status to 'cancelled'
      // Find user's active trips and cancel them
      const { data: activeTrips } = await this.supabase
        .from("trips")
        .select("id")
        .eq("passenger_id", context.userId)
        .in("status", ["pending", "scheduled", "matched"])
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (activeTrips && activeTrips.length > 0) {
        await this.supabase
          .from("trips")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", activeTrips[0].id);
        
        console.log(JSON.stringify({
          event: "TRIP_CANCELLED",
          tripId: activeTrips[0].id,
        }));
      }
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
      // Store in insurance_documents table
      // Note: This requires the user to actually send a document (image/PDF)
      // The document upload would be handled by the WhatsApp webhook
      // Here we just log the intent
      console.log(JSON.stringify({
        event: "INSURANCE_DOCUMENT_UPLOAD_REQUESTED",
        userId: context.userId,
        note: "User should send document via WhatsApp",
      }));
    } else if (intent.type === "get_quote") {
      // Create quote request
      // Insert into insurance_quote_requests
      const quoteData = {
        user_id: context.userId,
        vehicle_type: intent.structuredPayload.vehicle_type || "car",
        vehicle_identifier: intent.structuredPayload.vehicle_identifier,
        insurance_type: intent.structuredPayload.insurance_type || "third_party",
        status: "pending",
        requested_at: new Date().toISOString(),
        metadata: intent.structuredPayload,
      };
      
      const { data, error } = await this.supabase
        .from("insurance_quote_requests")
        .insert(quoteData)
        .select("id")
        .single();
      
      if (data) {
        console.log(JSON.stringify({
          event: "INSURANCE_QUOTE_CREATED",
          quoteId: data.id,
        }));
      } else {
        console.error("Failed to create insurance quote:", error);
      }
    } else if (intent.type === "renew_policy") {
      // Initiate renewal
      // Query existing policies, create renewal request
      const { data: existingPolicies } = await this.supabase
        .from("insurance_policies")
        .select("id, policy_number, expiry_date")
        .eq("user_id", context.userId)
        .eq("status", "active")
        .order("expiry_date", { ascending: true })
        .limit(1);
      
      if (existingPolicies && existingPolicies.length > 0) {
        const policy = existingPolicies[0];
        
        // Create renewal request
        await this.supabase
          .from("insurance_quote_requests")
          .insert({
            user_id: context.userId,
            request_type: "renewal",
            existing_policy_id: policy.id,
            status: "pending",
            requested_at: new Date().toISOString(),
            metadata: { policy_number: policy.policy_number },
          });
        
        console.log(JSON.stringify({
          event: "INSURANCE_RENEWAL_REQUESTED",
          policyId: policy.id,
        }));
      } else {
        console.log("No active policies found for renewal");
      }
    } else if (intent.type === "track_status") {
      // Check status
      // Query insurance_quote_requests for user
      const { data: quotes } = await this.supabase
        .from("insurance_quote_requests")
        .select("id, status, requested_at, vehicle_type")
        .eq("user_id", context.userId)
        .order("requested_at", { ascending: false })
        .limit(5);
      
      console.log(JSON.stringify({
        event: "INSURANCE_STATUS_CHECKED",
        quoteCount: quotes?.length || 0,
        latestStatus: quotes?.[0]?.status,
      }));
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
