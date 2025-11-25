import { maskPhone, RateLimiter } from "../src/rate-limiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
  });

  describe("check", () => {
    it("should allow first request", () => {
      const result = limiter.check("user-1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should track remaining requests", () => {
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(limiter.check("user-1"));
      }

      expect(results.map(r => r.remaining)).toEqual([4, 3, 2, 1, 0]);
      expect(results.every(r => r.allowed)).toBe(true);
    });

    it("should block after limit exceeded", () => {
      // Use up all requests
      for (let i = 0; i < 5; i++) {
        limiter.check("user-1");
      }

      // 6th request should be blocked
      const result = limiter.check("user-1");
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should track different keys independently", () => {
      // Use up all requests for user-1
      for (let i = 0; i < 5; i++) {
        limiter.check("user-1");
      }

      // user-2 should still have full quota
      const result = limiter.check("user-2");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);

      // user-1 should be blocked
      const result1 = limiter.check("user-1");
      expect(result1.allowed).toBe(false);
    });

    it("should reset after window expires", async () => {
      // Create a limiter with short window
      const shortLimiter = new RateLimiter({ maxRequests: 2, windowMs: 50 });

      // Use up all requests
      shortLimiter.check("user-1");
      shortLimiter.check("user-1");

      // Should be blocked
      expect(shortLimiter.check("user-1").allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should be allowed again
      const result = shortLimiter.check("user-1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it("should provide correct resetAt timestamp", () => {
      const before = Date.now();
      const result = limiter.check("user-1");
      const after = Date.now();

      expect(result.resetAt).toBeGreaterThanOrEqual(before + 1000);
      expect(result.resetAt).toBeLessThanOrEqual(after + 1000);
    });
  });

  describe("cleanup", () => {
    it("should remove expired entries", async () => {
      const shortLimiter = new RateLimiter({ maxRequests: 5, windowMs: 50 });

      // Add some entries
      shortLimiter.check("user-1");
      shortLimiter.check("user-2");
      shortLimiter.check("user-3");

      expect(shortLimiter.size).toBe(3);

      // Wait for entries to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      const cleaned = shortLimiter.cleanup();
      expect(cleaned).toBe(3);
      expect(shortLimiter.size).toBe(0);
    });

    it("should not remove active entries", () => {
      limiter.check("user-1");
      limiter.check("user-2");

      const cleaned = limiter.cleanup();
      expect(cleaned).toBe(0);
      expect(limiter.size).toBe(2);
    });
  });

  describe("reset", () => {
    it("should clear all entries", () => {
      limiter.check("user-1");
      limiter.check("user-2");
      limiter.check("user-3");

      expect(limiter.size).toBe(3);

      limiter.reset();

      expect(limiter.size).toBe(0);
    });
  });

  describe("size", () => {
    it("should return current store size", () => {
      expect(limiter.size).toBe(0);

      limiter.check("user-1");
      expect(limiter.size).toBe(1);

      limiter.check("user-2");
      expect(limiter.size).toBe(2);

      // Same user doesn't add new entry
      limiter.check("user-1");
      expect(limiter.size).toBe(2);
    });
  });
});

describe("maskPhone", () => {
  it("should mask phone numbers correctly", () => {
    expect(maskPhone("+250788123456")).toBe("+250****3456");
    expect(maskPhone("250788123456")).toBe("250****3456");
  });

  it("should handle short phone numbers", () => {
    expect(maskPhone("1234")).toBe("****");
    expect(maskPhone("12345")).toBe("****");
    expect(maskPhone("123456")).toBe("****");
    expect(maskPhone("1234567")).toBe("****");
  });

  it("should handle empty or null input", () => {
    expect(maskPhone("")).toBe("****");
    expect(maskPhone(null as unknown as string)).toBe("****");
    expect(maskPhone(undefined as unknown as string)).toBe("****");
  });

  it("should handle phone numbers with country code", () => {
    expect(maskPhone("+1234567890123")).toBe("+123****0123");
    expect(maskPhone("+442071234567")).toBe("+442****4567");
  });

  it("should handle phone numbers without plus", () => {
    expect(maskPhone("12345678901")).toBe("123****8901");
  });
});
