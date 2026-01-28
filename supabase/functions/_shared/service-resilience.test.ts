import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";

import {
  checkRateLimit,
  cleanupRateLimitState,
  getCircuitState,
  isServiceCircuitOpen,
  recordServiceFailure,
  recordServiceSuccess,
} from "./service-resilience.ts";

// Reset state between tests (modules maintain state in memory)
function resetTestService(service: string) {
  // Force close circuit by recording success when half-open
  recordServiceSuccess(service);
}

Deno.test("circuit breaker - starts in closed state", () => {
  const state = getCircuitState("test-service-1");
  assertEquals(state.state, "closed");
  assertEquals(state.failures, 0);
});

Deno.test("circuit breaker - opens after threshold failures", () => {
  const service = "test-service-2";
  
  // Record failures up to threshold (default is 5)
  for (let i = 0; i < 5; i++) {
    recordServiceFailure(service, 503, "test-correlation");
  }
  
  const isOpen = isServiceCircuitOpen(service);
  assertEquals(isOpen, true);
  
  const state = getCircuitState(service);
  assertEquals(state.state, "open");
  assertEquals(state.failures, 5);
});

Deno.test("circuit breaker - success resets failure count in closed state", () => {
  const service = "test-service-3";
  
  // Record some failures (not enough to open)
  recordServiceFailure(service, 500, "test");
  recordServiceFailure(service, 500, "test");
  
  let state = getCircuitState(service);
  assertEquals(state.failures, 2);
  
  // Record success
  recordServiceSuccess(service);
  
  state = getCircuitState(service);
  assertEquals(state.failures, 0);
});

Deno.test("rate limiter - allows requests under limit", () => {
  const phone = "+250788000001";
  
  const result = checkRateLimit(phone);
  assertEquals(result.allowed, true);
  assertEquals(typeof result.remaining, "number");
  assertEquals(typeof result.resetAt, "number");
});

Deno.test("rate limiter - blocks requests over limit", () => {
  const phone = "+250788000002";
  
  // Make many requests to exceed limit (default is 30)
  for (let i = 0; i < 31; i++) {
    const result = checkRateLimit(phone);
    if (i < 30) {
      assertEquals(result.allowed, true);
    } else {
      assertEquals(result.allowed, false);
    }
  }
});

Deno.test("rate limiter - normalizes phone numbers", () => {
  const phone1 = "+250-788-000-003";
  const phone2 = "+250788000003";
  
  // Both should share the same rate limit
  for (let i = 0; i < 15; i++) {
    checkRateLimit(phone1);
  }
  
  const result = checkRateLimit(phone2);
  // Should have 14 remaining (30 - 16 = 14)
  assertEquals(result.remaining, 14);
});

Deno.test("cleanup removes old rate limit entries", () => {
  // This test verifies cleanup doesn't crash
  const cleaned = cleanupRateLimitState();
  assertEquals(typeof cleaned, "number");
});
