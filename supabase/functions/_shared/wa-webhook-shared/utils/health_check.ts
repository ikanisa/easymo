/**
 * Enhanced Health Check for wa-webhook
 * 
 * Provides comprehensive health monitoring including rate limiter,
 * cache, and database connectivity.
 * 
 * @see docs/GROUND_RULES.md
 */

import { supabase } from "../config.ts";
import { getCacheStats } from "./cache.ts";
import { getMetricsStats } from "./metrics_collector.ts";
import { getRateLimitStats } from "./rate_limiter.ts";

interface HealthCheck {
  healthy: boolean;
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    database: HealthCheckResult;
    rateLimiter: HealthCheckResult;
    cache: HealthCheckResult;
    metrics: HealthCheckResult;
  };
  version: string;
  environment: string;
  timestamp: string;
  uptime: number;
}

interface HealthCheckResult {
  healthy: boolean;
  message?: string;
  details?: any;
  responseTime?: number;
}

const startTime = Date.now();

/**
 * Check database health
 */
async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    // Simple query to check connectivity
    const { error } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);
    
    const responseTime = Date.now() - start;
    
    if (error) {
      return {
        healthy: false,
        message: "Database query failed",
        details: { error: error.message },
        responseTime,
      };
    }
    
    return {
      healthy: true,
      message: "Database connected",
      responseTime,
    };
  } catch (error) {
    return {
      healthy: false,
      message: "Database connection failed",
      details: { error: String(error) },
      responseTime: Date.now() - start,
    };
  }
}

/**
 * Check rate limiter health
 */
function checkRateLimiter(): HealthCheckResult {
  try {
    const stats = getRateLimitStats();
    const healthy = stats.bucketsCount < 5000; // Alert if too many buckets
    
    return {
      healthy,
      message: healthy ? "Rate limiter operational" : "Rate limiter degraded",
      details: stats,
    };
  } catch (error) {
    return {
      healthy: false,
      message: "Rate limiter check failed",
      details: { error: String(error) },
    };
  }
}

/**
 * Check cache health
 */
function checkCache(): HealthCheckResult {
  try {
    const stats = getCacheStats();
    const healthy = stats.size < stats.maxSize * 0.9;
    
    return {
      healthy,
      message: healthy ? "Cache operational" : "Cache near capacity",
      details: stats,
    };
  } catch (error) {
    return {
      healthy: false,
      message: "Cache check failed",
      details: { error: String(error) },
    };
  }
}

/**
 * Check metrics collector health
 */
function checkMetrics(): HealthCheckResult {
  try {
    const stats = getMetricsStats();
    
    return {
      healthy: true,
      message: "Metrics collector operational",
      details: stats,
    };
  } catch (error) {
    return {
      healthy: false,
      message: "Metrics collector check failed",
      details: { error: String(error) },
    };
  }
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthCheck> {
  const [database, rateLimiter, cache, metrics] = await Promise.all([
    checkDatabase(),
    Promise.resolve(checkRateLimiter()),
    Promise.resolve(checkCache()),
    Promise.resolve(checkMetrics()),
  ]);

  const checks = { database, rateLimiter, cache, metrics };
  
  // Determine overall health
  const allHealthy = Object.values(checks).every(check => check.healthy);
  const anyUnhealthy = Object.values(checks).some(check => !check.healthy);
  
  let status: "healthy" | "degraded" | "unhealthy";
  if (allHealthy) {
    status = "healthy";
  } else if (anyUnhealthy && database.healthy) {
    status = "degraded"; // Some non-critical systems failing
  } else {
    status = "unhealthy"; // Critical systems failing
  }

  return {
    healthy: allHealthy,
    status,
    checks,
    version: "2.0.0",
    environment: Deno.env.get("APP_ENV") || Deno.env.get("NODE_ENV") || "production",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000), // seconds
  };
}

/**
 * Create health check response
 */
export async function createHealthCheckResponse(): Promise<Response> {
  const health = await performHealthCheck();
  
  const statusCode = health.status === "healthy" ? 200 : 
                     health.status === "degraded" ? 200 : 503;
  
  return new Response(
    JSON.stringify(health, null, 2),
    {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}

/**
 * Simple liveness probe (for Kubernetes, etc.)
 */
export function createLivenessResponse(): Response {
  return new Response("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * Readiness probe (checks critical dependencies)
 */
export async function createReadinessResponse(): Promise<Response> {
  const database = await checkDatabase();
  
  if (database.healthy) {
    return new Response("Ready", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  
  return new Response("Not Ready", {
    status: 503,
    headers: { "Content-Type": "text/plain" },
  });
}
