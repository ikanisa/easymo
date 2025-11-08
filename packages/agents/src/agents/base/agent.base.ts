/**
 * Base Agent Class
 * All specialized agents extend this class
 */

import { EventEmitter } from 'events';
import OpenAI from 'openai';
import type { AgentInput, AgentResult, AgentContext, Tool, AgentSession } from '../../types/agent.types';
import { logAgentStart, logAgentComplete, logAgentError } from '../../observability';

export abstract class BaseAgent extends EventEmitter {
  protected openai: OpenAI;
  protected activeSessions: Map<string, AgentSession>;
  
  abstract name: string;
  abstract instructions: string;
  abstract tools: Tool[];
  
  model: string = 'gpt-4o';
  temperature: number = 0.7;
  maxTokens: number = 2000;
  
  constructor() {
    super();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.activeSessions = new Map();
  }

  /**
   * Main execution method - must be implemented by each agent
   */
  abstract execute(input: AgentInput): Promise<AgentResult>;

  /**
   * Create a new session with optional timeout
   */
  protected createSession(userId: string, agentType: string, deadlineMs?: number): AgentSession {
    const session: AgentSession = {
      id: `${agentType}_${userId}_${Date.now()}`,
      userId,
      agentType,
      startTime: Date.now(),
      deadline: deadlineMs ? Date.now() + deadlineMs : undefined,
      status: 'active',
      results: [],
      extensions: 0,
    };

    this.activeSessions.set(session.id, session);
    
    if (session.deadline) {
      this.setupTimeout(session);
    }

    return session;
  }

  protected setupTimeout(session: AgentSession): void {
    if (!session.deadline) return;

    const timeoutDuration = session.deadline - Date.now();
    
    setTimeout(() => {
      const currentSession = this.activeSessions.get(session.id);
      if (currentSession && currentSession.status === 'active') {
        this.handleTimeout(currentSession);
      }
    }, timeoutDuration);
  }

  protected async handleTimeout(session: AgentSession): Promise<void> {
    session.status = 'timeout';
    
    this.emit('timeout', {
      sessionId: session.id,
      userId: session.userId,
      results: session.results,
      message: this.getTimeoutMessage(session),
    });
  }

  protected getTimeoutMessage(session: AgentSession): string {
    const resultCount = session.results?.length || 0;
    
    if (resultCount === 0) {
      return "⏱️ I couldn't find any results within the time limit. Would you like me to continue searching for 2 more minutes?";
    } else if (resultCount < 3) {
      return `⏱️ I found ${resultCount} option(s) so far. Would you like me to continue searching for more options (+2 minutes)?`;
    } else {
      return "Here are the best options I found:";
    }
  }

  protected extendDeadline(session: AgentSession, additionalMs: number): boolean {
    if (!session.deadline || session.extensions >= 2) {
      return false;
    }

    session.deadline += additionalMs;
    session.extensions++;
    session.status = 'active';
    
    this.setupTimeout(session);
    return true;
  }

  protected addResult(session: AgentSession, result: any): void {
    if (!session.results) {
      session.results = [];
    }
    session.results.push(result);

    if (session.results.length >= 3) {
      this.emit('threshold_reached', {
        sessionId: session.id,
        results: session.results,
      });
    }
  }

  protected completeSession(session: AgentSession): void {
    session.status = 'completed';
    this.activeSessions.delete(session.id);
  }

  protected async runCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    tools?: OpenAI.Chat.ChatCompletionTool[]
  ): Promise<OpenAI.Chat.ChatCompletion> {
    return await this.openai.chat.completions.create({
      model: this.model,
      messages,
      tools,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    });
  }

  protected async executeTool(
    toolName: string,
    params: any,
    context: AgentContext
  ): Promise<any> {
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    return await tool.execute(params, context);
  }

  protected formatOptions(options: any[]): string {
    let message = "Here are the best options I found:\n\n";
    
    options.slice(0, 3).forEach((option, index) => {
      message += `*Option ${index + 1}*\n`;
      message += this.formatSingleOption(option);
      message += `\n─────────────\n\n`;
    });
    
    message += "_Reply with the option number (1, 2, or 3) to confirm your choice._";
    return message;
  }

  protected abstract formatSingleOption(option: any): string;
  protected abstract calculateScore(option: any, criteria: any): number;
}
