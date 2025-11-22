/**
 * Base Agent Class
 * All specialized agents extend this class
 */

import { EventEmitter } from 'events';
import OpenAI from 'openai';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import type { AgentInput, AgentResult, AgentContext, Tool, AgentSession } from '../../types/agent.types';
import { logAgentStart, logAgentComplete, logAgentError } from '../../observability';

export abstract class BaseAgent extends EventEmitter {
  protected openai: OpenAI;
  protected gemini?: GoogleGenerativeAI;
  protected activeSessions: Map<string, AgentSession>;
  
  abstract name: string;
  abstract instructions: string;
  abstract tools: Tool[];
  
  model: string = 'gemini-1.5-flash'; // Default to Gemini as requested
  temperature: number = 0.7;
  maxTokens: number = 2000;
  
  constructor() {
    super();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'dummy', // Prevent crash if only Gemini is used
    });
    
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    
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
    
    // Use Gemini if configured and model starts with 'gemini'
    if (this.gemini && this.model.startsWith('gemini')) {
      return await this.runGeminiCompletion(messages, tools);
    }

    return await this.openai.chat.completions.create({
      model: this.model,
      messages,
      tools,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    });
  }

  private async runGeminiCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    tools?: OpenAI.Chat.ChatCompletionTool[]
  ): Promise<OpenAI.Chat.ChatCompletion> {
    if (!this.gemini) throw new Error("Gemini API Key not configured");

    const model = this.gemini.getGenerativeModel({ model: this.model });
    
    // Convert OpenAI messages to Gemini format
    // This is a simplified conversion. For robust production use, a more complete mapper is needed.
    const history = messages.map(m => {
      let role = 'user';
      if (m.role === 'assistant') role = 'model';
      if (m.role === 'system') role = 'user'; // Gemini treats system instructions differently or as user
      
      return {
        role,
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
      };
    });

    // Extract system instruction if present
    const systemMessage = messages.find(m => m.role === 'system');
    const systemInstruction = systemMessage ? (systemMessage.content as string) : undefined;

    // Configure tools if present
    // Gemini tools format is different. For now, we'll skip tool conversion for Gemini in this base implementation
    // and assume the agent will handle tool execution logic or we use Gemini's function calling if implemented fully.
    // For this task, we focus on getting the text generation working.
    
    // Note: Full function calling support for Gemini requires mapping OpenAI tool definitions to Gemini FunctionDeclarations.
    
    const chat = model.startChat({
      history: history.slice(0, -1), // All but last
      systemInstruction,
    });

    const lastMessage = history[history.length - 1];
    const result = await chat.sendMessage(lastMessage.parts[0].text);
    const responseText = result.response.text();

    // Map back to OpenAI format for compatibility
    return {
      id: 'gemini-' + Date.now(),
      object: 'chat.completion',
      created: Date.now(),
      model: this.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseText,
          refusal: null,
        },
        finish_reason: 'stop',
        logprobs: null,
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
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
