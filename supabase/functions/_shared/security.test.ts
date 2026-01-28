/**
 * Tests for security utilities
 * Run with: deno test --allow-env supabase/functions/_shared/security.test.ts
 */

import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  checkRateLimit,
  constantTimeCompare,
  isPlaceholderValue,
  isValidJwtStructure,
  sanitizeErrorMessage,
  validateRequiredEnvVars,
} from "./security.ts";

Deno.test("constantTimeCompare - returns true for equal strings", () => {
  const result = constantTimeCompare("abc123", "abc123");
  assertEquals(result, true);
});

Deno.test("constantTimeCompare - returns false for different strings", () => {
  const result = constantTimeCompare("abc123", "abc124");
  assertEquals(result, false);
});

Deno.test("constantTimeCompare - returns false for different lengths", () => {
  const result = constantTimeCompare("abc", "abcd");
  assertEquals(result, false);
});

Deno.test("validateRequiredEnvVars - throws for missing vars", async () => {
  await assertRejects(
    async () => validateRequiredEnvVars(["NONEXISTENT_VAR_12345"]),
    Error,
    "Missing required environment variables",
  );
});

Deno.test("validateRequiredEnvVars - passes for existing vars", () => {
  Deno.env.set("TEST_VAR_EXISTS", "value");
  validateRequiredEnvVars(["TEST_VAR_EXISTS"]);
  Deno.env.delete("TEST_VAR_EXISTS");
});

Deno.test("isPlaceholderValue - detects CHANGEME", () => {
  Deno.env.set("TEST_PLACEHOLDER", "CHANGEME_VALUE");
  const result = isPlaceholderValue("TEST_PLACEHOLDER");
  assertEquals(result, true);
  Deno.env.delete("TEST_PLACEHOLDER");
});

Deno.test("isPlaceholderValue - returns true for missing var", () => {
  const result = isPlaceholderValue("MISSING_VAR_12345");
  assertEquals(result, true);
});

Deno.test("isPlaceholderValue - returns false for real value", () => {
  Deno.env.set("TEST_REAL_VALUE", "sk_live_abc123");
  const result = isPlaceholderValue("TEST_REAL_VALUE");
  assertEquals(result, false);
  Deno.env.delete("TEST_REAL_VALUE");
});

Deno.test("sanitizeErrorMessage - returns generic in production", () => {
  Deno.env.set("APP_ENV", "production");
  const result = sanitizeErrorMessage(new Error("Sensitive error details"));
  assertEquals(result, "internal_error");
  Deno.env.delete("APP_ENV");
});

Deno.test("sanitizeErrorMessage - returns full error in development", () => {
  Deno.env.set("APP_ENV", "development");
  const error = new Error("Debug error message");
  const result = sanitizeErrorMessage(error);
  assertEquals(result, "Debug error message");
  Deno.env.delete("APP_ENV");
});

Deno.test("isValidJwtStructure - validates correct JWT", () => {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
  const result = isValidJwtStructure(token);
  assertEquals(result, true);
});

Deno.test("isValidJwtStructure - rejects invalid JWT", () => {
  const result = isValidJwtStructure("invalid.token");
  assertEquals(result, false);
});

Deno.test("isValidJwtStructure - rejects null", () => {
  const result = isValidJwtStructure(null);
  assertEquals(result, false);
});

Deno.test("checkRateLimit - allows first request", () => {
  const exceeded = checkRateLimit("test-key-1", 5, 60000);
  assertEquals(exceeded, false);
});

Deno.test("checkRateLimit - enforces limit", () => {
  const key = "test-key-2";
  // First 5 requests should pass
  for (let i = 0; i < 5; i++) {
    const exceeded = checkRateLimit(key, 5, 60000);
    assertEquals(exceeded, false, `Request ${i + 1} should pass`);
  }
  // 6th request should be rate limited
  const exceeded = checkRateLimit(key, 5, 60000);
  assertEquals(exceeded, true);
});
