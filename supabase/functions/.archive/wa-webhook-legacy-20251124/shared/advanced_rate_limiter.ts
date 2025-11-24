/**
 * Advanced Rate Limiter with Blacklisting
 *
 * Features:
 * - Per-user rate limiting
 * - Automatic blacklisting for abuse
 * - Violation tracking
 * - Exponential backoff
 * - Redis-backed (future enhancement)
 */

import { logStructuredEvent } from "../observe/log.ts";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blacklistThreshold: number;
  blacklistDuration: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  blacklisted?: boolean;
}

interface BucketState {
  count: number;
  resetTime: number;
  firstRequest: number;
  violations: number;
}

export class AdvancedRateLimiter {
  private buckets: Map<string, BucketState> = new Map();
  private blacklist: Map<string, number> = new Map(); // identifier -> unblockTime
  private config: RateLimitConfig;
  private cleanupInterval?: number;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      windowMs: config?.windowMs ?? 60000, // 1 minute
      maxRequests: config?.maxRequests ?? 100,
      blacklistThreshold: config?.blacklistThreshold ?? 10,
      blacklistDuration: config?.blacklistDuration ?? 3600000, // 1 hour
    };

    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      300000
    ) as unknown as number;

    logStructuredEvent("RATE_LIMITER_INITIALIZED", {
      windowMs: this.config.windowMs,
      maxRequests: this.config.maxRequests,
    });
  }

  /**
   * Check if request should be rate limited
   */
  async checkLimit(
    identifier: string,
    correlationId: string
  ): Promise<RateLimitResult> {
    const now = Date.now();

    // Check blacklist first
    const blacklistExpiry = this.blacklist.get(identifier);
    if (blacklistExpiry && now < blacklistExpiry) {
      await logStructuredEvent("RATE_LIMIT_BLACKLISTED", {
        correlation_id: correlationId,
        identifier,
        unblock_time: blacklistExpiry,
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: blacklistExpiry,
        retryAfter: Math.ceil((blacklistExpiry - now) / 1000),
        blacklisted: true,
      };
    }

    // Remove from blacklist if expired
    if (blacklistExpiry && now >= blacklistExpiry) {
      this.blacklist.delete(identifier);
      await logStructuredEvent("RATE_LIMIT_UNBLACKLISTED", {
        correlation_id: correlationId,
        identifier,
      });
    }

    // Get or create bucket
    let bucket = this.buckets.get(identifier);

    // Reset bucket if window expired
    if (!bucket || now >= bucket.resetTime) {
      bucket = {
        count: 0,
        resetTime: now + this.config.windowMs,
        firstRequest: now,
        violations: bucket?.violations ?? 0,
      };
      this.buckets.set(identifier, bucket);
    }

    // Check if limit exceeded
    if (bucket.count >= this.config.maxRequests) {
      // Increment violations
      bucket.violations++;

      // Blacklist if too many violations
      if (bucket.violations >= this.config.blacklistThreshold) {
        const unblockTime = now + this.config.blacklistDuration;
        this.blacklist.set(identifier, unblockTime);

        await logStructuredEvent("RATE_LIMIT_BLACKLIST_ADDED", {
          correlation_id: correlationId,
          identifier,
          violations: bucket.violations,
          unblock_time: unblockTime,
        });

        return {
          allowed: false,
          remaining: 0,
          resetTime: unblockTime,
          retryAfter: Math.ceil(this.config.blacklistDuration / 1000),
          blacklisted: true,
        };
      }

      await logStructuredEvent("RATE_LIMIT_EXCEEDED", {
        correlation_id: correlationId,
        identifier,
        count: bucket.count,
        limit: this.config.maxRequests,
        violations: bucket.violations,
      });

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
    const remaining = this.config.maxRequests - bucket.count;

    // Clear violations on successful request
    if (bucket.violations > 0) {
      bucket.violations = Math.max(0, bucket.violations - 1);
    }

    return {
      allowed: true,
      remaining,
      resetTime: bucket.resetTime,
    };
  }

  /**
   * Manually unblock an identifier
   */
  unblock(identifier: string): void {
    this.blacklist.delete(identifier);
    const bucket = this.buckets.get(identifier);
    if (bucket) {
      bucket.violations = 0;
    }

    logStructuredEvent("RATE_LIMIT_MANUAL_UNBLOCK", {
      identifier,
    });
  }

  /**
   * Get current state for monitoring
   */
  getStats(): {
    bucketsCount: number;
    blacklistCount: number;
    totalViolations: number;
  } {
    let totalViolations = 0;
    for (const bucket of this.buckets.values()) {
      totalViolations += bucket.violations;
    }

    return {
      bucketsCount: this.buckets.size,
      blacklistCount: this.blacklist.size,
      totalViolations,
    };
  }

  /**
   * Check health
   */
  isHealthy(): boolean {
    return (
      this.buckets.size < 10000 && // Not too many buckets
      this.blacklist.size < 1000 // Not too many blacklisted
    );
  }

  /**
   * Clean up expired buckets and blacklist entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedBuckets = 0;
    let cleanedBlacklist = 0;

    // Clean buckets
    for (const [identifier, bucket] of this.buckets.entries()) {
      if (now > bucket.resetTime + this.config.windowMs) {
        this.buckets.delete(identifier);
        cleanedBuckets++;
      }
    }

    // Clean blacklist
    for (const [identifier, expiry] of this.blacklist.entries()) {
      if (now >= expiry) {
        this.blacklist.delete(identifier);
        cleanedBlacklist++;
      }
    }

    if (cleanedBuckets > 0 || cleanedBlacklist > 0) {
      logStructuredEvent("RATE_LIMITER_CLEANUP", {
        cleaned_buckets: cleanedBuckets,
        cleaned_blacklist: cleanedBlacklist,
        remaining_buckets: this.buckets.size,
        remaining_blacklist: this.blacklist.size,
      });
    }
  }

  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.buckets.clear();
    this.blacklist.clear();

    logStructuredEvent("RATE_LIMITER_DESTROYED", {});
  }
}

/**
 * Singleton instance
 */
let rateLimiterInstance: AdvancedRateLimiter | null = null;

export function getRateLimiter(): AdvancedRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new AdvancedRateLimiter();
  }
  return rateLimiterInstance;
}
