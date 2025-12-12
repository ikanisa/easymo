// Health check utilities

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

export interface HealthCheckResult {
  status: "healthy" | "unhealthy";
  service: string;
  timestamp: string;
  checks: {
    database?: "connected" | "disconnected";
    [key: string]: string | undefined;
  };
  error?: string;
}

export async function performHealthCheck(
  service: string,
  supabase: SupabaseClient,
  additionalChecks: Record<string, () => Promise<boolean>> = {}
): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    status: "healthy",
    service,
    timestamp: new Date().toISOString(),
    checks: {},
  };

  try {
    // Check database connection
    const { error: dbError } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    result.checks.database = dbError ? "disconnected" : "connected";
    
    if (dbError) {
      result.status = "unhealthy";
      result.error = `Database check failed: ${dbError.message}`;
    }

    // Run additional checks
    for (const [name, check] of Object.entries(additionalChecks)) {
      try {
        const passed = await check();
        result.checks[name] = passed ? "ok" : "failed";
        if (!passed) {
          result.status = "unhealthy";
        }
      } catch (err) {
        result.checks[name] = "error";
        result.status = "unhealthy";
        result.error = result.error
          ? `${result.error}; ${name}: ${err}`
          : `${name}: ${err}`;
      }
    }
  } catch (err) {
    result.status = "unhealthy";
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

export function createHealthCheckResponse(
  result: HealthCheckResult
): Response {
  const status = result.status === "healthy" ? 200 : 503;
  return new Response(JSON.stringify(result, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
