/**
 * Base Agent Class
 * 
 * Abstract base class that all domain agents extend.
 * Provides common functionality:
 * - AI processing logic
 * - Flow management (structured multi-step processes)
 * - Tool execution framework
 * - Session context building
 * - Handoff protocol
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3";
import {
  WhatsAppMessage,
  UnifiedSession,
  AgentType,
  AgentDependencies,
  AgentResponse,
  AIResponse,
  Tool,
} from "../core/types.ts";
import { AgentConfigLoader, type AgentConfig } from "../../_shared/agent-config-loader.ts";
import { ToolExecutor } from "../../_shared/tool-executor.ts";

// Re-export types from wa-webhook-ai-agents for backward compatibility
// These are used by some agents that haven't been fully migrated
export interface Session {
  id: string;
  phone: string;
  context: Record<string, unknown>;
  currentAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentProcessParams {
  message: string;
  session: Session;
  supabase: SupabaseClient;
}

// Re-export AgentResponse for backwards compatibility
export type { AgentResponse };

export abstract class BaseAgent {
  protected supabase!: SupabaseClient;
  protected genAI!: GoogleGenerativeAI;
  protected correlationId: string = '';
  protected configLoader!: AgentConfigLoader;
  protected toolExecutor!: ToolExecutor;
  protected cachedConfig: AgentConfig | null = null;

  /**
   * Constructor supports both patterns:
   * 1. New pattern: constructor(deps: AgentDependencies)
   * 2. Legacy pattern: constructor() - initialize() must be called later
   */
  constructor(deps?: AgentDependencies) {
    if (deps) {
      this.initialize(deps);
    }
    // If no deps provided, the agent must call initialize() manually
    // or use the legacy pattern where supabase is passed per-request
  }

  /**
   * Initialize the agent with dependencies
   * Called automatically if deps are passed to constructor
   * Must be called manually for legacy agents that use constructor()
   */
  protected initialize(deps: AgentDependencies): void {
    this.supabase = deps.supabase;
    this.correlationId = deps.correlationId;
    this.configLoader = new AgentConfigLoader(deps.supabase);
    this.toolExecutor = new ToolExecutor(deps.supabase);
    
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    // Note: genAI may be undefined if GEMINI_API_KEY is not set
    // Legacy agents use their own GeminiProvider
  }

  // Abstract methods each agent must implement
  abstract get type(): AgentType;
  abstract get systemPrompt(): string; // Fallback if database config unavailable
  abstract get keywords(): string[];
  abstract get tools(): Tool[];

  /**
   * Main processing logic - called by orchestrator
   */
  async process(
    message: WhatsAppMessage,
    session: UnifiedSession
  ): Promise<AgentResponse> {
    // 1. Check for active flow
    if (session.activeFlow) {
      return this.continueFlow(message, session);
    }

    // 2. Process with AI
    const aiResponse = await this.callAI(message, session);

    // 3. Handle tool calls
    if (aiResponse.toolCalls) {
      for (const call of aiResponse.toolCalls) {
        await this.executeTool(call.name, call.parameters, session);
      }
    }

    // 4. Check for flow initiation
    if (aiResponse.startFlow) {
      session.activeFlow = aiResponse.startFlow;
      return this.startFlow(aiResponse.startFlow, session);
    }

    // 5. Check for handoff
    if (aiResponse.handoffTo) {
      return {
        text: aiResponse.text,
        handoffTo: aiResponse.handoffTo,
        handoffReason: aiResponse.handoffReason,
      };
    }

    return { text: aiResponse.text };
  }

  /**
   * Start a structured flow
   * Override in subclasses to implement domain-specific flows
   */
  protected async startFlow(
    flowName: string,
    session: UnifiedSession
  ): Promise<AgentResponse> {
    throw new Error(`Flow ${flowName} not implemented in ${this.type} agent`);
  }

  /**
   * Continue a structured flow
   * Override in subclasses to implement domain-specific flows
   */
  protected async continueFlow(
    message: WhatsAppMessage,
    session: UnifiedSession
  ): Promise<AgentResponse> {
    throw new Error(`Flow continuation not implemented in ${this.type} agent`);
  }

  /**
   * Call AI (Gemini) to process message with database-driven config
   */
  protected async callAI(
    message: WhatsAppMessage,
    session: UnifiedSession
  ): Promise<AIResponse> {
    const systemPrompt = await this.buildPromptAsync(session);
    
    const model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemPrompt,
    });

    const chat = model.startChat({
      history: this.buildHistory(session),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    });

    const result = await chat.sendMessage(message.body);
    return this.parseAIResponse(result.response.text());
  }

  /**
   * Load agent configuration from database
   */
  protected async loadConfig(): Promise<AgentConfig> {
    if (!this.cachedConfig) {
      this.cachedConfig = await this.configLoader.loadAgentConfig(this.type);
    }
    return this.cachedConfig;
  }

  /**
   * Build system prompt with database config and session context
   */
  protected async buildPromptAsync(session: UnifiedSession): Promise<string> {
    let prompt: string;
    
    // Try to load from database first
    try {
      const config = await this.loadConfig();
      if (config.loadedFrom === 'database' && config.systemInstructions?.instructions) {
        // Build from database config
        const parts: string[] = [];
        
        if (config.persona) {
          parts.push(`Role: ${config.persona.role_name}`);
          parts.push(`Tone: ${config.persona.tone_style}`);
        }
        
        parts.push(config.systemInstructions.instructions);
        
        if (config.systemInstructions.guardrails) {
          parts.push(`\nGUARDRAILS:\n${config.systemInstructions.guardrails}`);
        }
        
        prompt = parts.join('\n\n');
      } else {
        // Fallback to hardcoded
        prompt = this.systemPrompt;
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: 'DB_CONFIG_LOAD_FAILED',
        agent: this.type,
        error: error instanceof Error ? error.message : String(error),
      }));
      prompt = this.systemPrompt;
    }

    // Add session context
    if (session.collectedData && Object.keys(session.collectedData).length > 0) {
      prompt += `\n\nCOLLECTED DATA: ${JSON.stringify(session.collectedData)}`;
    }

    if (session.activeFlow) {
      prompt += `\n\nACTIVE FLOW: ${session.activeFlow}`;
      prompt += `\nFLOW STEP: ${session.flowStep}`;
    }

    if (session.location) {
      prompt += `\n\nUSER LOCATION: ${JSON.stringify(session.location)}`;
    }

    return prompt;
  }

  /**
   * Build system prompt with session context (synchronous fallback)
   * @deprecated Use buildPromptAsync for database-driven config
   */
  protected buildPrompt(session: UnifiedSession): string {
    let prompt = this.systemPrompt;

    if (session.collectedData && Object.keys(session.collectedData).length > 0) {
      prompt += `\n\nCOLLECTED DATA: ${JSON.stringify(session.collectedData)}`;
    }

    if (session.activeFlow) {
      prompt += `\n\nACTIVE FLOW: ${session.activeFlow}`;
      prompt += `\nFLOW STEP: ${session.flowStep}`;
    }

    if (session.location) {
      prompt += `\n\nUSER LOCATION: ${JSON.stringify(session.location)}`;
    }

    return prompt;
  }

  /**
   * Build conversation history for AI context
   */
  protected buildHistory(session: UnifiedSession): Array<{
    role: string;
    parts: Array<{ text: string }>;
  }> {
    return session.conversationHistory.slice(-10).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * Parse AI response JSON
   */
  protected parseAIResponse(responseText: string): AIResponse {
    try {
      const parsed = JSON.parse(responseText);
      return {
        text: parsed.response_text || parsed.text || "I'm here to help!",
        intent: parsed.intent,
        extractedEntities: parsed.extracted_entities,
        startFlow: parsed.start_flow,
        handoffTo: parsed.handoff_to,
        handoffReason: parsed.handoff_reason,
        toolCalls: parsed.tool_calls,
        flowComplete: parsed.flow_complete,
      };
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        text: responseText || "I'm here to help!",
      };
    }
  }

  /**
   * Execute a tool call
   * Override in subclasses to implement domain-specific tools
   */
  protected async executeTool(
    toolName: string,
    parameters: Record<string, any>,
    session: UnifiedSession
  ): Promise<any> {
    console.log(`Executing tool: ${toolName} with params:`, parameters);
    // Base implementation does nothing
    // Subclasses override to implement actual tools
  }

  /**
   * Helper: Send WhatsApp message
   */
  protected async sendMessage(
    to: string,
    text: string
  ): Promise<void> {
    // Import and use WhatsApp API helper
    const { sendWhatsAppMessage } = await import("../../_shared/whatsapp-api.ts");
    await sendWhatsAppMessage(to, { text });
  }

  /**
   * Helper: Format list response
   */
  protected formatListResponse(
    text: string,
    title: string,
    rows: Array<{ id: string; title: string; description?: string }>
  ): AgentResponse {
    return {
      text,
      interactiveList: {
        title,
        rows,
      },
    };
  }

  /**
   * Helper: Format button response
   */
  protected formatButtonResponse(
    text: string,
    buttons: Array<{ id: string; title: string }>
  ): AgentResponse {
    return {
      text,
      interactiveButtons: buttons,
    };
  }

  // =========================================================================
  // LEGACY SUPPORT METHODS
  // These methods support agents that haven't been fully migrated to the
  // new unified pattern. They bridge between the old AgentProcessParams
  // pattern and the new WhatsAppMessage/UnifiedSession pattern.
  // =========================================================================

  /**
   * Build conversation history from legacy Session (for backward compatibility)
   * @deprecated Use buildHistory with UnifiedSession instead
   */
  protected buildConversationHistoryAsync(
    session: Session,
    supabase: SupabaseClient
  ): Promise<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> {
    const history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
    
    // Add system prompt
    history.push({
      role: 'system',
      content: this.systemPrompt,
    });

    // Add context if exists
    if (session.context && Object.keys(session.context).length > 0) {
      history.push({
        role: 'system',
        content: `Current context: ${JSON.stringify(session.context, null, 2)}`,
      });
    }

    // Add conversation history if stored in context
    if (session.context?.conversationHistory) {
      const pastMessages = session.context.conversationHistory as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      history.push(...pastMessages);
    }

    return Promise.resolve(history);
  }

  /**
   * Update conversation history in session (for backward compatibility)
   * @deprecated Use unified session management instead
   */
  protected async updateConversationHistory(
    session: Session,
    userMessage: string,
    agentResponse: string,
    supabase: SupabaseClient
  ): Promise<void> {
    const history = (session.context?.conversationHistory || []) as Array<{ role: 'user' | 'assistant'; content: string }>;
    
    // Add user message
    history.push({
      role: 'user',
      content: userMessage,
    });

    // Add agent response
    history.push({
      role: 'assistant',
      content: agentResponse,
    });

    // Keep only last 10 messages
    const trimmedHistory = history.slice(-10);

    // Update session context
    await supabase
      .from('ai_agent_sessions')
      .update({
        context: {
          ...session.context,
          conversationHistory: trimmedHistory,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);
  }

  /**
   * Log agent interaction (for backward compatibility)
   * @deprecated Use unified logging instead
   */
  protected async logInteraction(
    session: Session,
    userMessage: string,
    agentResponse: string,
    supabase: SupabaseClient,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await supabase.from('ai_agent_interactions').insert({
      session_id: session.id,
      agent_type: this.type,
      user_message: userMessage,
      agent_response: agentResponse,
      metadata: {
        ...metadata,
        configSource: this.cachedConfig?.loadedFrom || 'not_loaded',
      },
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Get default system prompt (for backward compatibility)
   * @deprecated Use systemPrompt getter instead
   */
  getDefaultSystemPrompt(): string {
    return this.systemPrompt;
  }
}
