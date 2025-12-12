/**
 * Health Check Handler
 * Provides service health status
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { getEnv, SERVICES } from "../../_shared/config/index.ts";
import type { HealthCheckResponse } from "../../_shared/types/index.ts";

const SERVICE_VERSION = "2.3.0";
const serviceStartTime = Date.now();

/**
 * Perform health check
 */
export async function performHealthCheck(): Promise<HealthCheckResponse> {
  const env = getEnv();
  const checks: HealthCheckResponse["checks"] = {
    database: "disconnected",
  };

  // Test database connection
  try {
    const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
    const startTime = performance.now();
    const { error } = await supabase.from("profiles").select("user_id").limit(1);
    const latency = performance.now() - startTime;
    
    checks.database = error ? "error" : "connected";
    checks.latency = `${Math.round(latency)}ms`;
  } catch {
    checks.database = "error";
  }

  // Check dependencies
  const dependencies: Record<string, boolean> = {};
  try {
    const mobilityCheck = await fetch(`${env.supabaseUrl}/functions/v1/${SERVICES.MOBILITY}/health`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${env.supabaseServiceRoleKey}` },
    });
    dependencies[SERVICES.MOBILITY] = mobilityCheck.ok;
  } catch {
    dependencies[SERVICES.MOBILITY] = false;
  }

  // Determine overall status
  const status = checks.database === "connected" ? "healthy" : "degraded";

  return {
    status,
    service: SERVICES.CORE,
    version: SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - serviceStartTime) / 1000),
    checks,
    dependencies,
  };
}

/**
 * Create health check response
 */
export function healthResponse(result: HealthCheckResponse): Response {
  const status = result.status === "healthy" ? 200 : result.status === "degraded" ? 503 : 500;
  
  return new Response(JSON.stringify(result), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
