/**
 * Tool Registry - Maps DB tool definitions to runtime implementations
 * 
 * Converts AiAgentTool records from Supabase into executable tool functions
 * for OpenAI Responses API, Agents SDK, and ADK Go.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { AiAgentTool, RuntimeTool } from './types';

// ============================================================================
// TOOL HANDLERS REGISTRY
// ============================================================================

type ToolHandler = (inputs: Record<string, unknown>, config: AiAgentTool['config']) => Promise<unknown>;

const toolHandlers = new Map<string, ToolHandler>();

/**
 * Register a custom tool handler implementation
 */
export function registerToolHandler(toolName: string, handler: ToolHandler): void {
  toolHandlers.set(toolName, handler);
}

/**
 * Get a registered tool handler
 */
export function getToolHandler(toolName: string): ToolHandler | undefined {
  return toolHandlers.get(toolName);
}

// ============================================================================
// BUILT-IN TOOL IMPLEMENTATIONS
// ============================================================================

/**
 * HTTP tool executor
 */
async function executeHttpTool(
  inputs: Record<string, unknown>,
  config: AiAgentTool['config']
): Promise<unknown> {
  const { endpoint, method = 'GET', api_key_env } = config;
  if (!endpoint) throw new Error('HTTP tool missing endpoint');

  const url = new URL(endpoint as string);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add API key from environment
  if (api_key_env && process.env[api_key_env as string]) {
    headers['Authorization'] = `Bearer ${process.env[api_key_env as string]}`;
  }

  const options: RequestInit = {
    method: method as string,
    headers,
  };

  if (method === 'GET') {
    Object.entries(inputs).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  } else {
    options.body = JSON.stringify(inputs);
  }

  const response = await fetch(url.toString(), options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Supabase DB tool executor
 */
async function executeDbTool(
  inputs: Record<string, unknown>,
  config: AiAgentTool['config'],
  supabase: SupabaseClient
): Promise<unknown> {
  const { table, operation = 'select' } = config;
  if (!table) throw new Error('DB tool missing table name');

  switch (operation) {
    case 'select': {
      let query = supabase.from(table as string).select('*');
      // Apply filters from inputs
      Object.entries(inputs).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }

    case 'insert': {
      const { data, error } = await supabase
        .from(table as string)
        .insert(inputs)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case 'update': {
      const { id, ...updateData } = inputs;
      const { data, error } = await supabase
        .from(table as string)
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case 'rpc': {
      const { rpc_name } = config;
      if (!rpc_name) throw new Error('RPC tool missing rpc_name');
      const { data, error } = await supabase.rpc(rpc_name as string, inputs);
      if (error) throw error;
      return data;
    }

    default:
      throw new Error(`Unknown DB operation: ${operation}`);
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export interface ToolExecutorOptions {
  supabase: SupabaseClient;
  onExecution?: (toolName: string, inputs: Record<string, unknown>, result: unknown, timeMs: number, success: boolean) => void;
}

/**
 * Execute a tool with the given inputs
 */
export async function executeTool(
  tool: AiAgentTool,
  inputs: Record<string, unknown>,
  options: ToolExecutorOptions
): Promise<unknown> {
  const startTime = Date.now();
  let result: unknown;
  let success = true;

  try {
    // Check for custom handler first
    const customHandler = toolHandlers.get(tool.name);
    if (customHandler) {
      result = await customHandler(inputs, tool.config);
    } else {
      // Use built-in executors based on tool type
      switch (tool.tool_type) {
        case 'http':
        case 'external':
          result = await executeHttpTool(inputs, tool.config);
          break;

        case 'db':
        case 'supabase_rpc':
          result = await executeDbTool(inputs, tool.config, options.supabase);
          break;

        case 'internal':
          // Internal tools must be registered
          throw new Error(`Internal tool ${tool.name} not registered. Use registerToolHandler('${tool.name}', handler)`);

        default:
          throw new Error(`Unknown tool type: ${tool.tool_type}`);
      }
    }
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const timeMs = Date.now() - startTime;
    if (options.onExecution) {
      options.onExecution(tool.name, inputs, result, timeMs, success);
    }
  }

  return result;
}

// ============================================================================
// RUNTIME TOOL BUILDER
// ============================================================================

/**
 * Convert DB tool definitions to runtime tools for OpenAI
 */
export function buildRuntimeTools(tools: AiAgentTool[]): RuntimeTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
    handler: tool.config.handler as string | undefined,
    config: tool.config,
  }));
}

/**
 * Build OpenAI function definitions for Responses/Chat Completions API
 */
export function buildOpenAITools(tools: AiAgentTool[]): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: AiAgentTool['input_schema'];
  };
}> {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

/**
 * Create a tool executor function map for OpenAI Agents SDK
 */
export function buildToolExecutorMap(
  tools: AiAgentTool[],
  options: ToolExecutorOptions
): Map<string, (inputs: Record<string, unknown>) => Promise<unknown>> {
  const map = new Map<string, (inputs: Record<string, unknown>) => Promise<unknown>>();

  for (const tool of tools) {
    map.set(tool.name, async (inputs) => {
      return executeTool(tool, inputs, options);
    });
  }

  return map;
}
