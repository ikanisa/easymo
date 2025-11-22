import { NextFunction,Request, Response } from "express";

import { logger } from "./logger";

/**
 * Configuration for rate limiting
 */
export interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum number of requests per window */
  max: number;
  /** Custom message to send when rate limit is exceeded */
  message?: string;
  /** Function to generate a key for rate limiting (default: IP address) */
  keyGenerator?: (req: Request) => string;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
  /** Handler called when rate limit is exceeded */
  handler?: (req: Request, res: Response) => void;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * In-memory rate limiter
 * In production, replace with Redis for distributed deployments
 */
class RateLimitStore {
  private store = new Map<string, RateLimitRecord>();

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now > record.resetTime) {
      // Create new window
      const newRecord = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, newRecord);
      return newRecord;
    }

    // Increment existing window
    record.count++;
    return record;
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

const store = new RateLimitStore();

// Cleanup expired entries every 5 minutes
setInterval(() => store.cleanup(), 5 * 60 * 1000);

/**
 * Default key generator using IP address
 */
function defaultKeyGenerator(req: Request): string {
  return req.ip || 
         req.headers["x-forwarded-for"] as string || 
         req.headers["x-real-ip"] as string || 
         "unknown";
}

/**
 * Create a rate limiting middleware
 * 
 * @example
 * ```typescript
 * import { rateLimit } from "@easymo/commons";
 * 
 * // Apply to all routes
 * app.use(rateLimit({
 *   windowMs: 15 * 60 * 1000, // 15 minutes
 *   max: 100 // limit each IP to 100 requests per windowMs
 * }));
 * 
 * // Apply to specific route
 * app.post("/api/transfer", 
 *   rateLimit({ windowMs: 60000, max: 10 }),
 *   transferHandler
 * );
 * 
 * // Custom key generator (by user ID)
 * app.use(rateLimit({
 *   windowMs: 60000,
 *   max: 20,
 *   keyGenerator: (req) => req.user?.id || req.ip
 * }));
 * ```
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = "Too many requests, please try again later",
    keyGenerator = defaultKeyGenerator,
    skip,
    handler,
  } = options;

  if (windowMs <= 0 || max <= 0) {
    throw new Error("windowMs and max must be positive numbers");
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limiting if skip function returns true
    if (skip && skip(req)) {
      return next();
    }

    const key = `ratelimit:${keyGenerator(req)}`;
    const result = store.increment(key, windowMs);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", max.toString());
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - result.count).toString());
    res.setHeader("X-RateLimit-Reset", new Date(result.resetTime).toISOString());

    if (result.count > max) {
      logger.warn({
        event: "RATE_LIMIT_EXCEEDED",
        key: keyGenerator(req),
        count: result.count,
        max,
        path: req.path,
        method: req.method,
      }, "Rate limit exceeded");

      if (handler) {
        handler(req, res);
      } else {
        res.status(429).json({
          error: "rate_limit_exceeded",
          message,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        });
      }
      return;
    }

    next();
  };
}

/**
 * Create a rate limiter that tracks by user ID
 * Requires authentication middleware to be applied first
 */
export function rateLimitByUser(options: Omit<RateLimitOptions, "keyGenerator">) {
  return rateLimit({
    ...options,
    keyGenerator: (req: any) => {
      // Try common user identification patterns
      return req.user?.id || 
             req.user?.sub || 
             req.userId || 
             req.headers["x-user-id"] as string || 
             req.ip;
    },
  });
}

/**
 * Create a strict rate limiter for sensitive operations
 * Very low limits for operations like password reset, OTP generation, etc.
 */
export function strictRateLimit(options?: Partial<RateLimitOptions>) {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 attempts per hour
    message: "Too many attempts, please try again later",
    ...options,
  });
}

/**
 * Reset rate limit for a specific key
 * Useful for testing or manual intervention
 */
export function resetRateLimit(key: string): void {
  store.reset(`ratelimit:${key}`);
  logger.info({ key }, "Rate limit manually reset");
}
