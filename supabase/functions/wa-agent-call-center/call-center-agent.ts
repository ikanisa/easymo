/**
 * Universal Call Center AI Agent
 * 
 * This is the "master" agent that knows everything:
 * - Can handle any topic (buy/sell, mobility, insurance, jobs, property, etc.)
 * - Learns from all specialized agents
 * - Can collaborate with other agents via agent-to-agent communication
 * - Routes complex queries to specialized agents when needed
 * 
 * Perfect for voice calls where users ask anything.
 */

import {
  BaseAgent,
  type AgentProcessParams,
  type AgentResponse,
  type ConversationMessage,
} from '../_shared/ai-agents/index.ts';
import { GeminiProvider } from '../_shared/ai-agents/providers/gemini.ts';
import {
  findBestAgent,
  getAllAgents,
  consultAgent,
  buildAgentKnowledgeSummary,
} from '../_shared/ai-agents/agent-collaboration.ts';
import { logStructuredEvent } from '../_shared/observability.ts';

export class CallCenterAgent extends BaseAgent {
  type = 'call_center';
  name = '📞 Universal Call Center AI';
  description = 'Universal AI that handles any inquiry and collaborates with specialized agents';

  private aiProvider: GeminiProvider;

  constructor() {
    super();
    this.aiProvider = new GeminiProvider();
  }

  async process(params: AgentProcessParams): Promise<AgentResponse> {
    const { phone, message, session, supabase, context } = params;

    try {
      // Check if this is a consultation from another agent
      const isConsultation = context?.isConsultation === true;

      // Find if a specialized agent would be better suited
      const bestAgent = findBestAgent(message);
      const shouldDelegate = bestAgent && !isConsultation;

      await logStructuredEvent('CALL_CENTER_PROCESSING', {
        phone: phone.slice(-4),
        bestAgentMatch: bestAgent?.agentType || 'none',
        shouldDelegate,
        isConsultation,
      });

      // Build comprehensive system prompt
      const systemPrompt = await this.buildSystemPrompt(supabase);

      const messages: ConversationMessage[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Add conversation history
      if (session.conversationHistory) {
        messages.push(...session.conversationHistory);
      }

      // Add current message
      messages.push({ role: 'user', content: message });

      // Generate response - include guidance about specialized agents
      let enhancedPrompt = message;
      if (shouldDelegate && bestAgent) {
        enhancedPrompt = `User query: "${message}"

For this topic, I can help directly, but we also have a specialized ${bestAgent.name} agent.
If the query is complex or requires specific tools, consider mentioning that specialized help is available.

Please provide a helpful response.`;
        
        messages[messages.length - 1].content = enhancedPrompt;
      }

      // Generate AI response
      const aiResponse = await this.aiProvider.chat(messages, {
        temperature: 0.7,
        maxTokens: 1000,
        model: 'gemini-3',
      });

      // If query is very specialized and we should consult another agent
      let consultationResult: AgentResponse | null = null;
      if (shouldDelegate && bestAgent && this.shouldConsultSpecialist(message)) {
        consultationResult = await consultAgent(supabase, {
          fromAgent: this.type,
          toAgent: bestAgent.agentType,
          requestType: 'consult',
          message,
          context: { originalSession: session.id },
          sessionId: session.id,
        });
      }

      // Log interaction
      await this.logInteraction(session, message, aiResponse, supabase, {
        agentType: this.type,
        delegatedTo: bestAgent?.agentType,
        consultationPerformed: !!consultationResult,
      });

      await logStructuredEvent('CALL_CENTER_RESPONSE', {
        responseLength: aiResponse.length,
        consultedAgent: consultationResult ? bestAgent?.agentType : null,
      });

      // Combine response with consultation if relevant
      let finalResponse = aiResponse;
      if (consultationResult?.message && !consultationResult.message.includes('error')) {
        finalResponse = `${aiResponse}\n\n---\n💡 *Specialized insight from ${bestAgent?.name}:*\n${consultationResult.message}`;
      }

      return {
        message: finalResponse,
        agentType: this.type,
        metadata: {
          model: 'gemini-3',
          consultedAgent: consultationResult ? bestAgent?.agentType : null,
          matchedSpecialist: bestAgent?.agentType,
        },
      };

    } catch (error) {
      await logStructuredEvent('CALL_CENTER_ERROR', {
        error: error instanceof Error ? error.message : String(error),
      }, 'error');

      return {
        message: "I apologize, I'm having trouble right now. Please try again or say 'menu' for options.",
        agentType: this.type,
        metadata: { error: true },
      };
    }
  }

  /**
   * Determine if we should consult a specialist
   */
  private shouldConsultSpecialist(message: string): boolean {
    // Keywords that indicate specialized knowledge needed
    const specialistKeywords = [
      'claim', 'policy', 'premium', // Insurance
      'book', 'reserve', 'schedule', // Mobility/Restaurant
      'apply', 'resume', 'interview', // Jobs
      'rent', 'lease', 'bedroom', // Property
      'price', 'sell', 'buy', // Marketplace
      'crop', 'harvest', 'fertilizer', // Farmer
    ];

    const lowerMessage = message.toLowerCase();
    return specialistKeywords.some(kw => lowerMessage.includes(kw));
  }

  /**
   * Build comprehensive system prompt with knowledge from all agents
   */
  private async buildSystemPrompt(supabase: any): Promise<string> {
    // Get knowledge summary from all agents
    const agentKnowledge = buildAgentKnowledgeSummary();
    const allAgents = getAllAgents();

    return `You are easyMO's Universal Call Center AI - the most knowledgeable AI assistant.

YOUR ROLE:
You are a universal AI that can help with ANYTHING. Users call you for all types of queries:
- 🚕 Rides & Delivery
- 👔 Jobs & Employment
- 🏠 Property & Rentals
- 🛍️ Buy & Sell (Marketplace)
- 🌾 Farmers Market
- 🛡️ Insurance
- 🍽️ Restaurants & Bars
- 💬 General Support

AVAILABLE SPECIALIZED AGENTS:
${agentKnowledge}

HOW YOU WORK:
1. ANSWER DIRECTLY when possible - you have comprehensive knowledge
2. For complex queries, you may consult specialized agents
3. Be helpful, friendly, and conversational
4. Guide users to the right services
5. Handle multi-topic conversations smoothly

CAPABILITIES:
- Book rides and deliveries
- Search jobs and help with applications
- Find properties for rent
- List/search marketplace products
- Connect farmers with buyers
- Explain insurance options
- Make restaurant reservations
- Resolve account issues
- Answer general questions

CONVERSATION STYLE:
- Be warm and professional
- Keep responses concise but helpful
- Use emojis sparingly for friendliness
- Speak naturally like a helpful human
- If unsure, ask clarifying questions

LANGUAGES:
Respond in the user's language (English, French, Kinyarwanda, etc.)

You are the FIRST POINT OF CONTACT for all user inquiries. Help them with whatever they need!`;
  }

  getDefaultSystemPrompt(): string {
    return this.buildSystemPrompt({} as any).toString();
  }
}
