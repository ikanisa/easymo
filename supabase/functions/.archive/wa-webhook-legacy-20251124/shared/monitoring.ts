/**
 * AI Agent Monitoring & Metrics Collection
 * 
 * Comprehensive monitoring system for AI agent performance,
 * cost tracking, and quality metrics
 * 
 * ADDITIVE ONLY - New file
 */

import type { SupabaseClient } from "../../_shared/supabase.ts";
import { logStructuredEvent } from "../observe/log.ts";

export interface AgentMetrics {
  agent_type: string;
  conversation_id: string;
  user_id?: string;
  phone_number: string;
  
  // Performance metrics
  latency_ms: number;
  llm_latency_ms: number;
  tool_execution_ms: number;
  
  // Token usage
  tokens_prompt: number;
  tokens_completion: number;
  tokens_total: number;
  
  // Cost tracking
  cost_usd: number;
  
  // Quality metrics
  success: boolean;
  error_message?: string;
  finish_reason?: string;
  
  // Tool usage
  tool_calls_count: number;
  tools_executed: string[];
  
  // Model info
  model: string;
  temperature: number;
  
  // Timestamp
  timestamp: Date;
  
  // Additional metadata
  metadata?: Record<string, any>;
}

export interface AggregatedMetrics {
  // Time period
  period_start: Date;
  period_end: Date;
  
  // Volume
  total_messages: number;
  total_conversations: number;
  unique_users: number;
  
  // Performance
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  
  // Cost
  total_cost_usd: number;
  avg_cost_per_message: number;
  avg_cost_per_conversation: number;
  
  // Usage
  total_tokens: number;
  avg_tokens_per_message: number;
  total_tool_calls: number;
  avg_tool_calls_per_message: number;
  
  // Quality
  success_rate: number;
  error_rate: number;
  timeout_rate: number;
  fallback_rate: number;
  
  // Agent breakdown
  by_agent_type: Record<string, {
    message_count: number;
    avg_latency_ms: number;
    total_cost_usd: number;
    success_rate: number;
  }>;
  
  // Tool breakdown
  by_tool: Record<string, {
    call_count: number;
    success_rate: number;
    avg_execution_ms: number;
  }>;
}

export class MonitoringService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Record metrics for an agent interaction
   */
  async recordMetrics(metrics: AgentMetrics): Promise<void> {
    try {
      // Store in database
      const { error } = await this.supabase
        .from("agent_metrics")
        .insert({
          agent_type: metrics.agent_type,
          conversation_id: metrics.conversation_id,
          user_id: metrics.user_id,
          timestamp: metrics.timestamp.toISOString(),
          tokens_prompt: metrics.tokens_prompt,
          tokens_completion: metrics.tokens_completion,
          tokens_total: metrics.tokens_total,
          latency_ms: metrics.latency_ms,
          llm_latency_ms: metrics.llm_latency_ms,
          tool_execution_ms: metrics.tool_execution_ms,
          cost_usd: metrics.cost_usd,
          success: metrics.success,
          error_message: metrics.error_message,
          metadata: {
            phone_number: metrics.phone_number,
            model: metrics.model,
            temperature: metrics.temperature,
            tool_calls_count: metrics.tool_calls_count,
            tools_executed: metrics.tools_executed,
            finish_reason: metrics.finish_reason,
            ...metrics.metadata,
          },
        });

      if (error) {
        console.error("Failed to record metrics:", error);
      }

      // Log structured event
      await logStructuredEvent("AGENT_METRICS_RECORDED", {
        agent_type: metrics.agent_type,
        conversation_id: metrics.conversation_id,
        latency_ms: metrics.latency_ms,
        tokens: metrics.tokens_total,
        cost_usd: metrics.cost_usd,
        success: metrics.success,
      });

      // Check for alerts
      await this.checkAlerts(metrics);
    } catch (error) {
      console.error("Error recording metrics:", error);
    }
  }

  /**
   * Get aggregated metrics for a time period
   */
  async getAggregatedMetrics(
    startDate: Date,
    endDate: Date,
    agentType?: string
  ): Promise<AggregatedMetrics> {
    try {
      let query = this.supabase
        .from("agent_metrics")
        .select("*")
        .gte("timestamp", startDate.toISOString())
        .lte("timestamp", endDate.toISOString());

      if (agentType) {
        query = query.eq("agent_type", agentType);
      }

      const { data: metrics, error } = await query;

      if (error || !metrics) {
        throw error || new Error("No metrics found");
      }

      // Calculate aggregations
      const aggregated = this.calculateAggregations(metrics, startDate, endDate);
      
      return aggregated;
    } catch (error) {
      console.error("Error fetching aggregated metrics:", error);
      throw error;
    }
  }

  /**
   * Calculate aggregations from raw metrics
   */
  private calculateAggregations(
    metrics: any[],
    startDate: Date,
    endDate: Date
  ): AggregatedMetrics {
    if (metrics.length === 0) {
      return this.getEmptyAggregatedMetrics(startDate, endDate);
    }

    // Sort latencies for percentiles
    const latencies = metrics.map((m) => m.latency_ms).sort((a, b) => a - b);

    // Calculate percentiles
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    // Calculate totals
    const totalTokens = metrics.reduce((sum, m) => sum + (m.tokens_total || 0), 0);
    const totalCost = metrics.reduce((sum, m) => sum + (m.cost_usd || 0), 0);
    const totalToolCalls = metrics.reduce(
      (sum, m) => sum + ((m.metadata?.tool_calls_count) || 0),
      0
    );

    // Count unique values
    const uniqueConversations = new Set(metrics.map((m) => m.conversation_id)).size;
    const uniqueUsers = new Set(
      metrics.map((m) => m.user_id || m.metadata?.phone_number).filter(Boolean)
    ).size;

    // Success metrics
    const successCount = metrics.filter((m) => m.success).length;
    const errorCount = metrics.filter((m) => !m.success).length;
    const timeoutCount = metrics.filter(
      (m) => m.error_message?.includes("timeout")
    ).length;
    const fallbackCount = metrics.filter(
      (m) => m.metadata?.fallback === true
    ).length;

    // Group by agent type
    const byAgentType: Record<string, any> = {};
    for (const metric of metrics) {
      const agentType = metric.agent_type || "unknown";
      if (!byAgentType[agentType]) {
        byAgentType[agentType] = {
          message_count: 0,
          total_latency: 0,
          total_cost: 0,
          success_count: 0,
        };
      }
      byAgentType[agentType].message_count++;
      byAgentType[agentType].total_latency += metric.latency_ms || 0;
      byAgentType[agentType].total_cost += metric.cost_usd || 0;
      if (metric.success) byAgentType[agentType].success_count++;
    }

    // Transform agent type data
    const byAgentTypeTransformed: Record<string, any> = {};
    for (const [agentType, data] of Object.entries(byAgentType)) {
      byAgentTypeTransformed[agentType] = {
        message_count: data.message_count,
        avg_latency_ms: data.total_latency / data.message_count,
        total_cost_usd: data.total_cost,
        success_rate: data.success_count / data.message_count,
      };
    }

    // Group by tool
    const byTool: Record<string, any> = {};
    for (const metric of metrics) {
      const tools = metric.metadata?.tools_executed || [];
      for (const tool of tools) {
        if (!byTool[tool]) {
          byTool[tool] = {
            call_count: 0,
            success_count: 0,
            total_execution_ms: 0,
          };
        }
        byTool[tool].call_count++;
        if (metric.success) byTool[tool].success_count++;
        byTool[tool].total_execution_ms += metric.tool_execution_ms || 0;
      }
    }

    // Transform tool data
    const byToolTransformed: Record<string, any> = {};
    for (const [tool, data] of Object.entries(byTool)) {
      byToolTransformed[tool] = {
        call_count: data.call_count,
        success_rate: data.success_count / data.call_count,
        avg_execution_ms: data.total_execution_ms / data.call_count,
      };
    }

    return {
      period_start: startDate,
      period_end: endDate,
      total_messages: metrics.length,
      total_conversations: uniqueConversations,
      unique_users: uniqueUsers,
      avg_latency_ms: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50_latency_ms: p50,
      p95_latency_ms: p95,
      p99_latency_ms: p99,
      total_cost_usd: totalCost,
      avg_cost_per_message: totalCost / metrics.length,
      avg_cost_per_conversation: totalCost / uniqueConversations,
      total_tokens: totalTokens,
      avg_tokens_per_message: totalTokens / metrics.length,
      total_tool_calls: totalToolCalls,
      avg_tool_calls_per_message: totalToolCalls / metrics.length,
      success_rate: successCount / metrics.length,
      error_rate: errorCount / metrics.length,
      timeout_rate: timeoutCount / metrics.length,
      fallback_rate: fallbackCount / metrics.length,
      by_agent_type: byAgentTypeTransformed,
      by_tool: byToolTransformed,
    };
  }

  /**
   * Get empty aggregated metrics
   */
  private getEmptyAggregatedMetrics(
    startDate: Date,
    endDate: Date
  ): AggregatedMetrics {
    return {
      period_start: startDate,
      period_end: endDate,
      total_messages: 0,
      total_conversations: 0,
      unique_users: 0,
      avg_latency_ms: 0,
      p50_latency_ms: 0,
      p95_latency_ms: 0,
      p99_latency_ms: 0,
      total_cost_usd: 0,
      avg_cost_per_message: 0,
      avg_cost_per_conversation: 0,
      total_tokens: 0,
      avg_tokens_per_message: 0,
      total_tool_calls: 0,
      avg_tool_calls_per_message: 0,
      success_rate: 0,
      error_rate: 0,
      timeout_rate: 0,
      fallback_rate: 0,
      by_agent_type: {},
      by_tool: {},
    };
  }

  /**
   * Check for alert conditions
   */
  private async checkAlerts(metrics: AgentMetrics): Promise<void> {
    const alerts = [];

    // High latency
    if (metrics.latency_ms > 3000) {
      alerts.push({
        type: "HIGH_LATENCY",
        severity: "warning",
        message: `Agent response latency ${metrics.latency_ms}ms exceeds threshold`,
        metadata: { latency_ms: metrics.latency_ms },
      });
    }

    // High cost
    if (metrics.cost_usd > 0.10) {
      alerts.push({
        type: "HIGH_COST",
        severity: "warning",
        message: `Agent interaction cost $${metrics.cost_usd} exceeds threshold`,
        metadata: { cost_usd: metrics.cost_usd },
      });
    }

    // Error
    if (!metrics.success) {
      alerts.push({
        type: "AGENT_ERROR",
        severity: "error",
        message: `Agent interaction failed: ${metrics.error_message || "Unknown error"}`,
        metadata: {
          error_message: metrics.error_message,
          conversation_id: metrics.conversation_id,
        },
      });
    }

    // Log alerts
    for (const alert of alerts) {
      await logStructuredEvent("AGENT_ALERT", {
        ...alert,
        agent_type: metrics.agent_type,
        conversation_id: metrics.conversation_id,
      });
    }
  }

  /**
   * Get real-time statistics
   */
  async getRealTimeStats(): Promise<{
    active_conversations: number;
    messages_last_hour: number;
    avg_latency_last_hour: number;
    cost_last_hour: number;
    error_rate_last_hour: number;
  }> {
    try {
      const oneHourAgo = new Date(Date.now() - 3600000);

      // Get active conversations
      const { count: activeConversations } = await this.supabase
        .from("agent_conversations")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Get metrics from last hour
      const { data: recentMetrics } = await this.supabase
        .from("agent_metrics")
        .select("*")
        .gte("timestamp", oneHourAgo.toISOString());

      const messagesLastHour = recentMetrics?.length || 0;
      const avgLatency =
        messagesLastHour > 0
          ? recentMetrics!.reduce((sum, m) => sum + (m.latency_ms || 0), 0) /
            messagesLastHour
          : 0;
      const totalCost =
        recentMetrics?.reduce((sum, m) => sum + (m.cost_usd || 0), 0) || 0;
      const errorCount =
        recentMetrics?.filter((m) => !m.success).length || 0;
      const errorRate = messagesLastHour > 0 ? errorCount / messagesLastHour : 0;

      return {
        active_conversations: activeConversations || 0,
        messages_last_hour: messagesLastHour,
        avg_latency_last_hour: avgLatency,
        cost_last_hour: totalCost,
        error_rate_last_hour: errorRate,
      };
    } catch (error) {
      console.error("Error fetching real-time stats:", error);
      throw error;
    }
  }
}

/**
 * Create monitoring service instance
 */
export function createMonitoringService(
  supabase: SupabaseClient
): MonitoringService {
  return new MonitoringService(supabase);
}
