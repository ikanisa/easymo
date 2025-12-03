/**
 * Jobs AI Agent
 * Handles job search, posting, applications, gig work
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-11-27
 * 
 * NOW DATABASE-DRIVEN:
 * - System prompt loaded from ai_agent_system_instructions table
 * - Persona loaded from ai_agent_personas table
 * - Tools loaded from ai_agent_tools table (via AgentConfigLoader)
 */

import { BaseAgent, type AgentProcessParams, type AgentResponse } from './base-agent.ts';
import { GeminiProvider } from '../core/providers/gemini.ts';
import { logStructuredEvent } from '../../_shared/observability.ts';

export class JobsAgent extends BaseAgent {
  type = 'jobs_agent';
  name = '👔 Jobs AI';
  description = 'Job board and employment assistant';

  private aiProvider: GeminiProvider;

  constructor() {
    super();
    this.aiProvider = new GeminiProvider();
  }

  async process(params: AgentProcessParams): Promise<AgentResponse> {
    const { message, session, supabase } = params;

    try {
      // Load database config and build conversation history with DB-driven prompt
      const messages = await this.buildConversationHistoryAsync(session, supabase);
      
      // Add current user message
      messages.push({
        role: 'user',
        content: message,
      });

      // Log config source for debugging
      await logStructuredEvent('JOBS_AGENT_PROCESSING', {
        sessionId: session.id,
        configSource: this.cachedConfig?.loadedFrom || 'not_loaded',
        toolsAvailable: this.cachedConfig?.tools.length || 0,
      });

      // Generate AI response
      const aiResponse = await this.aiProvider.chat(messages, {
        temperature: 0.7,
        maxTokens: 500,
      });

      // Update conversation history
      await this.updateConversationHistory(session, message, aiResponse, supabase);

      // Log interaction
      await this.logInteraction(session, message, aiResponse, supabase, {
        agentType: this.type,
      });

      await logStructuredEvent('JOBS_AGENT_RESPONSE', {
        sessionId: session.id,
        responseLength: aiResponse.length,
        configSource: this.cachedConfig?.loadedFrom,
      });

      return {
        message: aiResponse,
        agentType: this.type,
        metadata: {
          model: 'gemini-2.0-flash-exp',
          configLoadedFrom: this.cachedConfig?.loadedFrom,
        },
      };

    } catch (error) {
      await logStructuredEvent('JOBS_AGENT_ERROR', {
        error: error instanceof Error ? error.message : String(error),
      }, 'error');

      return {
        message: "Sorry, I'm having trouble right now. Please try again or type 'menu' to go back.",
        agentType: this.type,
        metadata: {
          error: true,
        },
      };
    }
  }

  /**
   * Default system prompt - fallback if database config not available
   */
  getDefaultSystemPrompt(): string {
    return `You are a helpful job board AI assistant at easyMO Jobs & Gigs platform.

Your role:
- Help job seekers find employment opportunities
- Assist employers in posting job openings
- Match candidates with suitable positions
- Provide career guidance and tips
- Support both full-time jobs and short-term gigs

Job types supported:
- Full-time employment
- Part-time positions
- Contract work
- Freelance gigs
- 1-hour quick tasks
- Daily work
- Seasonal jobs

For Job Seekers:
- Browse available positions
- Search by skills, location, salary
- Apply to jobs quickly
- Get personalized job recommendations
- Prepare for interviews
- Update your profile/CV
- Set job alerts

For Employers:
- Post job openings
- Screen applicants
- Schedule interviews
- Manage applications
- Find qualified candidates
- Post quick gigs for immediate tasks

Guidelines:
- Be encouraging and supportive
- Provide clear job descriptions
- Help with realistic expectations
- Suggest skill development opportunities
- Facilitate quick connections between employers and workers
- Emphasize the chat & get hired model

Platform features:
- Instant chat with employers/candidates
- Quick application process
- Skill-based matching
- Location-based search
- Salary transparency
- Gig posting (1-hour to full-time)

Keep responses practical and action-oriented. Help users find work or find workers quickly!
Type "menu" to return to main services menu.`;
  }
}
