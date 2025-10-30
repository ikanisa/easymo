/**
 * Shared types for EasyMO Agents package
 */

import type { z } from 'zod';

/**
 * Context provided to agents during execution
 */
export interface AgentContext {
  userId: string;
  sessionId?: string;
  source?: 'web' | 'whatsapp' | 'voice' | 'api';
  metadata?: Record<string, unknown>;
}

/**
 * Input to agent execution
 */
export interface AgentInput {
  userId: string;
  query: string;
  context?: AgentContext;
}

/**
 * Result from agent execution
 */
export interface AgentResult {
  success: boolean;
  finalOutput: string;
  toolsInvoked?: string[];
  handoffs?: string[];
  duration?: number;
  trace?: AgentTrace;
  error?: string;
}

/**
 * Agent execution trace for observability
 */
export interface AgentTrace {
  id: string;
  agentName: string;
  userId: string;
  query: string;
  result: Record<string, unknown>;
  durationMs: number;
  toolsInvoked: string[];
  createdAt: string;
}

/**
 * Tool definition
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (params: unknown, context: AgentContext) => Promise<unknown>;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  name: string;
  instructions: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  handoffs?: string[];
}

/**
 * Agent registry entry
 */
export interface AgentRegistryEntry {
  name: string;
  agent: unknown; // OpenAI Agent type
  config: AgentConfig;
}
