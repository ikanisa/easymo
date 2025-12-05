/**
 * Agent Telemetry Helpers
 * 
 * Provides functions for logging:
 * - Agent metrics (duration, tokens, cost, success)
 * - Tool executions (inputs, outputs, timing)
 * - Match events (job, property, ride matches)
 * - Experiment results (A/B test outcomes)
 * 
 * All data is stored in Supabase ai_agent_* tables for analytics.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AgentMetricInput,
  ExperimentResultInput,
  MatchEventInput,
  ToolExecutionInput,
} from './agent-config.types';

// =====================================================================
// AGENT METRICS
// =====================================================================

/**
 * Log agent interaction metrics
 * 
 * @example
 * await logAgentMetric(supabase, {
 *   agentId: 'uuid',
 *   channel: 'whatsapp',
 *   durationMs: 1500,
 *   success: true,
 *   inputTokens: 100,
 *   outputTokens: 200,
 * });
 */
export async function logAgentMetric(
  supabase: SupabaseClient,
  metric: AgentMetricInput
): Promise<void> {
  try {
    const { error } = await supabase.from('ai_agent_metrics').insert({
      agent_id: metric.agentId,
      conversation_id: metric.conversationId,
      channel: metric.channel,
      duration_ms: metric.durationMs,
      input_tokens: metric.inputTokens,
      output_tokens: metric.outputTokens,
      total_tokens: metric.totalTokens ?? ((metric.inputTokens ?? 0) + (metric.outputTokens ?? 0)),
      cost_estimate: metric.costEstimate,
      success: metric.success,
      error_message: metric.errorMessage,
      metadata: metric.metadata ?? {},
    });

    if (error) {
      console.error(JSON.stringify({
        event: 'AGENT_METRIC_LOG_FAILED',
        agentId: metric.agentId,
        error: error.message,
      }));
    } else {
      console.log(JSON.stringify({
        event: 'AGENT_METRIC_LOGGED',
        agentId: metric.agentId,
        success: metric.success,
        durationMs: metric.durationMs,
      }));
    }
  } catch (err) {
    console.error('Failed to log agent metric:', err);
  }
}

// =====================================================================
// TOOL EXECUTIONS
// =====================================================================

/**
 * Log tool execution details
 * 
 * @example
 * await logToolExecution(supabase, {
 *   agentId: 'uuid',
 *   toolId: 'uuid',
 *   toolName: 'search_jobs',
 *   inputs: { query: 'developer' },
 *   result: { jobs: [...] },
 *   executionTimeMs: 250,
 *   success: true,
 * });
 */
export async function logToolExecution(
  supabase: SupabaseClient,
  exec: ToolExecutionInput
): Promise<void> {
  try {
    const { error } = await supabase.from('ai_agent_tool_executions').insert({
      agent_id: exec.agentId,
      tool_id: exec.toolId,
      tool_name: exec.toolName,
      conversation_id: exec.conversationId,
      user_id: exec.userId,
      inputs: exec.inputs,
      result: exec.result,
      error: exec.error,
      execution_time_ms: exec.executionTimeMs,
      success: exec.success,
      metadata: exec.metadata ?? {},
    });

    if (error) {
      console.error(JSON.stringify({
        event: 'TOOL_EXECUTION_LOG_FAILED',
        toolName: exec.toolName,
        error: error.message,
      }));
    }
  } catch (err) {
    console.error('Failed to log tool execution:', err);
  }
}

// =====================================================================
// MATCH EVENTS
// =====================================================================

/**
 * Log match events (job matches, property matches, ride matches, etc.)
 * 
 * @example
 * await logMatchEvent(supabase, {
 *   agentId: 'uuid',
 *   conversationId: 'uuid',
 *   matchType: 'job',
 *   demandRef: { userId: 'seeker-uuid', skills: ['javascript'] },
 *   supplyRef: { jobId: 'job-uuid', title: 'Developer' },
 *   score: 0.85,
 * });
 */
export async function logMatchEvent(
  supabase: SupabaseClient,
  event: MatchEventInput
): Promise<void> {
  try {
    const { error } = await supabase.from('ai_agent_match_events').insert({
      agent_id: event.agentId,
      conversation_id: event.conversationId,
      intent_id: event.intentId,
      match_type: event.matchType,
      demand_ref: event.demandRef,
      supply_ref: event.supplyRef,
      score: event.score,
      metadata: event.metadata ?? {},
    });

    if (error) {
      console.error(JSON.stringify({
        event: 'MATCH_EVENT_LOG_FAILED',
        matchType: event.matchType,
        error: error.message,
      }));
    } else {
      console.log(JSON.stringify({
        event: 'MATCH_EVENT_LOGGED',
        matchType: event.matchType,
        agentId: event.agentId,
        score: event.score,
      }));
    }
  } catch (err) {
    console.error('Failed to log match event:', err);
  }
}

// =====================================================================
// EXPERIMENT RESULTS
// =====================================================================

/**
 * Log A/B experiment results
 * 
 * @example
 * await logExperimentResult(supabase, {
 *   experimentId: 'uuid',
 *   userId: 'uuid',
 *   variant: 'A',
 *   success: true,
 *   userSatisfactionScore: 4,
 *   conversationLength: 5,
 *   toolsExecuted: 2,
 *   toolsSucceeded: 2,
 *   responseTimeMs: 1200,
 * });
 */
export async function logExperimentResult(
  supabase: SupabaseClient,
  result: ExperimentResultInput
): Promise<void> {
  try {
    const { error } = await supabase.from('ai_agent_experiment_results').insert({
      experiment_id: result.experimentId,
      user_id: result.userId,
      variant: result.variant,
      instruction_id: result.instructionId,
      conversation_id: result.conversationId,
      success: result.success,
      user_satisfaction_score: result.userSatisfactionScore,
      conversation_length: result.conversationLength,
      tools_executed: result.toolsExecuted ?? 0,
      tools_succeeded: result.toolsSucceeded ?? 0,
      response_time_ms: result.responseTimeMs,
      metadata: result.metadata ?? {},
    });

    if (error) {
      console.error(JSON.stringify({
        event: 'EXPERIMENT_RESULT_LOG_FAILED',
        experimentId: result.experimentId,
        error: error.message,
      }));
    }
  } catch (err) {
    console.error('Failed to log experiment result:', err);
  }
}

// =====================================================================
// BATCH LOGGING
// =====================================================================

/**
 * Log multiple tool executions in a batch
 */
export async function logToolExecutionsBatch(
  supabase: SupabaseClient,
  executions: ToolExecutionInput[]
): Promise<void> {
  if (executions.length === 0) return;

  try {
    const { error } = await supabase.from('ai_agent_tool_executions').insert(
      executions.map(exec => ({
        agent_id: exec.agentId,
        tool_id: exec.toolId,
        tool_name: exec.toolName,
        conversation_id: exec.conversationId,
        user_id: exec.userId,
        inputs: exec.inputs,
        result: exec.result,
        error: exec.error,
        execution_time_ms: exec.executionTimeMs,
        success: exec.success,
        metadata: exec.metadata ?? {},
      }))
    );

    if (error) {
      console.error('Batch tool execution log failed:', error.message);
    }
  } catch (err) {
    console.error('Failed to log tool executions batch:', err);
  }
}

/**
 * Log multiple match events in a batch
 */
export async function logMatchEventsBatch(
  supabase: SupabaseClient,
  events: MatchEventInput[]
): Promise<void> {
  if (events.length === 0) return;

  try {
    const { error } = await supabase.from('ai_agent_match_events').insert(
      events.map(event => ({
        agent_id: event.agentId,
        conversation_id: event.conversationId,
        intent_id: event.intentId,
        match_type: event.matchType,
        demand_ref: event.demandRef,
        supply_ref: event.supplyRef,
        score: event.score,
        metadata: event.metadata ?? {},
      }))
    );

    if (error) {
      console.error('Batch match event log failed:', error.message);
    }
  } catch (err) {
    console.error('Failed to log match events batch:', err);
  }
}

// =====================================================================
// CACHE METRICS
// =====================================================================

/**
 * Log agent config cache hit/miss for performance monitoring
 */
export async function logCacheMetric(
  supabase: SupabaseClient,
  agentSlug: string,
  cacheHit: boolean,
  loadSource: 'database' | 'cache' | 'fallback',
  loadTimeMs: number
): Promise<void> {
  try {
    const { error } = await supabase.from('agent_config_cache_metrics').insert({
      agent_slug: agentSlug,
      cache_hit: cacheHit,
      load_source: loadSource,
      load_time_ms: loadTimeMs,
    });

    if (error) {
      // Non-critical, just warn
      console.warn('Cache metric log failed:', error.message);
    }
  } catch (err) {
    // Silent fail for cache metrics
  }
}

// =====================================================================
// AGGREGATION HELPERS
// =====================================================================

/**
 * Calculate tool execution stats for an agent
 */
export async function getToolExecutionStats(
  supabase: SupabaseClient,
  agentId: string,
  since?: Date
): Promise<{
  totalExecutions: number;
  successRate: number;
  avgExecutionTimeMs: number;
  topTools: Array<{ name: string; count: number }>;
}> {
  const sinceDate = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days

  const { data, error } = await supabase
    .from('ai_agent_tool_executions')
    .select('tool_name, success, execution_time_ms')
    .eq('agent_id', agentId)
    .gte('created_at', sinceDate.toISOString());

  if (error || !data || data.length === 0) {
    return {
      totalExecutions: 0,
      successRate: 0,
      avgExecutionTimeMs: 0,
      topTools: [],
    };
  }

  const totalExecutions = data.length;
  const successCount = data.filter(d => d.success).length;
  const successRate = successCount / totalExecutions;
  const avgExecutionTimeMs = data.reduce((sum, d) => sum + (d.execution_time_ms || 0), 0) / totalExecutions;

  // Count tools
  const toolCounts: Record<string, number> = {};
  for (const d of data) {
    toolCounts[d.tool_name] = (toolCounts[d.tool_name] || 0) + 1;
  }

  const topTools = Object.entries(toolCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    totalExecutions,
    successRate,
    avgExecutionTimeMs,
    topTools,
  };
}

/**
 * Get match event stats for an agent
 */
export async function getMatchEventStats(
  supabase: SupabaseClient,
  agentId: string,
  since?: Date
): Promise<{
  totalMatches: number;
  avgScore: number;
  matchesByType: Record<string, number>;
}> {
  const sinceDate = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('ai_agent_match_events')
    .select('match_type, score')
    .eq('agent_id', agentId)
    .gte('created_at', sinceDate.toISOString());

  if (error || !data || data.length === 0) {
    return {
      totalMatches: 0,
      avgScore: 0,
      matchesByType: {},
    };
  }

  const totalMatches = data.length;
  const avgScore = data.reduce((sum, d) => sum + (d.score || 0), 0) / totalMatches;

  const matchesByType: Record<string, number> = {};
  for (const d of data) {
    if (d.match_type) {
      matchesByType[d.match_type] = (matchesByType[d.match_type] || 0) + 1;
    }
  }

  return {
    totalMatches,
    avgScore,
    matchesByType,
  };
}
