/**
 * Performance Dashboard Endpoint
 * Exposes metrics and performance data
 */

import { getAllMetrics, exportPrometheusMetrics } from "./metrics.ts";
import { getAllCacheStats } from "../cache/index.ts";
import { getClientPool } from "../database/client-pool.ts";
import { getHandlerLoadingStats } from "../handlers/lazy-loader.ts";
import { getDeduplicationStats } from "../middleware/deduplication.ts";

// ============================================================================
// TYPES
// ============================================================================

export type PerformanceReport = {
  timestamp: string;
  uptime: number;
  metrics: ReturnType<typeof getAllMetrics>;
  cache: ReturnType<typeof getAllCacheStats>;
  clientPool: ReturnType<typeof getClientPool>["getStats"];
  handlers: ReturnType<typeof getHandlerLoadingStats>;
  deduplication: ReturnType<typeof getDeduplicationStats>;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
};

// ============================================================================
// SERVICE START TIME
// ============================================================================

const serviceStartTime = Date.now();

// ============================================================================
// PERFORMANCE ENDPOINT
// ============================================================================

export function generatePerformanceReport(): PerformanceReport {
  let memoryInfo = { heapUsed: 0, heapTotal: 0, external: 0 };
  try {
    const mem = Deno.memoryUsage();
    memoryInfo = {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
    };
  } catch {
    // Memory info not available
  }

  return {
    timestamp: new Date().toISOString(),
    uptime: Date.now() - serviceStartTime,
    metrics: getAllMetrics(),
    cache: getAllCacheStats(),
    clientPool: getClientPool().getStats(),
    handlers: getHandlerLoadingStats(),
    deduplication: getDeduplicationStats(),
    memory: memoryInfo,
  };
}

export function handlePerformanceRequest(req: Request): Response {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json";

  if (format === "prometheus") {
    return new Response(exportPrometheusMetrics(), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const report = generatePerformanceReport();

  return new Response(JSON.stringify(report, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  });
}

export function getHealthMetrics(): {
  status: "healthy" | "degraded" | "unhealthy";
  metrics: Record<string, number>;
} {
  const metrics = getAllMetrics();
  const cacheStats = getAllCacheStats();
  
  const errorRate = calculateErrorRate(metrics.counters);
  const avgLatency = calculateAverageLatency(metrics.histograms);
  const cacheHitRate = calculateCacheHitRate(cacheStats);
  
  let status: "healthy" | "degraded" | "unhealthy" = "healthy";
  
  if (errorRate > 0.1 || avgLatency > 2000) {
    status = "unhealthy";
  } else if (errorRate > 0.05 || avgLatency > 1000 || cacheHitRate < 0.5) {
    status = "degraded";
  }
  
  return {
    status,
    metrics: {
      errorRate,
      avgLatencyMs: avgLatency,
      cacheHitRate,
      uptime: Date.now() - serviceStartTime,
    },
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateErrorRate(counters: Record<string, number>): number {
  let totalRequests = 0;
  let totalErrors = 0;
  
  for (const [key, value] of Object.entries(counters)) {
    if (key.includes("http_requests_total")) {
      totalRequests += value;
      if (key.includes('status="4') || key.includes('status="5')) {
        totalErrors += value;
      }
    }
  }
  
  return totalRequests > 0 ? totalErrors / totalRequests : 0;
}

function calculateAverageLatency(histograms: Record<string, any>): number {
  let totalAvg = 0;
  let count = 0;
  
  for (const [key, stats] of Object.entries(histograms)) {
    if (key.includes("duration_ms") && stats.count > 0) {
      totalAvg += stats.avg;
      count++;
    }
  }
  
  return count > 0 ? totalAvg / count : 0;
}

function calculateCacheHitRate(cacheStats: ReturnType<typeof getAllCacheStats>): number {
  let totalHits = 0;
  let totalMisses = 0;
  
  for (const stats of Object.values(cacheStats)) {
    totalHits += stats.hits;
    totalMisses += stats.misses;
  }
  
  const total = totalHits + totalMisses;
  return total > 0 ? totalHits / total : 0;
}
