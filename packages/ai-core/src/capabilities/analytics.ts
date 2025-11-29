/**
 * Analytics and Observability System
 * Tracks agent performance, usage, and insights
 */

import { childLogger } from '@easymo/commons';
import { SupabaseClient } from '@supabase/supabase-js';

const log = childLogger({ service: 'ai-core' });

export interface AnalyticsEvent {
  agentType: string;
  userId: string;
  sessionId: string;
  query: string;
  responseTimeMs: number;
  toolsUsed: string[];
  modelUsed: string;
  success: boolean;
  errorMessage?: string;
  metadata?: any;
}

export interface AgentMetrics {
  totalQueries: number;
  successRate: number;
  averageResponseTime: number;
  mostUsedTools: { tool: string; count: number }[];
  errorRate: number;
  userSatisfaction?: number;
}

/**
 * Analytics Manager
 */
export class AgentAnalytics {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Log an analytics event
   */
  async logEvent(event: AnalyticsEvent): Promise<void> {
    try {
      await this.supabase
        .from('agent_analytics')
        .insert({
          agent_type: event.agentType,
          user_id: event.userId,
          session_id: event.sessionId,
          query: event.query,
          response_time_ms: event.responseTimeMs,
          tools_used: event.toolsUsed,
          model_used: event.modelUsed,
          success: event.success,
          error_message: event.errorMessage,
          metadata: event.metadata || {}
        });
    } catch (error) {
      log.error('Failed to log analytics event:', error);
      // Don't throw - analytics failures shouldn't break agent functionality
    }
  }

  /**
   * Get metrics for a specific agent
   */
  async getAgentMetrics(
    agentType: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AgentMetrics> {
    let query = this.supabase
      .from('agent_analytics')
      .select('*')
      .eq('agent_type', agentType);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error || !data) {
      throw new Error(`Failed to get metrics: ${error?.message}`);
    }

    // Calculate metrics
    const totalQueries = data.length;
    const successfulQueries = data.filter(d => d.success).length;
    const successRate = totalQueries > 0 ? (successfulQueries / totalQueries) * 100 : 0;
    
    const totalResponseTime = data.reduce((sum, d) => sum + d.response_time_ms, 0);
    const averageResponseTime = totalQueries > 0 ? totalResponseTime / totalQueries : 0;

    // Count tool usage
    const toolCounts = new Map<string, number>();
    data.forEach(event => {
      event.tools_used?.forEach((tool: string) => {
        toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
      });
    });

    const mostUsedTools = Array.from(toolCounts.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const errorRate = totalQueries > 0 ? ((totalQueries - successfulQueries) / totalQueries) * 100 : 0;

    return {
      totalQueries,
      successRate,
      averageResponseTime,
      mostUsedTools,
      errorRate
    };
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagement(userId: string): Promise<{
    totalInteractions: number;
    agentsUsed: string[];
    lastInteraction: Date;
    favoriteAgent: string;
  }> {
    const { data, error } = await this.supabase
      .from('agent_analytics')
      .select('agent_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return {
        totalInteractions: 0,
        agentsUsed: [],
        lastInteraction: new Date(),
        favoriteAgent: ''
      };
    }

    const agentCounts = new Map<string, number>();
    const agentsUsed = new Set<string>();

    data.forEach(event => {
      agentsUsed.add(event.agent_type);
      agentCounts.set(event.agent_type, (agentCounts.get(event.agent_type) || 0) + 1);
    });

    const favoriteAgent = Array.from(agentCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    return {
      totalInteractions: data.length,
      agentsUsed: Array.from(agentsUsed),
      lastInteraction: new Date(data[0].created_at),
      favoriteAgent
    };
  }

  /**
   * Get real-time dashboard data
   */
  async getDashboardMetrics(): Promise<{
    activeUsers24h: number;
    totalQueries24h: number;
    averageResponseTime24h: number;
    topAgents: { agent: string; queries: number }[];
  }> {
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const { data, error } = await this.supabase
      .from('agent_analytics')
      .select('agent_type, user_id, response_time_ms')
      .gte('created_at', yesterday.toISOString());

    if (error || !data) {
      return {
        activeUsers24h: 0,
        totalQueries24h: 0,
        averageResponseTime24h: 0,
        topAgents: []
      };
    }

    const uniqueUsers = new Set(data.map(d => d.user_id));
    const totalResponseTime = data.reduce((sum, d) => sum + d.response_time_ms, 0);

    const agentCounts = new Map<string, number>();
    data.forEach(event => {
      agentCounts.set(event.agent_type, (agentCounts.get(event.agent_type) || 0) + 1);
    });

    const topAgents = Array.from(agentCounts.entries())
      .map(([agent, queries]) => ({ agent, queries }))
      .sort((a, b) => b.queries - a.queries)
      .slice(0, 5);

    return {
      activeUsers24h: uniqueUsers.size,
      totalQueries24h: data.length,
      averageResponseTime24h: data.length > 0 ? totalResponseTime / data.length : 0,
      topAgents
    };
  }

  /**
   * Get error insights
   */
  async getErrorInsights(agentType?: string): Promise<{
    totalErrors: number;
    commonErrors: { error: string; count: number }[];
    errorTrend: { date: string; count: number }[];
  }> {
    let query = this.supabase
      .from('agent_analytics')
      .select('error_message, created_at')
      .eq('success', false)
      .not('error_message', 'is', null);

    if (agentType) {
      query = query.eq('agent_type', agentType);
    }

    const { data, error } = await query;

    if (error || !data) {
      return {
        totalErrors: 0,
        commonErrors: [],
        errorTrend: []
      };
    }

    // Count error types
    const errorCounts = new Map<string, number>();
    data.forEach(event => {
      if (event.error_message) {
        errorCounts.set(event.error_message, (errorCounts.get(event.error_message) || 0) + 1);
      }
    });

    const commonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Error trend by day
    const errorsByDay = new Map<string, number>();
    data.forEach(event => {
      const date = new Date(event.created_at).toISOString().split('T')[0];
      errorsByDay.set(date, (errorsByDay.get(date) || 0) + 1);
    });

    const errorTrend = Array.from(errorsByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalErrors: data.length,
      commonErrors,
      errorTrend
    };
  }

  /**
   * Track tool performance
   */
  async getToolPerformance(): Promise<{
    tool: string;
    usageCount: number;
    averageExecutionTime: number;
    successRate: number;
  }[]> {
    const { data, error } = await this.supabase
      .from('agent_analytics')
      .select('tools_used, response_time_ms, success, metadata');

    if (error || !data) {
      return [];
    }

    const toolStats = new Map<string, {
      count: number;
      totalTime: number;
      successes: number;
    }>();

    data.forEach(event => {
      event.tools_used?.forEach((tool: string) => {
        const stats = toolStats.get(tool) || { count: 0, totalTime: 0, successes: 0 };
        stats.count++;
        stats.totalTime += event.response_time_ms;
        if (event.success) stats.successes++;
        toolStats.set(tool, stats);
      });
    });

    return Array.from(toolStats.entries())
      .map(([tool, stats]) => ({
        tool,
        usageCount: stats.count,
        averageExecutionTime: stats.totalTime / stats.count,
        successRate: (stats.successes / stats.count) * 100
      }))
      .sort((a, b) => b.usageCount - a.usageCount);
  }
}

/**
 * Performance monitoring decorator
 */
export function trackPerformance(agentType: string, analytics: AgentAnalytics) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const sessionId = Math.random().toString(36).substring(7);
      let success = true;
      let errorMessage: string | undefined;
      const toolsUsed: string[] = [];

      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } catch (error) {
        success = false;
        errorMessage = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        const responseTimeMs = Date.now() - startTime;
        
        await analytics.logEvent({
          agentType,
          userId: args[0]?.userId || 'unknown',
          sessionId,
          query: args[0]?.query || '',
          responseTimeMs,
          toolsUsed,
          modelUsed: 'gemini-2.5-pro',
          success,
          errorMessage
        });
      }
    };

    return descriptor;
  };
}
