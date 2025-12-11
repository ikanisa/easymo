/**
 * In-memory rate limiter using token bucket algorithm
 * 
 * Per docs/GROUND_RULES.md - Public endpoints MUST implement rate limiting
 * 
 * For production use with distributed systems, consider using Redis-based
 * rate limiting instead.
 */

export interface RateLimitResult {
  allowed: boolean;
  resetAt: number;
  remaining: number;
}

export interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Simple in-memory rate limiter
 * 
 * Thread-safe for Node.js single-threaded event loop
 * NOT suitable for distributed systems (use Redis instead)
 */
export class RateLimiter {
  private store = new Map<string, { count: number; resetAt: number }>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
  }

  /**
   * Check if a request is allowed for a given key
   * 
   * @param key - Identifier for rate limiting (e.g., phone number, IP, user ID)
   * @returns Rate limit result with allowed status and reset time
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(key);

    // New key or expired window - start fresh
    if (!entry || entry.resetAt < now) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return {
        allowed: true,
        resetAt: now + this.windowMs,
        remaining: this.maxRequests - 1,
      };
    }

    // Check if limit exceeded
    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        resetAt: entry.resetAt,
        remaining: 0,
      };
    }

    // Increment count
    entry.count++;
    return {
      allowed: true,
      resetAt: entry.resetAt,
      remaining: this.maxRequests - entry.count,
    };
  }

  /**
   * Clean up expired entries to prevent memory leaks
   * Should be called periodically
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get the current size of the rate limit store
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Reset all rate limits (useful for testing)
   */
  reset(): void {
    this.store.clear();
  }
}

/**
 * Mask phone number for logging (per docs/GROUND_RULES.md - PII masking)
 * 
 * @param phone - Phone number to mask
 * @returns Masked phone number with middle digits replaced
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return "****";
  return phone.replace(/(\+?\d{3})\d+(\d{4})/, "$1****$2");
}
