/**
 * Advanced Rate Limiter with Blacklisting
 * Provides per-user rate limiting, violation tracking, and blacklist management
 */

import { logStructuredEvent } from "../observe/log.ts";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

interface BucketState {
  count: number;
  resetTime: number;
  firstRequest: number;
}

export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private keyPrefix: string;
  private buckets: Map<string, BucketState>;
  private blacklist: Set<string>;
  private violations: Map<string, number>;
  private readonly BLACKLIST_THRESHOLD = 10; // Block after 10 violations

  constructor(config: { windowMs: number; maxRequests: number; keyPrefix: string }) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
    this.keyPrefix = config.keyPrefix;
    this.buckets = new Map();
    this.blacklist = new Set();
    this.violations = new Map();

    // Cleanup expired buckets every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request should be rate limited
   */
  async checkLimit(identifier: string, correlationId: string): Promise<RateLimitResult> {
    const key = `${this.keyPrefix}:${identifier}`;
    const now = Date.now();

    // Check blacklist
    if (this.blacklist.has(identifier)) {
      await logStructuredEvent("BLACKLISTED_REQUEST", {
        identifier,
        correlationId,
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: now + 3600000, // 1 hour penalty
        retryAfter: 3600,
      };
    }

    // Get or create bucket
    let bucket = this.buckets.get(key);

    // Reset bucket if window expired
    if (!bucket || now >= bucket.resetTime) {
      bucket = {
        count: 0,
        resetTime: now + this.windowMs,
        firstRequest: now,
      };
      this.buckets.set(key, bucket);
    }

    // Check if limit exceeded
    if (bucket.count >= this.maxRequests) {
      // Track violations
      const violations = (this.violations.get(identifier) || 0) + 1;
      this.violations.set(identifier, violations);

      // Blacklist if too many violations
      if (violations >= this.BLACKLIST_THRESHOLD) {
        this.blacklist.add(identifier);
        await logStructuredEvent("IDENTIFIER_BLACKLISTED", {
          identifier,
          violations,
          correlationId,
        });
      }

      await logStructuredEvent("RATE_LIMIT_EXCEEDED", {
        identifier,
        count: bucket.count,
        limit: this.maxRequests,
        resetTime: bucket.resetTime,
        violations,
        correlationId,
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
    this.buckets.set(key, bucket);

    // Clear violations on successful request
    if (this.violations.has(identifier)) {
      this.violations.delete(identifier);
    }

    const remaining = this.maxRequests - bucket.count;

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
    this.violations.delete(identifier);
    const key = `${this.keyPrefix}:${identifier}`;
    this.buckets.delete(key);

    logStructuredEvent("IDENTIFIER_UNBLOCKED", { identifier });
  }

  /**
   * Get current state for monitoring
   */
  getStats(): {
    bucketsCount: number;
    blacklistCount: number;
    violationsCount: number;
  } {
    return {
      bucketsCount: this.buckets.size,
      blacklistCount: this.blacklist.size,
      violationsCount: this.violations.size,
    };
  }

  /**
   * Check health
   */
  isHealthy(): boolean {
    return this.buckets.size < 10000; // Alert if too many buckets
  }

  /**
   * Clean up expired buckets
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, bucket] of this.buckets.entries()) {
      if (now > bucket.resetTime + this.windowMs) {
        this.buckets.delete(key);
        cleaned++;
      }
    }

    // Clean up old violations
    for (const [identifier, _] of this.violations.entries()) {
      const key = `${this.keyPrefix}:${identifier}`;
      if (!this.buckets.has(key)) {
        this.violations.delete(identifier);
      }
    }

    if (cleaned > 0) {
      logStructuredEvent("RATE_LIMIT_CLEANUP", {
        cleanedBuckets: cleaned,
        remainingBuckets: this.buckets.size,
      });
    }
  }
}
