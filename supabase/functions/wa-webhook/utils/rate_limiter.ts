/**
 * Rate Limiting Utility for wa-webhook
 * 
 * Provides in-memory rate limiting with blacklist support.
 * Complements existing architecture without replacing it.
 * 
 * @see docs/GROUND_RULES.md
 */

type IntervalHandle = number & { unref?: () => void };

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blacklistThreshold: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

interface BucketState {
  count: number;
  resetTime: number;
  violations: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: parseInt(Deno.env.get("WA_RATE_LIMIT_WINDOW_MS") || "60000"),
  maxRequests: parseInt(Deno.env.get("WA_RATE_LIMIT_MAX_REQUESTS") || "100"),
  blacklistThreshold: parseInt(Deno.env.get("WA_RATE_LIMIT_BLACKLIST_THRESHOLD") || "10"),
};

class RateLimiter {
  private buckets: Map<string, BucketState> = new Map();
  private blacklist: Set<string> = new Set();
  private config: RateLimitConfig;
  private cleanupInterval?: IntervalHandle;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Check if identifier should be rate limited
   */
  checkLimit(identifier: string, correlationId: string): RateLimitResult {
    const now = Date.now();

    // Check blacklist
    if (this.blacklist.has(identifier)) {
      console.warn(JSON.stringify({
        event: "RATE_LIMIT_BLACKLISTED",
        identifier: this.maskIdentifier(identifier),
        correlationId,
      }));

      return {
        allowed: false,
        remaining: 0,
        resetTime: now + 3600000, // 1 hour
        retryAfter: 3600,
      };
    }

    // Get or create bucket
    let bucket = this.buckets.get(identifier);

    // Reset bucket if window expired
    if (!bucket || now >= bucket.resetTime) {
      bucket = {
        count: 0,
        resetTime: now + this.config.windowMs,
        violations: bucket?.violations || 0,
      };
      this.buckets.set(identifier, bucket);
    }

    // Check if limit exceeded
    if (bucket.count >= this.config.maxRequests) {
      bucket.violations++;

      // Blacklist if too many violations
      if (bucket.violations >= this.config.blacklistThreshold) {
        this.blacklist.add(identifier);
        console.error(JSON.stringify({
          event: "RATE_LIMIT_BLACKLIST_ADDED",
          identifier: this.maskIdentifier(identifier),
          violations: bucket.violations,
          correlationId,
        }));
      }

      const retryAfter = Math.ceil((bucket.resetTime - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetTime: bucket.resetTime,
        retryAfter,
      };
    }

    // Increment counter
    bucket.count++;
    bucket.violations = 0; // Clear violations on successful request
    this.buckets.set(identifier, bucket);

    return {
      allowed: true,
      remaining: this.config.maxRequests - bucket.count,
      resetTime: bucket.resetTime,
    };
  }

  /**
   * Manually unblock an identifier
   */
  unblock(identifier: string): void {
    this.blacklist.delete(identifier);
    this.buckets.delete(identifier);
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    bucketsCount: number;
    blacklistCount: number;
    config: RateLimitConfig;
  } {
    return {
      bucketsCount: this.buckets.size,
      blacklistCount: this.blacklist.size,
      config: this.config,
    };
  }

  /**
   * Mask identifier for logging (PII protection)
   */
  private maskIdentifier(identifier: string): string {
    if (identifier.length <= 7) return "***";
    return identifier.slice(0, 4) + "***" + identifier.slice(-3);
  }

  /**
   * Cleanup expired buckets
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, bucket] of this.buckets.entries()) {
      if (now > bucket.resetTime + this.config.windowMs) {
        this.buckets.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(JSON.stringify({
        event: "RATE_LIMIT_CLEANUP",
        cleanedBuckets: cleaned,
        remainingBuckets: this.buckets.size,
      }));
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    const handle = setInterval(() => this.cleanup(), 60000) as IntervalHandle;
    handle.unref?.();
    this.cleanupInterval = handle;
  }

  /**
   * Stop cleanup (for testing/shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.buckets.clear();
    this.blacklist.clear();
  }
}

// Singleton instance
let limiterInstance: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!limiterInstance) {
    limiterInstance = new RateLimiter();
  }
  return limiterInstance;
}

export function checkRateLimit(identifier: string, correlationId: string): RateLimitResult {
  return getRateLimiter().checkLimit(identifier, correlationId);
}

export function unblockIdentifier(identifier: string): void {
  getRateLimiter().unblock(identifier);
}

export function getRateLimitStats() {
  return getRateLimiter().getStats();
}

// For testing
export function __resetRateLimiter(): void {
  limiterInstance?.destroy();
  limiterInstance = null;
}
