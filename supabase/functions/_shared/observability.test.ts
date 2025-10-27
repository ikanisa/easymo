/**
 * Tests for observability utilities
 * Run with: deno test --allow-env supabase/functions/_shared/observability.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  maskPII,
  generateCorrelationId,
  logStructuredEvent,
  recordMetric,
} from "./observability.ts";

Deno.test("maskPII - masks phone numbers correctly", () => {
  const masked = maskPII("+250788123456", 7, 3);
  assertEquals(masked, "+250788***456");
});

Deno.test("maskPII - handles short strings", () => {
  const masked = maskPII("abc", 4, 3);
  assertEquals(masked, "***");
});

Deno.test("maskPII - handles null values", () => {
  const masked = maskPII(null);
  assertEquals(masked, null);
});

Deno.test("generateCorrelationId - generates valid UUID", () => {
  const id = generateCorrelationId();
  assertExists(id);
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assertEquals(uuidRegex.test(id), true);
});

Deno.test("logStructuredEvent - does not throw", () => {
  // Just verify it doesn't throw
  logStructuredEvent("TEST_EVENT", { key: "value" });
  logStructuredEvent("TEST_ERROR", { error: "message" }, "error");
});

Deno.test("recordMetric - does not throw", () => {
  recordMetric("test.metric", 1, { dimension: "value" });
  recordMetric("test.counter", 5);
});
