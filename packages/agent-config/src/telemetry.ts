/**
 * Telemetry - Metrics, tool executions, and match event logging
 * 
 * Provides helper functions to write to ai_agent_metrics, ai_agent_tool_executions,
 * and ai_agent_match_events tables.
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { MatchEventInput,MetricInput, ToolExecutionInput } from './types';

// ============================================================================
// METRICS LOGGING
// ============================================================================

/**
 * Log an agent interaction metric
 */
export async function logAgentMetric(
  supabase: SupabaseClient,
  metric: MetricInput
): Promise<void> {
  const { error } = await supabase
    .from('ai_agent_metrics')
    .insert({
      agent_id: metric.agent_id,
      channel: metric.channel,
      session_id: metric.session_id,
      duration_ms: metric.duration_ms,
      total_tokens: metric.total_tokens,
      prompt_tokens: metric.prompt_tokens,
      completion_tokens: metric.completion_tokens,
      cost_usd: metric.cost_usd,
      model: metric.model,
      provider: metric.provider,
      success: metric.success,
      error_message: metric.error_message,
      tools_executed: metric.tools_executed || [],
      correlation_id: metric.correlation_id,
      user_id: metric.user_id,
    });

  if (error) {
    console.error('Failed to log agent metric:', error);
  }
}

// ============================================================================
// TOOL EXECUTION LOGGING
// ============================================================================

/**
 * Log a tool execution
 */
export async function logToolExecution(
  supabase: SupabaseClient,
  execution: ToolExecutionInput
): Promise<void> {
  const { error } = await supabase
    .from('ai_agent_tool_executions')
    .insert({
      agent_id: execution.agent_id,
      tool_id: execution.tool_id,
      tool_name: execution.tool_name,
      inputs: execution.inputs,
      result: execution.result,
      error: execution.error,
      execution_time_ms: execution.execution_time_ms,
      success: execution.success,
      user_id: execution.user_id,
      conversation_id: execution.conversation_id,
      metadata: execution.metadata,
    });

  if (error) {
    console.error('Failed to log tool execution:', error);
  }
}

/**
 * Create a telemetry callback for tool execution
 */
export function createToolExecutionLogger(
  supabase: SupabaseClient,
  agentId: string,
  toolsMap: Map<string, string>, // name -> id
  context?: { user_id?: string; conversation_id?: string }
): (toolName: string, inputs: Record<string, unknown>, result: unknown, timeMs: number, success: boolean) => void {
  return async (toolName, inputs, result, timeMs, success) => {
    const toolId = toolsMap.get(toolName);
    if (!toolId) return;

    await logToolExecution(supabase, {
      agent_id: agentId,
      tool_id: toolId,
      tool_name: toolName,
      inputs,
      result: success ? (result as Record<string, unknown>) : undefined,
      error: !success ? String(result) : undefined,
      execution_time_ms: timeMs,
      success,
      user_id: context?.user_id,
      conversation_id: context?.conversation_id,
    });
  };
}

// ============================================================================
// MATCH EVENT LOGGING
// ============================================================================

/**
 * Log a match event (job↔seeker, buyer↔farmer, tenant↔property)
 */
export async function logMatchEvent(
  supabase: SupabaseClient,
  event: MatchEventInput
): Promise<string | null> {
  const { data, error } = await supabase
    .from('ai_agent_match_events')
    .insert({
      agent_id: event.agent_id,
      match_type: event.match_type,
      seeker_user_id: event.seeker_user_id,
      seeker_phone: event.seeker_phone,
      owner_user_id: event.owner_user_id,
      owner_phone: event.owner_phone,
      listing_id: event.listing_id,
      match_score: event.match_score,
      status: event.status || 'suggested',
      metadata: event.metadata,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to log match event:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * Update match event status
 */
export async function updateMatchEventStatus(
  supabase: SupabaseClient,
  matchId: string,
  status: 'suggested' | 'contacted' | 'accepted' | 'rejected'
): Promise<void> {
  const { error } = await supabase
    .from('ai_agent_match_events')
    .update({ status })
    .eq('id', matchId);

  if (error) {
    console.error('Failed to update match event:', error);
  }
}

// ============================================================================
// CONVERSATION METRICS HELPER
// ============================================================================

interface ConversationMetricsContext {
  agentId: string;
  channel: 'whatsapp' | 'voice' | 'web';
  sessionId?: string;
  userId?: string;
  correlationId?: string;
}

/**
 * Create a metrics tracker for a conversation
 */
export function createConversationMetrics(
  supabase: SupabaseClient,
  context: ConversationMetricsContext
) {
  const startTime = Date.now();
  let totalTokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  const toolsExecuted: string[] = [];
  let model: string | undefined;
  let provider: 'openai' | 'anthropic' | 'google' | undefined;

  return {
    addTokens(usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) {
      if (usage.prompt_tokens) promptTokens += usage.prompt_tokens;
      if (usage.completion_tokens) completionTokens += usage.completion_tokens;
      if (usage.total_tokens) totalTokens += usage.total_tokens;
    },

    addTool(toolName: string) {
      toolsExecuted.push(toolName);
    },

    setModel(m: string, p: 'openai' | 'anthropic' | 'google') {
      model = m;
      provider = p;
    },

    async finish(success: boolean, errorMessage?: string) {
      const durationMs = Date.now() - startTime;
      
      await logAgentMetric(supabase, {
        agent_id: context.agentId,
        channel: context.channel,
        session_id: context.sessionId,
        duration_ms: durationMs,
        total_tokens: totalTokens || undefined,
        prompt_tokens: promptTokens || undefined,
        completion_tokens: completionTokens || undefined,
        model,
        provider,
        success,
        error_message: errorMessage,
        tools_executed: toolsExecuted,
        correlation_id: context.correlationId,
        user_id: context.userId,
      });
    },
  };
}
