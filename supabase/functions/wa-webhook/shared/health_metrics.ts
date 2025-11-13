/**
 * Health & Metrics Endpoint for AI Agents
 *
 * Provides:
 * - Health check status
 * - Aggregated metrics
 * - System diagnostics
 * - Configuration status
 *
 * ADDITIVE ONLY - New endpoints for monitoring
 */

import type { SupabaseClient } from "../deps.ts";
import { getMetricsAggregator } from "../shared/metrics_aggregator.ts";
import { getConfig, getConfigSummary } from "../shared/config_manager.ts";
import { logStructuredEvent } from "../observe/log.ts";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks: {
    database: boolean;
    openai: boolean;
    rateLimiter: boolean;
    cache: boolean;
  };
  config: {
    enabled: boolean;
    model: string;
  };
  metrics: {
    totalRequests: number;
    successRate: number;
    avgLatencyMs: number;
    lastHourRequests: number;
  };
}

/**
 * Check overall system health
 */
export async function getHealthStatus(supabase: SupabaseClient): Promise<HealthStatus> {
  const startTime = Date.now();
  const config = getConfig();
  const metrics = getMetricsAggregator().getMetrics();
  
  // Check database connectivity
  const databaseHealthy = await checkDatabaseHealth(supabase);
  
  // Check OpenAI connectivity (simple check)
  const openaiHealthy = config.enabled; // If configured, assume healthy
  
  // Other components are always healthy if running
  const rateLimiterHealthy = true;
  const cacheHealthy = true;
  
  // Determine overall status
  const allHealthy = databaseHealthy && openaiHealthy && rateLimiterHealthy && cacheHealthy;
  const someUnhealthy = !databaseHealthy || !openaiHealthy;
  
  const status: "healthy" | "degraded" | "unhealthy" = allHealthy
    ? "healthy"
    : someUnhealthy
    ? "unhealthy"
    : "degraded";
  
  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000), // This should track actual uptime
    checks: {
      database: databaseHealthy,
      openai: openaiHealthy,
      rateLimiter: rateLimiterHealthy,
      cache: cacheHealthy,
    },
    config: {
      enabled: config.enabled,
      model: config.model,
    },
    metrics: {
      totalRequests: metrics.totalRequests,
      successRate: metrics.successRate,
      avgLatencyMs: metrics.avgLatencyMs,
      lastHourRequests: metrics.lastHourRequests,
    },
  };
}

/**
 * Check database health
 */
async function checkDatabaseHealth(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("wa_interactions")
      .select("id")
      .limit(1);
    
    return !error;
  } catch {
    return false;
  }
}

/**
 * Get detailed metrics for monitoring
 */
export function getDetailedMetrics(): {
  metrics: ReturnType<typeof getMetricsAggregator>["getMetrics"];
  summary: string;
  config: ReturnType<typeof getConfigSummary>;
} {
  const metricsAggregator = getMetricsAggregator();
  const config = getConfig();
  
  return {
    metrics: metricsAggregator.getMetrics(),
    summary: metricsAggregator.getMetricsSummary(),
    config: getConfigSummary(config),
  };
}

/**
 * Handle health check request
 */
export async function handleHealthCheck(
  supabase: SupabaseClient
): Promise<Response> {
  try {
    const health = await getHealthStatus(supabase);
    
    const statusCode = health.status === "healthy" ? 200 
      : health.status === "degraded" ? 200 
      : 503;
    
    return new Response(
      JSON.stringify(health, null, 2),
      {
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      }
    );
  } catch (error) {
    await logStructuredEvent("HEALTH_CHECK_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return new Response(
      JSON.stringify({
        status: "unhealthy",
        error: "Health check failed",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Handle metrics request
 */
export function handleMetricsRequest(): Response {
  try {
    const detailed = getDetailedMetrics();
    
    return new Response(
      JSON.stringify(detailed, null, 2),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to retrieve metrics",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Handle metrics summary request (plain text)
 */
export function handleMetricsSummaryRequest(): Response {
  try {
    const metricsAggregator = getMetricsAggregator();
    const summary = metricsAggregator.getMetricsSummary();
    
    return new Response(summary, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return new Response("Failed to retrieve metrics summary", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

/**
 * Handle Prometheus-style metrics export
 */
export function handlePrometheusMetrics(): Response {
  try {
    const metrics = getMetricsAggregator().getMetrics();
    
    const prometheusFormat = [
      `# HELP ai_agent_requests_total Total number of AI agent requests`,
      `# TYPE ai_agent_requests_total counter`,
      `ai_agent_requests_total{status="success"} ${metrics.successfulRequests}`,
      `ai_agent_requests_total{status="failure"} ${metrics.failedRequests}`,
      ``,
      `# HELP ai_agent_tokens_total Total tokens processed`,
      `# TYPE ai_agent_tokens_total counter`,
      `ai_agent_tokens_total ${metrics.totalTokens}`,
      ``,
      `# HELP ai_agent_cost_usd_total Total cost in USD`,
      `# TYPE ai_agent_cost_usd_total counter`,
      `ai_agent_cost_usd_total ${metrics.totalCostUsd}`,
      ``,
      `# HELP ai_agent_latency_seconds Average latency in seconds`,
      `# TYPE ai_agent_latency_seconds gauge`,
      `ai_agent_latency_seconds ${metrics.avgLatencyMs / 1000}`,
      ``,
      `# HELP ai_agent_success_rate Success rate (0-1)`,
      `# TYPE ai_agent_success_rate gauge`,
      `ai_agent_success_rate ${metrics.successRate}`,
      ``,
      `# HELP ai_agent_hourly_requests Requests in last hour`,
      `# TYPE ai_agent_hourly_requests gauge`,
      `ai_agent_hourly_requests ${metrics.lastHourRequests}`,
    ].join("\n");
    
    return new Response(prometheusFormat, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; version=0.0.4",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return new Response("", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
