import { NextResponse } from "next/server";
<<<<<<< HEAD

import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function GET() {
  try {
    const supabase = await createClient();

    // Test database connection
    const { error } = await supabase
      .from("saccos")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          status: "unhealthy",
          database: "disconnected",
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
=======
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface HealthCheckResult {
  ok: boolean;
  timestamp: string;
  version: string;
  checks: {
    database: {
      ok: boolean;
      latency_ms?: number;
      error?: string;
    };
    auth: {
      ok: boolean;
      error?: string;
    };
  };
}

export async function GET() {
  const checks: HealthCheckResult["checks"] = {
    database: { ok: false },
    auth: { ok: false },
  };

  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  // If service role isn't configured (e.g., staging probe), return degraded health but 200
  if (!hasServiceRole) {
    const response: HealthCheckResult = {
      ok: false,
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
      checks: {
        database: { ok: false, error: "service_role_not_configured" },
        auth: { ok: false, error: "service_role_not_configured" },
      },
    };
    return NextResponse.json(response, { status: 200 });
  }

  // Check database connectivity
  try {
    const supabase = createSupabaseServiceRoleClient("health-check");
    const dbStart = Date.now();
    const { error: dbError } = await supabase.from("users").select("id").limit(1);
    const dbLatency = Date.now() - dbStart;

    if (dbError) {
      checks.database = { ok: false, error: dbError.message };
    } else {
      checks.database = { ok: true, latency_ms: dbLatency };
    }
  } catch (error) {
    checks.database = {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }

  // Check auth service
  try {
    const supabase = createSupabaseServiceRoleClient("health-check-auth");
    const { error: authError } = await supabase.auth.getSession();
    checks.auth = { ok: !authError, error: authError?.message };
  } catch (error) {
    checks.auth = {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown auth error",
    };
  }

  const overallOk = checks.database.ok && checks.auth.ok;

  const response: HealthCheckResult = {
    ok: overallOk,
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
    checks,
  };

  return NextResponse.json(response, { status: 200 });
>>>>>>> feature/location-caching-and-mobility-deep-review
}
