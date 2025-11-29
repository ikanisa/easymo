/**
 * OpenAI Agents SDK Implementation
 * Implements OpenAI's Assistants/Agents API with function calling
 */

import { getOpenAIClient } from './client';
import type { 
  AIMessage, 
  ToolDefinition, 
  AgentConfig,
  AICompletionOptions,
  AICompletionResponse,
} from '../types';

export interface OpenAIAgentOptions {
  name: string;
  description?: string;
  instructions: string;
  model?: string;
  tools?: ToolDefinition[];
  metadata?: Record<string, unknown>;
}

export interface AgentRunOptions {
  threadId?: string;
  messages: AIMessage[];
  stream?: boolean;
}

/**
 * Create an OpenAI Assistant (Agent)
 */
export const createOpenAIAgent = async (
  options: OpenAIAgentOptions
): Promise<{ id: string; config: AgentConfig }> => {
  const client = getOpenAIClient();

  const assistant = await client.beta.assistants.create({
    name: options.name,
    description: options.description,
    instructions: options.instructions,
    model: options.model || 'gpt-4o-mini',
    tools: options.tools?.map(tool => ({
      type: tool.type,
      function: tool.function,
    })) || [],
    metadata: options.metadata,
  });

  return {
    id: assistant.id,
    config: {
      id: assistant.id,
      provider: 'openai',
      model: assistant.model as any,
      name: assistant.name || options.name,
      description: assistant.description || options.description,
      instructions: assistant.instructions || options.instructions,
      tools: options.tools,
      metadata: assistant.metadata,
    },
  };
};

/**
 * Run agent with streaming support
 */
export const runOpenAIAgent = async (
  agentId: string,
  options: AgentRunOptions
): Promise<AICompletionResponse> => {
  const client = getOpenAIClient();

  // Create or use existing thread
  let threadId = options.threadId;
  if (!threadId) {
    const thread = await client.beta.threads.create();
    threadId = thread.id;
  }

  // Add messages to thread
  for (const message of options.messages) {
    if (message.role === 'user') {
      await client.beta.threads.messages.create(threadId, {
        role: 'user',
        content: message.content,
      });
    }
  }

  // Run the assistant
  const run = await client.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: agentId,
  });

  // Handle tool calls if needed
  if (run.status === 'requires_action' && run.required_action?.type === 'submit_tool_outputs') {
    // Tool outputs would be handled here in production
    console.warn('Tool outputs required but not implemented yet');
  }

  // Get messages
  const messages = await client.beta.threads.messages.list(threadId);
  const lastMessage = messages.data[0];

  // Convert to standard response format
  const content = lastMessage.content[0];
  const messageContent = content.type === 'text' ? content.text.value : '';

  return {
    id: run.id,
    model: run.model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: messageContent,
      },
      finish_reason: run.status,
    }],
  };
};

/**
 * Standard chat completions (non-agent mode)
 */
export const createOpenAICompletion = async (
  options: AICompletionOptions
): Promise<AICompletionResponse> => {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: options.model || 'gpt-4o-mini',
    messages: options.messages as any,
    temperature: options.temperature,
    max_tokens: options.max_tokens,
    tools: options.tools as any,
    tool_choice: options.tool_choice as any,
    response_format: options.response_format as any,
    stream: false,
  });

  return response as unknown as AICompletionResponse;
};

/**
 * Streaming chat completions
 */
export async function* streamOpenAICompletion(
  options: AICompletionOptions
): AsyncGenerator<string, void, unknown> {
  const client = getOpenAIClient();

  const stream = await client.chat.completions.create({
    model: options.model || 'gpt-4o-mini',
    messages: options.messages as any,
    temperature: options.temperature,
    max_tokens: options.max_tokens,
    tools: options.tools as any,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

/**
 * List all agents (assistants)
 */
export const listOpenAIAgents = async (): Promise<AgentConfig[]> => {
  const client = getOpenAIClient();
  
  const assistants = await client.beta.assistants.list({
    limit: 100,
  });

  return assistants.data.map(assistant => ({
    id: assistant.id,
    provider: 'openai',
    model: assistant.model as any,
    name: assistant.name || 'Unnamed Agent',
    description: assistant.description || undefined,
    instructions: assistant.instructions || undefined,
    metadata: assistant.metadata,
  }));
};

/**
 * Delete an agent
 */
export const deleteOpenAIAgent = async (agentId: string): Promise<void> => {
  const client = getOpenAIClient();
  await client.beta.assistants.del(agentId);
};
