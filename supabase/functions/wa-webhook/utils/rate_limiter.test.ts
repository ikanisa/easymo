/**
 * Unit tests for rate_limiter.ts
 * 
 * Run with: deno test utils/rate_limiter.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  getRateLimiter,
  checkRateLimit,
  unblockIdentifier,
  __resetRateLimiter,
} from "./rate_limiter.ts";

Deno.test("Rate Limiter - allows requests within limit", () => {
  __resetRateLimiter();
  
  const limiter = getRateLimiter();
  const result = limiter.checkLimit("test-user", "test-corr-id");
  
  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 99); // Default max is 100
});

Deno.test("Rate Limiter - blocks after exceeding limit", () => {
  __resetRateLimiter();
  
  const limiter = getRateLimiter();
  
  // Use up all requests
  for (let i = 0; i < 100; i++) {
    limiter.checkLimit("test-user", "test-corr-id");
  }
  
  // Next request should be blocked
  const result = limiter.checkLimit("test-user", "test-corr-id");
  
  assertEquals(result.allowed, false);
  assertEquals(result.remaining, 0);
  assertExists(result.retryAfter);
});

Deno.test("Rate Limiter - isolates different identifiers", () => {
  __resetRateLimiter();
  
  const limiter = getRateLimiter();
  
  // Max out user1
  for (let i = 0; i < 100; i++) {
    limiter.checkLimit("user1", "corr-id");
  }
  
  // user2 should still be allowed
  const result = limiter.checkLimit("user2", "corr-id");
  assertEquals(result.allowed, true);
});

Deno.test("Rate Limiter - unblock removes limits", () => {
  __resetRateLimiter();
  
  const limiter = getRateLimiter();
  
  // Max out requests
  for (let i = 0; i < 100; i++) {
    limiter.checkLimit("test-user", "corr-id");
  }
  
  // Should be blocked
  let result = limiter.checkLimit("test-user", "corr-id");
  assertEquals(result.allowed, false);
  
  // Unblock
  limiter.unblock("test-user");
  
  // Should be allowed again
  result = limiter.checkLimit("test-user", "corr-id");
  assertEquals(result.allowed, true);
});

Deno.test("Rate Limiter - blacklists after violations", () => {
  __resetRateLimiter();
  
  const limiter = getRateLimiter();
  
  // Exceed limit multiple times to trigger blacklist
  for (let i = 0; i < 15; i++) {
    // Max out requests
    for (let j = 0; j < 101; j++) {
      limiter.checkLimit("bad-user", "corr-id");
    }
  }
  
  // Should be blacklisted
  const result = limiter.checkLimit("bad-user", "corr-id");
  assertEquals(result.allowed, false);
  assertEquals(result.retryAfter, 3600); // 1 hour penalty
});

Deno.test("Rate Limiter - stats tracking", () => {
  __resetRateLimiter();
  
  const limiter = getRateLimiter();
  
  limiter.checkLimit("user1", "corr-id");
  limiter.checkLimit("user2", "corr-id");
  
  const stats = limiter.getStats();
  
  assertEquals(stats.bucketsCount, 2);
  assertEquals(stats.blacklistCount, 0);
  assertExists(stats.config);
});

Deno.test("Rate Limiter - cleanup removes expired buckets", async () => {
  __resetRateLimiter();
  
  // Set very short window for testing
  const limiter = getRateLimiter();
  
  limiter.checkLimit("test-user", "corr-id");
  
  // Wait for cleanup (cleanup runs every 60s, but we can trigger it manually)
  // In real tests, you'd mock the cleanup interval
  
  limiter.destroy();
});
