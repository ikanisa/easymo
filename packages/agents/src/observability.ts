/**
 * Observability utilities for agent execution
 * 
 * Provides structured logging and metrics for agent operations
 * following EasyMO ground rules.
 */

import type { AgentContext, AgentTrace } from './types';

import { childLogger } from '@easymo/commons';

const log = childLogger({ service: 'agents' });

/**
 * Log structured event for agent execution
 */
export async function logStructuredEvent(
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const logEntry = {
    event,
    timestamp: new Date().toISOString(),
    ...data,
  };

  // In production, this would send to centralized logging
  log.info(JSON.stringify(logEntry));
}

/**
 * Log agent execution start
 */
export async function logAgentStart(
  agentName: string,
  context: AgentContext,
  query: string
): Promise<void> {
  await logStructuredEvent('AGENT_EXECUTION_START', {
    agentName,
    userId: context.userId,
    sessionId: context.sessionId,
    source: context.source,
    query: query.substring(0, 100), // Truncate for privacy
  });
}

/**
 * Log agent execution completion
 */
export async function logAgentComplete(
  agentName: string,
  context: AgentContext,
  result: {
    success: boolean;
    durationMs: number;
    toolsInvoked?: string[];
    handoffs?: string[];
  }
): Promise<void> {
  await logStructuredEvent('AGENT_EXECUTION_COMPLETE', {
    agentName,
    userId: context.userId,
    sessionId: context.sessionId,
    success: result.success,
    durationMs: result.durationMs,
    toolsInvoked: result.toolsInvoked || [],
    handoffs: result.handoffs || [],
  });
}

/**
 * Log agent execution error
 */
export async function logAgentError(
  agentName: string,
  context: AgentContext,
  error: Error,
  durationMs: number
): Promise<void> {
  await logStructuredEvent('AGENT_EXECUTION_FAILED', {
    agentName,
    userId: context.userId,
    sessionId: context.sessionId,
    error: error.message,
    durationMs,
    // Don't log full stack trace in production for security
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
}

/**
 * Log tool invocation
 */
export async function logToolInvocation(
  toolName: string,
  context: AgentContext,
  params: Record<string, unknown>
): Promise<void> {
  await logStructuredEvent('TOOL_INVOKED', {
    toolName,
    userId: context.userId,
    sessionId: context.sessionId,
    // Sanitize params to avoid logging sensitive data
    params: sanitizeParams(params),
  });
}

/**
 * Log agent handoff
 */
export async function logAgentHandoff(
  fromAgent: string,
  toAgent: string,
  context: AgentContext,
  reason: string
): Promise<void> {
  await logStructuredEvent('AGENT_HANDOFF', {
    fromAgent,
    toAgent,
    userId: context.userId,
    sessionId: context.sessionId,
    reason,
  });
}

/**
 * Record metric for agent execution
 */
export async function recordMetric(
  metric: string,
  value: number,
  tags?: Record<string, string>
): Promise<void> {
  await logStructuredEvent('METRIC', {
    metric,
    value,
    tags: tags || {},
  });
}

/**
 * Sanitize parameters to remove sensitive data before logging
 */
function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
    'phoneNumber',
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 100) {
      sanitized[key] = value.substring(0, 100) + '...';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Store agent trace in database
 * This would integrate with Supabase in production
 */
export async function storeAgentTrace(trace: AgentTrace): Promise<void> {
  await logStructuredEvent('AGENT_TRACE_STORED', {
    traceId: trace.id,
    agentName: trace.agentName,
    userId: trace.userId,
    durationMs: trace.durationMs,
  });

  // In production, this would insert into Supabase agent_traces table
  // For now, just log it
}
