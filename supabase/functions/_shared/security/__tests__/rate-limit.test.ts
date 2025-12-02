/**
 * Rate Limiting Tests
 */

import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";

class MockRateLimiter {
  private requests: Map<string, { count: number; resetAt: number }> = new Map();

  check(key: string, limit: number, windowSeconds: number): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    
    let entry = this.requests.get(key);
    
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      this.requests.set(key, entry);
    }
    
    entry.count++;
    
    if (entry.count > limit) {
      return { allowed: false, remaining: 0 };
    }
    
    return { allowed: true, remaining: limit - entry.count };
  }
}

Deno.test("RateLimiter - allows requests under limit", () => {
  const limiter = new MockRateLimiter();
  const key = "user:123";
  
  for (let i = 0; i < 10; i++) {
    const result = limiter.check(key, 10, 60);
    assertEquals(result.allowed, true);
  }
});

Deno.test("RateLimiter - blocks requests over limit", () => {
  const limiter = new MockRateLimiter();
  const key = "user:456";
  const limit = 5;
  
  for (let i = 0; i < limit; i++) {
    limiter.check(key, limit, 60);
  }
  
  const blocked = limiter.check(key, limit, 60);
  assertEquals(blocked.allowed, false);
});

Deno.test("RateLimiter - tracks different keys separately", () => {
  const limiter = new MockRateLimiter();
  const limit = 2;
  
  limiter.check("user:1", limit, 60);
  limiter.check("user:1", limit, 60);
  
  const user1Result = limiter.check("user:1", limit, 60);
  assertEquals(user1Result.allowed, false);
  
  const user2Result = limiter.check("user:2", limit, 60);
  assertEquals(user2Result.allowed, true);
});

console.log("✅ Rate limiting tests defined");
