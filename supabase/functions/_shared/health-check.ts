/**
 * Standardized Health Check Implementation
 * Used across all microservices for consistent health reporting
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type HealthCheckResult = {
  status: HealthStatus;
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  checks: {
    database: "connected" | "disconnected" | "error";
    latency?: string;
  };
  dependencies?: Record<string, boolean>;
  errors?: string[];
};

// Track service start time for uptime calculation
const SERVICE_START_TIME = Date.now();

export async function performHealthCheck(
  serviceName: string,
  version: string,
  supabase: SupabaseClient,
  options: {
    checkDependencies?: string[];
    customChecks?: () => Promise<Record<string, boolean>>;
  } = {}
): Promise<HealthCheckResult> {
  const startTime = performance.now();
  const errors: string[] = [];
  
  // Check database connectivity
  let dbStatus: "connected" | "disconnected" | "error" = "error";
  try {
    const { error } = await supabase
      .from("profiles")
      .select("user_id")
      .limit(1);
    dbStatus = error ? "disconnected" : "connected";
    if (error) {
      errors.push(`Database: ${error.message}`);
    }
  } catch (err) {
    dbStatus = "error";
    errors.push(`Database: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Check dependencies (other microservices)
  const dependencies: Record<string, boolean> = {};
  if (options.checkDependencies) {
    const baseUrl = Deno.env.get("SUPABASE_URL");
    for (const dep of options.checkDependencies) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(`${baseUrl}/functions/v1/${dep}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        dependencies[dep] = response.ok;
      } catch {
        dependencies[dep] = false;
      }
    }
  }

  // Run custom checks
  if (options.customChecks) {
    try {
      const customResults = await options.customChecks();
      Object.assign(dependencies, customResults);
    } catch (err) {
      errors.push(`Custom check: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const latencyMs = performance.now() - startTime;
  const uptimeSeconds = Math.floor((Date.now() - SERVICE_START_TIME) / 1000);

  // Determine overall status
  let status: HealthStatus = "healthy";
  if (dbStatus !== "connected") {
    status = "unhealthy";
  } else if (Object.values(dependencies).some((v) => !v)) {
    status = "degraded";
  }

  return {
    status,
    service: serviceName,
    version,
    timestamp: new Date().toISOString(),
    uptime: uptimeSeconds,
    checks: {
      database: dbStatus,
      latency: `${Math.round(latencyMs)}ms`,
    },
    dependencies: Object.keys(dependencies).length > 0 ? dependencies : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Create health check response
 */
export function healthResponse(result: HealthCheckResult): Response {
  const status = result.status === "healthy" ? 200 : 
                 result.status === "degraded" ? 200 : 503;
  
  return new Response(JSON.stringify(result, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
