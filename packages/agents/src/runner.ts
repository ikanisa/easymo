/**
 * Agent Runner - Core execution logic for agents
 * 
 * NOTE: The OpenAI Agents SDK (@openai/agents) is still in development.
 * This implementation uses the OpenAI SDK's function calling capabilities
 * as a foundation, ready to be upgraded to the Agents SDK when available.
 */

import OpenAI from 'openai';
import { z } from 'zod';

import {
  logAgentComplete,
  logAgentError,
  logAgentStart,
  storeAgentTrace,
} from './observability';
import type { AgentContext,AgentInput, AgentResult } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AgentDefinition {
  name: string;
  instructions: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{
    name: string;
    description: string;
    parameters: z.ZodSchema;
    execute: (params: any, context: AgentContext) => Promise<any>;
  }>;
}

/**
 * Run an agent with the given input
 */
export async function runAgent(
  agent: AgentDefinition,
  input: AgentInput
): Promise<AgentResult> {
  const startTime = Date.now();
  const context: AgentContext = input.context || {
    userId: input.userId,
  };

  await logAgentStart(agent.name, context, input.query);

  try {
    // Convert tools to OpenAI function format
    const functions = (agent.tools || []).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    }));

    // Initial message to the agent
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: agent.instructions,
      },
      {
        role: 'user',
        content: input.query,
      },
    ];

    const toolsInvoked: string[] = [];
    let iterations = 0;
    const maxIterations = 10;

    // Agent execution loop
    while (iterations < maxIterations) {
      iterations++;

      const response = await openai.chat.completions.create({
        model: agent.model || 'gpt-4o',
        messages,
        functions: functions.length > 0 ? functions : undefined,
        function_call: functions.length > 0 ? 'auto' : undefined,
        temperature: agent.temperature || 0.7,
        max_tokens: agent.maxTokens || 1000,
      });

      const message = response.choices[0].message;

      // If no function call, we're done
      if (!message.function_call) {
        const duration = Date.now() - startTime;

        await logAgentComplete(agent.name, context, {
          success: true,
          durationMs: duration,
          toolsInvoked,
        });

        const result: AgentResult = {
          success: true,
          finalOutput: message.content || '',
          toolsInvoked,
          duration,
        };

        // Store trace
        await storeAgentTrace({
          id: `trace-${Date.now()}`,
          agentName: agent.name,
          userId: context.userId,
          query: input.query,
          result: result as unknown as Record<string, unknown>,
          durationMs: duration,
          toolsInvoked,
          createdAt: new Date().toISOString(),
        });

        return result;
      }

      // Execute function call
      const functionName = message.function_call.name;
      const functionArgs = JSON.parse(message.function_call.arguments);

      toolsInvoked.push(functionName);

      const tool = agent.tools?.find(t => t.name === functionName);
      if (!tool) {
        throw new Error(`Unknown function: ${functionName}`);
      }

      // Validate and execute tool
      const validatedArgs = tool.parameters.parse(functionArgs);
      const toolResult = await tool.execute(validatedArgs, context);

      // Add function call and result to messages
      messages.push(message);
      messages.push({
        role: 'function',
        name: functionName,
        content: JSON.stringify(toolResult),
      });
    }

    throw new Error('Max iterations exceeded');
  } catch (error) {
    const duration = Date.now() - startTime;
    await logAgentError(
      agent.name,
      context,
      error instanceof Error ? error : new Error(String(error)),
      duration
    );

    return {
      success: false,
      finalOutput: '',
      error: error instanceof Error ? error.message : String(error),
      duration,
    };
  }
}

/**
 * Convert Zod schema to JSON Schema for OpenAI
 * Simple implementation - in production use zod-to-json-schema package
 */
function zodToJsonSchema(schema: z.ZodSchema): Record<string, unknown> {
  // This is a simplified version
  // In production, use: import { zodToJsonSchema } from 'zod-to-json-schema';
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodValue = value as z.ZodTypeAny;
      properties[key] = zodTypeToJsonSchema(zodValue);
      if (!(zodValue instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required,
    };
  }

  return { type: 'object' };
}

function zodTypeToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodString) {
    return { type: 'string' };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: 'number' };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodTypeToJsonSchema(schema._def.type as z.ZodTypeAny),
    };
  }
  if (schema instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(schema._def.innerType as z.ZodTypeAny);
  }
  return { type: 'string' };
}
