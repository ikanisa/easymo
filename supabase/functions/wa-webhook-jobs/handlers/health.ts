import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { logStructuredEvent } from "../../_shared/observability.ts";

export interface HealthCheckResult {
  status: "healthy" | "unhealthy" | "degraded";
  service: string;
  timestamp: string;
  checks: Record<string, { status: "ok" | "error"; message?: string; latencyMs?: number }>;
}

/**
 * Comprehensive health check for wa-webhook-jobs service.
 * Verifies connectivity to all job-related tables.
 */
export async function handleHealthCheck(
  supabase: SupabaseClient
): Promise<Response> {
  const startTime = Date.now();
  const checks: HealthCheckResult["checks"] = {};
  let overallHealthy = true;
  let degraded = false;

  // Check job_listings table
  const jobListingsStart = Date.now();
  try {
    const { error } = await supabase
      .from("job_listings")
      .select("id")
      .limit(1);

    if (error) {
      checks.job_listings = { status: "error", message: error.message };
      overallHealthy = false;
    } else {
      checks.job_listings = { status: "ok", latencyMs: Date.now() - jobListingsStart };
    }
  } catch (err) {
    checks.job_listings = { 
      status: "error", 
      message: err instanceof Error ? err.message : String(err) 
    };
    overallHealthy = false;
  }

  // Check job_seekers table
  const jobSeekersStart = Date.now();
  try {
    const { error } = await supabase
      .from("job_seekers")
      .select("id")
      .limit(1);

    if (error) {
      checks.job_seekers = { status: "error", message: error.message };
      degraded = true; // Non-critical - service can still work
    } else {
      checks.job_seekers = { status: "ok", latencyMs: Date.now() - jobSeekersStart };
    }
  } catch (err) {
    checks.job_seekers = { 
      status: "error", 
      message: err instanceof Error ? err.message : String(err) 
    };
    degraded = true;
  }

  // Check job_applications table
  const jobAppsStart = Date.now();
  try {
    const { error } = await supabase
      .from("job_applications")
      .select("id")
      .limit(1);

    if (error) {
      checks.job_applications = { status: "error", message: error.message };
      degraded = true;
    } else {
      checks.job_applications = { status: "ok", latencyMs: Date.now() - jobAppsStart };
    }
  } catch (err) {
    checks.job_applications = { 
      status: "error", 
      message: err instanceof Error ? err.message : String(err) 
    };
    degraded = true;
  }

  // Check environment variables
  const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missingEnvVars = requiredEnvVars.filter(v => !Deno.env.get(v));
  
  if (missingEnvVars.length > 0) {
    checks.environment = { 
      status: "error", 
      message: `Missing: ${missingEnvVars.join(", ")}` 
    };
    overallHealthy = false;
  } else {
    checks.environment = { status: "ok" };
  }

  // Determine overall status
  let status: HealthCheckResult["status"] = "healthy";
  if (!overallHealthy) {
    status = "unhealthy";
  } else if (degraded) {
    status = "degraded";
  }

  const result: HealthCheckResult = {
    status,
    service: "wa-webhook-jobs",
    timestamp: new Date().toISOString(),
    checks,
  };

  // Log health check result
  logStructuredEvent(
    status === "healthy" ? "JOBS_HEALTH_OK" : "JOBS_HEALTH_ISSUE",
    {
      service: "wa-webhook-jobs",
      status,
      totalLatencyMs: Date.now() - startTime,
      checksCount: Object.keys(checks).length,
    },
    status === "healthy" ? "info" : "warn"
  );

  return new Response(
    JSON.stringify(result, null, 2),
    {
      status: status === "unhealthy" ? 503 : 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
