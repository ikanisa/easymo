// Simple in-memory rate limiter (use Redis in production)

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = { maxRequests: 100, windowMs: 60000 }) {
    this.config = config;
    // Cleanup every minute
    setInterval(() => this.cleanup(), 60000);
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now >= entry.resetAt) {
      // New window
      const resetAt = now + this.config.windowMs;
      this.limits.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt,
      };
    }

    if (entry.count >= this.config.maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    // Increment count
    entry.count++;
    this.limits.set(key, entry);

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.limits) {
      if (now >= entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }

  reset(key: string) {
    this.limits.delete(key);
  }
}

// Pre-configured rate limiters
export const apiRateLimiter = new RateLimiter({
  maxRequests: 100, // 100 requests
  windowMs: 60000, // per minute
});

export const agentRateLimiter = new RateLimiter({
  maxRequests: 20, // 20 agent executions
  windowMs: 60000, // per minute (more expensive)
});

export const streamingRateLimiter = new RateLimiter({
  maxRequests: 50, // 50 streaming sessions
  windowMs: 60000, // per minute
});

// Middleware helper
export function getRateLimitKey(request: Request): string {
  // Use IP address or user ID
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : "unknown";
  return `rate_limit:${ip}`;
}

export function checkRateLimit(
  key: string,
  limiter: RateLimiter = apiRateLimiter
): { allowed: boolean; headers: Record<string, string> } {
  const result = limiter.check(key);

  return {
    allowed: result.allowed,
    headers: {
      "X-RateLimit-Limit": limiter["config"].maxRequests.toString(),
      "X-RateLimit-Remaining": result.remaining.toString(),
      "X-RateLimit-Reset": new Date(result.resetAt).toISOString(),
    },
  };
}
