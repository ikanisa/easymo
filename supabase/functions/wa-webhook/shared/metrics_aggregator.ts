/**
 * Metrics Aggregator for AI Agents
 *
 * Collects and aggregates metrics for monitoring:
 * - Request counts
 * - Success/failure rates
 * - Token usage & costs
 * - Latency statistics
 * - Tool execution metrics
 *
 * ADDITIVE ONLY - New file for enhanced monitoring
 */

import { logStructuredEvent } from "../observe/log.ts";

export interface RequestMetrics {
  success: boolean;
  tokens: number;
  cost: number;
  latencyMs: number;
  agentType?: string;
  toolsUsed?: string[];
}

export interface AggregatedMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  successRate: number;
  avgTokensPerRequest: number;
  avgCostPerRequest: number;
  toolExecutions: Record<string, number>;
  agentTypeBreakdown: Record<string, number>;
  lastHourRequests: number;
  lastHourTokens: number;
  lastHourCost: number;
}

type IntervalHandle = number & { unref?: () => void };

export class MetricsAggregator {
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    totalLatencyMs: 0,
    minLatencyMs: Infinity,
    maxLatencyMs: 0,
    toolExecutions: new Map<string, number>(),
    agentTypeBreakdown: new Map<string, number>(),
    hourlyBuckets: [] as Array<{
      timestamp: number;
      requests: number;
      tokens: number;
      cost: number;
    }>,
  };

  private startTime = Date.now();
  private cleanupInterval?: IntervalHandle;

  constructor() {
    // Cleanup old hourly buckets every 5 minutes
    const handle = setInterval(() => this.cleanupOldBuckets(), 300000) as IntervalHandle;
    handle.unref?.();
    this.cleanupInterval = handle;
  }

  /**
   * Record a request
   */
  recordRequest(metrics: RequestMetrics): void {
    this.metrics.totalRequests++;
    
    if (metrics.success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    this.metrics.totalTokens += metrics.tokens;
    this.metrics.totalCostUsd += metrics.cost;
    this.metrics.totalLatencyMs += metrics.latencyMs;
    
    // Track latency bounds
    if (metrics.latencyMs < this.metrics.minLatencyMs) {
      this.metrics.minLatencyMs = metrics.latencyMs;
    }
    if (metrics.latencyMs > this.metrics.maxLatencyMs) {
      this.metrics.maxLatencyMs = metrics.latencyMs;
    }
    
    // Track agent type
    if (metrics.agentType) {
      const count = this.metrics.agentTypeBreakdown.get(metrics.agentType) || 0;
      this.metrics.agentTypeBreakdown.set(metrics.agentType, count + 1);
    }
    
    // Track tool executions
    if (metrics.toolsUsed) {
      for (const tool of metrics.toolsUsed) {
        const count = this.metrics.toolExecutions.get(tool) || 0;
        this.metrics.toolExecutions.set(tool, count + 1);
      }
    }
    
    // Add to hourly bucket
    this.addToHourlyBucket(metrics);
    
    // Log if significant thresholds crossed
    this.checkThresholds(metrics);
  }

  /**
   * Get aggregated metrics
   */
  getMetrics(): AggregatedMetrics {
    const avgLatency = this.metrics.totalRequests > 0
      ? this.metrics.totalLatencyMs / this.metrics.totalRequests
      : 0;
    
    const successRate = this.metrics.totalRequests > 0
      ? this.metrics.successfulRequests / this.metrics.totalRequests
      : 1;
    
    const avgTokensPerRequest = this.metrics.totalRequests > 0
      ? this.metrics.totalTokens / this.metrics.totalRequests
      : 0;
    
    const avgCostPerRequest = this.metrics.totalRequests > 0
      ? this.metrics.totalCostUsd / this.metrics.totalRequests
      : 0;
    
    // Calculate last hour stats
    const lastHour = this.getLastHourStats();
    
    return {
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      totalTokens: this.metrics.totalTokens,
      totalCostUsd: parseFloat(this.metrics.totalCostUsd.toFixed(6)),
      avgLatencyMs: parseFloat(avgLatency.toFixed(2)),
      minLatencyMs: this.metrics.minLatencyMs === Infinity ? 0 : this.metrics.minLatencyMs,
      maxLatencyMs: this.metrics.maxLatencyMs,
      successRate: parseFloat(successRate.toFixed(4)),
      avgTokensPerRequest: parseFloat(avgTokensPerRequest.toFixed(2)),
      avgCostPerRequest: parseFloat(avgCostPerRequest.toFixed(6)),
      toolExecutions: Object.fromEntries(this.metrics.toolExecutions),
      agentTypeBreakdown: Object.fromEntries(this.metrics.agentTypeBreakdown),
      lastHourRequests: lastHour.requests,
      lastHourTokens: lastHour.tokens,
      lastHourCost: parseFloat(lastHour.cost.toFixed(6)),
    };
  }

  /**
   * Get metrics summary for logging
   */
  getMetricsSummary(): string {
    const metrics = this.getMetrics();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    return [
      `📊 AI Agent Metrics Summary`,
      ``,
      `Uptime: ${this.formatDuration(uptime)}`,
      `Total Requests: ${metrics.totalRequests}`,
      `Success Rate: ${(metrics.successRate * 100).toFixed(2)}%`,
      `Avg Latency: ${metrics.avgLatencyMs}ms`,
      `Total Tokens: ${metrics.totalTokens.toLocaleString()}`,
      `Total Cost: $${metrics.totalCostUsd.toFixed(4)}`,
      ``,
      `Last Hour: ${metrics.lastHourRequests} requests, ${metrics.lastHourTokens.toLocaleString()} tokens, $${metrics.lastHourCost.toFixed(4)}`,
    ].join("\n");
  }

  /**
   * Reset metrics (for testing)
   */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      totalLatencyMs: 0,
      minLatencyMs: Infinity,
      maxLatencyMs: 0,
      toolExecutions: new Map(),
      agentTypeBreakdown: new Map(),
      hourlyBuckets: [],
    };
    this.startTime = Date.now();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Add metrics to hourly bucket
   */
  private addToHourlyBucket(metrics: RequestMetrics): void {
    const now = Date.now();
    const bucketTime = Math.floor(now / 60000) * 60000; // Round to minute
    
    let bucket = this.metrics.hourlyBuckets.find(b => b.timestamp === bucketTime);
    
    if (!bucket) {
      bucket = {
        timestamp: bucketTime,
        requests: 0,
        tokens: 0,
        cost: 0,
      };
      this.metrics.hourlyBuckets.push(bucket);
    }
    
    bucket.requests++;
    bucket.tokens += metrics.tokens;
    bucket.cost += metrics.cost;
  }

  /**
   * Get last hour statistics
   */
  private getLastHourStats(): {
    requests: number;
    tokens: number;
    cost: number;
  } {
    const oneHourAgo = Date.now() - 3600000;
    
    const recentBuckets = this.metrics.hourlyBuckets.filter(
      b => b.timestamp >= oneHourAgo
    );
    
    return recentBuckets.reduce(
      (acc, bucket) => ({
        requests: acc.requests + bucket.requests,
        tokens: acc.tokens + bucket.tokens,
        cost: acc.cost + bucket.cost,
      }),
      { requests: 0, tokens: 0, cost: 0 }
    );
  }

  /**
   * Cleanup old hourly buckets (keep last 24 hours)
   */
  private cleanupOldBuckets(): void {
    const cutoff = Date.now() - 86400000; // 24 hours
    
    this.metrics.hourlyBuckets = this.metrics.hourlyBuckets.filter(
      b => b.timestamp >= cutoff
    );
  }

  /**
   * Check if metrics cross important thresholds
   */
  private checkThresholds(metrics: RequestMetrics): void {
    const current = this.getMetrics();
    
    // Alert on low success rate
    if (current.totalRequests >= 10 && current.successRate < 0.8) {
      logStructuredEvent("METRICS_ALERT_LOW_SUCCESS_RATE", {
        success_rate: current.successRate,
        total_requests: current.totalRequests,
      });
    }
    
    // Alert on high latency
    if (metrics.latencyMs > 5000) {
      logStructuredEvent("METRICS_ALERT_HIGH_LATENCY", {
        latency_ms: metrics.latencyMs,
        avg_latency: current.avgLatencyMs,
      });
    }
    
    // Alert on high cost
    const hourlyStats = this.getLastHourStats();
    if (hourlyStats.cost > 1.0) {
      logStructuredEvent("METRICS_ALERT_HIGH_HOURLY_COST", {
        hourly_cost: hourlyStats.cost,
        hourly_requests: hourlyStats.requests,
      });
    }
  }

  /**
   * Format duration in human-readable form
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(" ");
  }
}

/**
 * Singleton instance
 */
let metricsInstance: MetricsAggregator | null = null;

export function getMetricsAggregator(): MetricsAggregator {
  if (!metricsInstance) {
    metricsInstance = new MetricsAggregator();
  }
  return metricsInstance;
}

/**
 * Reset metrics (for testing)
 */
export function resetMetrics(): void {
  if (metricsInstance) {
    metricsInstance.reset();
  }
}
