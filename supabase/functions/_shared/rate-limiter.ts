/**
 * Rate Limiter Implementation
 * 
 * Implements sliding window rate limiting to prevent abuse
 * and protect downstream services.
 */

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
}

interface RequestRecord {
  timestamp: number;
  count: number;
}

export class RateLimiter {
  private requests = new Map<string, number[]>();
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      windowMs: config.windowMs ?? 60000, // 1 minute
      maxRequests: config.maxRequests ?? 60, // 60 requests per minute
    };
  }

  /**
   * Check if a request is allowed for the given key (e.g., phone number)
   */
  isAllowed(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing requests for this key
    let timestamps = this.requests.get(key) || [];

    // Remove timestamps outside the current window
    timestamps = timestamps.filter((ts) => ts > windowStart);

    // Check if limit is exceeded
    if (timestamps.length >= this.config.maxRequests) {
      const oldestTimestamp = timestamps[0];
      const retryAfter = Math.ceil((oldestTimestamp + this.config.windowMs - now) / 1000);
      
      return {
        allowed: false,
        retryAfter,
      };
    }

    // Add current timestamp
    timestamps.push(now);
    this.requests.set(key, timestamps);

    return { allowed: true };
  }

  /**
   * Get current usage for a key
   */
  getUsage(key: string): { count: number; limit: number; resetAt: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    const timestamps = this.requests.get(key) || [];
    const activeTimestamps = timestamps.filter((ts) => ts > windowStart);
    
    const oldestTimestamp = activeTimestamps[0] || now;
    const resetAt = oldestTimestamp + this.config.windowMs;

    return {
      count: activeTimestamps.length,
      limit: this.config.maxRequests,
      resetAt,
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limit data
   */
  resetAll(): void {
    this.requests.clear();
  }

  /**
   * Cleanup old entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      const activeTimestamps = timestamps.filter((ts) => ts > windowStart);
      
      if (activeTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, activeTimestamps);
      }
    }
  }
}

// Global rate limiter instance
export const globalRateLimiter = new RateLimiter({
  windowMs: 60000,  // 1 minute
  maxRequests: 60,  // 60 requests per minute per phone number
});

// Cleanup old entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    globalRateLimiter.cleanup();
  }, 5 * 60 * 1000);
}
