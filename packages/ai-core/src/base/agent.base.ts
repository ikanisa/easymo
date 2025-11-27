import { EventEmitter } from 'events';

import { GeminiClient } from '../llm/gemini-client';
import { ModelRouter } from '../llm/model-router';
import { OpenAIClient } from '../llm/openai-client';
import { ToolRegistry } from './tool.interface';
import { childLogger } from '@easymo/commons';

const log = childLogger({ service: 'ai-core' });

import {
  AgentContext,
  AgentInput,
  AgentResult,
  AgentSession,
  MemoryConfig,
  ModelType,
  Tool,
  ToolInvocation,
  VisionConfig,
  VoiceConfig} from './types';

export abstract class BaseAgent extends EventEmitter {
  // LLM Clients
  protected gemini: GeminiClient;
  protected openai: OpenAIClient;
  protected modelRouter: ModelRouter;

  // Tool Management
  protected toolRegistry: ToolRegistry;

  // Active Sessions
  protected activeSessions: Map<string, AgentSession>;

  // Agent Configuration
  abstract name: string;
  abstract instructions: string;
  abstract primaryModel: 'gemini' | 'gpt5';
  abstract capabilities: ('voice' | 'vision' | 'memory')[];

  // Model Configuration
  model: ModelType = 'gemini-2.5-pro';
  temperature: number = 0.7;
  maxTokens: number = 8192;

  constructor() {
    super();

    // Initialize LLM clients
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!geminiKey && !openaiKey) {
      throw new Error('At least one of GEMINI_API_KEY or OPENAI_API_KEY must be set');
    }

    this.gemini = new GeminiClient(geminiKey || '');
    this.openai = new OpenAIClient(openaiKey || '');
    this.modelRouter = new ModelRouter(this.primaryModel);

    // Initialize tool registry
    this.toolRegistry = new ToolRegistry();

    // Initialize sessions
    this.activeSessions = new Map();
  }

  /**
   * Main execution method - must be implemented by each agent
   */
  abstract execute(input: AgentInput): Promise<AgentResult>;

  /**
   * Run ReAct loop with Gemini
   */
  protected async runGeminiReActLoop(
    input: AgentInput,
    maxTurns: number = 10
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const toolsInvoked: ToolInvocation[] = [];

    try {
      // Get Gemini model
      const model = this.gemini.getModel({
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.maxTokens
      });

      // Start chat with tools
      const tools = this.toolRegistry.toGeminiFunctionDeclarations();
      const chat = await this.gemini.startChat(model, tools);

      // Send initial query
      let result = await chat.sendMessage(this.instructions + '\n\nUser: ' + input.query);

      // ReAct loop
      for (let turn = 0; turn < maxTurns; turn++) {
        const response = result.response;
        const functionCalls = response.functionCalls();

        // If no function calls, we're done
        if (!functionCalls || functionCalls.length === 0) {
          return {
            success: true,
            finalOutput: response.text(),
            toolsInvoked,
            duration: Date.now() - startTime,
            modelUsed: 'gemini'
          };
        }

        // Execute all function calls
        for (const call of functionCalls) {
          const toolStartTime = Date.now();
          
          try {
            const toolResult = await this.toolRegistry.execute(
              call.name,
              call.args,
              input.context || { userId: input.userId }
            );

            toolsInvoked.push({
              toolName: call.name,
              params: call.args,
              result: toolResult,
              duration: Date.now() - toolStartTime,
              timestamp: new Date()
            });

            // Send tool result back to model
            result = await chat.sendMessage([{
              functionResponse: {
                name: call.name,
                response: toolResult
              }
            }]);

          } catch (error) {
            log.error(`Error executing tool ${call.name}:`, error);
            
            // Send error back to model
            result = await chat.sendMessage([{
              functionResponse: {
                name: call.name,
                response: { error: error instanceof Error ? error.message : String(error) }
              }
            }]);
          }
        }
      }

      // Max turns reached
      return {
        success: true,
        finalOutput: result.response.text(),
        toolsInvoked,
        duration: Date.now() - startTime,
        modelUsed: 'gemini'
      };

    } catch (error) {
      log.error('Error in Gemini ReAct loop:', error);
      return {
        success: false,
        finalOutput: 'An error occurred while processing your request.',
        toolsInvoked,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Run ReAct loop with OpenAI GPT-5
   */
  protected async runOpenAIReActLoop(
    input: AgentInput,
    maxTurns: number = 10
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const toolsInvoked: ToolInvocation[] = [];

    try {
      const messages: any[] = [
        { role: 'system', content: this.instructions },
        { role: 'user', content: input.query }
      ];

      const tools = this.toolRegistry.toOpenAIFunctions();

      // ReAct loop
      for (let turn = 0; turn < maxTurns; turn++) {
        const response = await this.openai.createChatCompletion(
          messages,
          tools,
          {
            model: 'gpt-5',
            temperature: this.temperature,
            maxTokens: this.maxTokens
          }
        );

        const message = response.choices[0]?.message;
        if (!message) break;

        messages.push(message);

        // Check for tool calls
        if (!message.tool_calls || message.tool_calls.length === 0) {
          return {
            success: true,
            finalOutput: message.content || '',
            toolsInvoked,
            duration: Date.now() - startTime,
            modelUsed: 'gpt5'
          };
        }

        // Execute tool calls
        for (const toolCall of message.tool_calls) {
          const toolStartTime = Date.now();
          
          try {
            const toolResult = await this.toolRegistry.execute(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments),
              input.context || { userId: input.userId }
            );

            toolsInvoked.push({
              toolName: toolCall.function.name,
              params: JSON.parse(toolCall.function.arguments),
              result: toolResult,
              duration: Date.now() - toolStartTime,
              timestamp: new Date()
            });

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult)
            });

          } catch (error) {
            log.error(`Error executing tool ${toolCall.function.name}:`, error);
            
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
            });
          }
        }
      }

      // Max turns reached
      return {
        success: true,
        finalOutput: messages[messages.length - 1]?.content || 'Max turns reached',
        toolsInvoked,
        duration: Date.now() - startTime,
        modelUsed: 'gpt5'
      };

    } catch (error) {
      log.error('Error in OpenAI ReAct loop:', error);
      return {
        success: false,
        finalOutput: 'An error occurred while processing your request.',
        toolsInvoked,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Create a new session with optional timeout
   */
  protected createSession(userId: string, agentType: string, deadlineMs?: number): AgentSession {
    const session: AgentSession = {
      id: `${agentType}_${userId}_${Date.now()}`,
      userId,
      agentType,
      startTime: new Date(),
      deadline: deadlineMs ? new Date(Date.now() + deadlineMs) : undefined,
      context: { userId }
    };

    this.activeSessions.set(session.id, session);
    return session;
  }

  /**
   * Get session by ID
   */
  protected getSession(sessionId: string): AgentSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * End a session
   */
  protected endSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }
}
