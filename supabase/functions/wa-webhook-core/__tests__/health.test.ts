/**
 * Health Check Tests
 * Tests for health endpoint functionality in wa-webhook-core
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { createMockSupabase, createTestSuite } from "../../_shared/testing/test-utils.ts";

// ============================================================================
// HEALTH CHECK TESTS
// ============================================================================

type HealthStatus = {
  status: "healthy" | "unhealthy";
  service: string;
  timestamp: string;
  checks: Record<string, string>;
  version?: string;
};

async function mockPerformHealthCheck(supabase: any): Promise<HealthStatus> {
  const checks: Record<string, string> = {};

  // Check database
  try {
    const { error } = await supabase.from("profiles").select("user_id").limit(1);
    checks.database = error ? "disconnected" : "connected";
  } catch {
    checks.database = "error";
  }

  const status = checks.database === "connected" ? "healthy" : "unhealthy";

  return {
    status,
    service: "wa-webhook-core",
    timestamp: new Date().toISOString(),
    checks,
    version: "1.0.0",
  };
}

const healthSuite = createTestSuite("Health - Status Checks");

healthSuite.test("returns healthy when database connected", async () => {
  const supabase = createMockSupabase({
    data: { profiles: [{ user_id: "test" }] },
  });

  const result = await mockPerformHealthCheck(supabase);

  assertEquals(result.status, "healthy");
  assertEquals(result.service, "wa-webhook-core");
  assertEquals(result.checks.database, "connected");
  assertExists(result.timestamp);
});

healthSuite.test("returns unhealthy when database disconnected", async () => {
  const supabase = createMockSupabase({
    error: { message: "Connection refused" },
  });

  const result = await mockPerformHealthCheck(supabase);

  assertEquals(result.status, "unhealthy");
  assertEquals(result.checks.database, "disconnected");
});

healthSuite.test("includes timestamp in ISO format", async () => {
  const supabase = createMockSupabase({
    data: { profiles: [] },
  });

  const result = await mockPerformHealthCheck(supabase);

  const date = new Date(result.timestamp);
  assertEquals(isNaN(date.getTime()), false);
});

healthSuite.test("includes service name", async () => {
  const supabase = createMockSupabase({
    data: { profiles: [] },
  });

  const result = await mockPerformHealthCheck(supabase);

  assertEquals(result.service, "wa-webhook-core");
});

healthSuite.test("includes version information", async () => {
  const supabase = createMockSupabase({
    data: { profiles: [] },
  });

  const result = await mockPerformHealthCheck(supabase);

  assertExists(result.version);
});

console.log("✅ Health check tests loaded");
