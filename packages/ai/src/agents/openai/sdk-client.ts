/**
 * OpenAI Agents SDK Client
 * 
 * Official OpenAI Agents SDK integration for EasyMO
 * Supports: Assistants API, Threads, Runs, Tools, File Search, Code Interpreter
 * 
 * @see https://platform.openai.com/docs/assistants/overview
 */

import OpenAI from "openai";
import { Assistant } from "openai/resources/beta";

// ============================================================================
// TYPES
// ============================================================================

export interface AgentSDKConfig {
  apiKey: string;
  organization?: string;
  baseURL?: string;
  defaultModel?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface CreateAgentParams {
  name: string;
  instructions: string;
  description?: string;
  model?: string;
  tools?: Array<OpenAI.Beta.AssistantTool>;
  toolResources?: OpenAI.Beta.AssistantCreateParams.ToolResources;
  metadata?: Record<string, string>;
  temperature?: number;
  topP?: number;
  responseFormat?: any;
}

export interface RunAgentParams {
  assistantId: string;
  threadId?: string;
  message: string;
  attachments?: Array<{
    file_id: string;
    tools: Array<{ type: "file_search" | "code_interpreter" }>;
  }>;
  additionalInstructions?: string;
  additionalMessages?: Array<OpenAI.Beta.Threads.MessageCreateParams>;
  metadata?: Record<string, string>;
  stream?: boolean;
  toolChoice?: any;
  parallelToolCalls?: boolean;
}

export interface AgentRunResult {
  threadId: string;
  runId: string;
  status: OpenAI.Beta.Threads.Run["status"];
  messages: OpenAI.Beta.Threads.Message[];
  lastMessage: string;
  usage?: OpenAI.Beta.Threads.Run["usage"];
  toolCalls?: OpenAI.Beta.Threads.Runs.RunStep[];
  error?: string;
}

export interface ToolExecutionContext {
  threadId: string;
  runId: string;
  toolCallId: string;
  functionName: string;
  arguments: Record<string, unknown>;
}

export type ToolExecutor = (
  context: ToolExecutionContext
) => Promise<string>;

// ============================================================================
// SDK CLIENT
// ============================================================================

export class OpenAIAgentsSDK {
  private client: OpenAI;
  private defaultModel: string;
  private toolExecutors: Map<string, ToolExecutor> = new Map();
  private assistantCache: Map<string, Assistant> = new Map();

  constructor(config: AgentSDKConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      baseURL: config.baseURL,
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 60000,
    });
    this.defaultModel = config.defaultModel ?? "gpt-4o";
  }

  // --------------------------------------------------------------------------
  // ASSISTANT MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Create a new assistant (agent)
   */
  async createAssistant(params: CreateAgentParams): Promise<OpenAI.Beta.Assistant> {
    const assistant = await this.client.beta.assistants.create({
      name: params.name,
      description: params.description,
      instructions: params.instructions,
      model: params.model ?? this.defaultModel,
      tools: params.tools ?? [],
      tool_resources: params.toolResources,
      metadata: params.metadata,
      temperature: params.temperature,
      top_p: params.topP,
      response_format: params.responseFormat,
    });

    this.assistantCache.set(assistant.id, assistant);
    return assistant;
  }

  /**
   * Get an existing assistant
   */
  async getAssistant(assistantId: string): Promise<OpenAI.Beta.Assistant> {
    const cached = this.assistantCache.get(assistantId);
    if (cached) return cached;

    const assistant = await this.client.beta.assistants.retrieve(assistantId);
    this.assistantCache.set(assistantId, assistant);
    return assistant;
  }

  /**
   * Update an assistant
   */
  async updateAssistant(
    assistantId: string,
    params: Partial<CreateAgentParams>
  ): Promise<Assistant> {
    const assistant = await this.client.beta.assistants.update(assistantId, {
      name: params.name,
      description: params.description,
      instructions: params.instructions,
      model: params.model,
      tools: params.tools,
      tool_resources: params.toolResources,
      metadata: params.metadata,
      temperature: params.temperature,
      top_p: params.topP,
      response_format: params.responseFormat,
    });

    this.assistantCache.set(assistantId, assistant);
    return assistant;
  }

  /**
   * Delete an assistant
   */
  async deleteAssistant(assistantId: string): Promise<void> {
    await this.client.beta.assistants.del(assistantId);
    this.assistantCache.delete(assistantId);
  }

  /**
   * List all assistants
   */
  async listAssistants(limit = 100): Promise<OpenAI.Beta.Assistant[]> {
    const response = await this.client.beta.assistants.list({ limit });
    return response.data;
  }

  // --------------------------------------------------------------------------
  // THREAD MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Create a new thread
   */
  async createThread(
    messages?: Array<OpenAI.Beta.Threads.MessageCreateParams>,
    metadata?: Record<string, string>
  ): Promise<OpenAI.Beta.Thread> {
    return this.client.beta.threads.create({
      messages,
      metadata,
    });
  }

  /**
   * Get an existing thread
   */
  async getThread(threadId: string): Promise<OpenAI.Beta.Thread> {
    return this.client.beta.threads.retrieve(threadId);
  }

  /**
   * Delete a thread
   */
  async deleteThread(threadId: string): Promise<void> {
    await this.client.beta.threads.del(threadId);
  }

  /**
   * Add a message to a thread
   */
  async addMessage(
    threadId: string,
    content: string,
    role: "user" | "assistant" = "user",
    attachments?: Array<{
      file_id: string;
      tools: Array<{ type: "file_search" | "code_interpreter" }>;
    }>
  ): Promise<OpenAI.Beta.Threads.Message> {
    return this.client.beta.threads.messages.create(threadId, {
      role,
      content,
      attachments,
    });
  }

  /**
   * List messages in a thread
   */
  async listMessages(threadId: string, limit = 100): Promise<OpenAI.Beta.Threads.Message[]> {
    const response = await this.client.beta.threads.messages.list(threadId, {
      limit,
      order: "asc",
    });
    return response.data;
  }

  // --------------------------------------------------------------------------
  // RUN MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Run an assistant on a thread and wait for completion
   */
  async runAgent(params: RunAgentParams): Promise<AgentRunResult> {
    // Create thread if not provided
    const threadId = params.threadId ?? (await this.createThread()).id;

    // Add user message
    await this.addMessage(threadId, params.message, "user", params.attachments);

    // Create and poll run
    let run = await this.client.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: params.assistantId,
      additional_instructions: params.additionalInstructions,
      additional_messages: params.additionalMessages,
      metadata: params.metadata,
      tool_choice: params.toolChoice,
      parallel_tool_calls: params.parallelToolCalls,
    });

    // Handle tool calls if needed
    while (run.status === "requires_action") {
      run = await this.handleToolCalls(threadId, run);
    }

    // Get messages
    const messages = await this.listMessages(threadId);
    const lastMessage = this.extractLastAssistantMessage(messages);

    // Get run steps for tool call info
    const steps = await this.client.beta.threads.runs.steps.list(threadId, run.id);

    return {
      threadId,
      runId: run.id,
      status: run.status,
      messages,
      lastMessage,
      usage: run.usage ?? undefined,
      toolCalls: steps.data,
      error: run.last_error?.message,
    };
  }

  /**
   * Run with streaming
   */
  async *runAgentStream(params: RunAgentParams): AsyncGenerator<{
    type: "text" | "tool_call" | "done";
    content: string;
    metadata?: Record<string, unknown>;
  }> {
    const threadId = params.threadId ?? (await this.createThread()).id;
    await this.addMessage(threadId, params.message, "user", params.attachments);

    const stream = this.client.beta.threads.runs.stream(threadId, {
      assistant_id: params.assistantId,
      additional_instructions: params.additionalInstructions,
    });

    for await (const event of stream) {
      if (event.event === "thread.message.delta") {
        const delta = event.data.delta;
        if (delta.content?.[0]?.type === "text") {
          yield {
            type: "text",
            content: (delta.content[0] as any).text?.value ?? "",
          };
        }
      } else if (event.event === "thread.run.requires_action") {
        yield {
          type: "tool_call",
          content: "Processing tool calls...",
          metadata: { run_id: event.data.id },
        };
      } else if (event.event === "thread.run.completed") {
        yield {
          type: "done",
          content: "",
          metadata: { usage: event.data.usage },
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // TOOL MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Register a tool executor
   */
  registerToolExecutor(functionName: string, executor: ToolExecutor): void {
    this.toolExecutors.set(functionName, executor);
  }

  /**
   * Handle tool calls in a run
   */
  private async handleToolCalls(threadId: string, run: OpenAI.Beta.Threads.Run): Promise<OpenAI.Beta.Threads.Run> {
    const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls;
    if (!toolCalls?.length) return run;

    const toolOutputs: Array<{ tool_call_id: string; output: string }> = [];

    for (const toolCall of toolCalls) {
      const executor = this.toolExecutors.get(toolCall.function.name);
      
      let output: string;
      if (executor) {
        try {
          output = await executor({
            threadId,
            runId: run.id,
            toolCallId: toolCall.id,
            functionName: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
          });
        } catch (error) {
          output = JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } else {
        output = JSON.stringify({
          error: `No executor registered for function: ${toolCall.function.name}`,
        });
      }

      toolOutputs.push({
        tool_call_id: toolCall.id,
        output,
      });
    }

    // Submit tool outputs and poll for completion
    return this.client.beta.threads.runs.submitToolOutputsAndPoll(
      threadId,
      run.id,
      { tool_outputs: toolOutputs }
    );
  }

  /**
   * Extract last assistant message from thread
   */
  private extractLastAssistantMessage(messages: OpenAI.Beta.Threads.Message[]): string {
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    const lastMessage = assistantMessages[assistantMessages.length - 1];
    
    if (!lastMessage?.content?.[0]) return "";
    
    const content = lastMessage.content[0];
    if (content.type === "text") {
      return content.text.value;
    }
    
    return "";
  }

  // --------------------------------------------------------------------------
  // FILE MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Upload a file for use with assistants
   */
  async uploadFile(
    file: Buffer | ReadableStream,
    filename: string,
    purpose: "assistants" | "vision" = "assistants"
  ): Promise<OpenAI.Files.FileObject> {
    return this.client.files.create({
      file: new File([file as any], filename),
      purpose,
    });
  }

  /**
   * Create a vector store for file search
   */
  async createVectorStore(
    name: string,
    fileIds?: string[]
  ): Promise<any> {
    return (this.client.beta as any).vectorStores.create({
      name,
      file_ids: fileIds,
    });
  }

  // --------------------------------------------------------------------------
  // UTILITY METHODS
  // --------------------------------------------------------------------------

  /**
   * Get the underlying OpenAI client
   */
  getClient(): OpenAI {
    return this.client;
  }
}

export default OpenAIAgentsSDK;
