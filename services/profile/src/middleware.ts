import { NextFunction,Request, Response } from "express";

import { settings } from "./config";
import { AppError, ErrorCodes } from "./errors";
import { logger } from "./logger";

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * In-memory rate limiter
 * For production, use Redis-based rate limiting via @easymo/commons
 */
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Cleanup expired rate limit records periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Rate limiting middleware
 * Limits requests per IP address within a time window
 */
export function rateLimitMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { windowMs, maxRequests } = settings.rateLimit;
  const clientIp = req.ip || req.headers["x-forwarded-for"]?.toString().split(",")[0] || "unknown";
  const key = `rate:${clientIp}`;
  const now = Date.now();

  let record = rateLimitStore.get(key);

  if (!record || record.resetTime < now) {
    record = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, record);
    next();
    return;
  }

  record.count++;

  if (record.count > maxRequests) {
    logger.warn({
      msg: "rate_limit.exceeded",
      clientIp,
      count: record.count,
      maxRequests,
    });
    next(
      new AppError(
        ErrorCodes.RATE_LIMITED,
        "Too many requests, please try again later",
        429,
        { retryAfter: Math.ceil((record.resetTime - now) / 1000) }
      )
    );
    return;
  }

  next();
}

/**
 * Request validation middleware factory
 * Validates request body, query, or params against a Zod schema
 */
import { ZodSchema } from "zod";

export function validateRequest(
  schema: ZodSchema,
  source: "body" | "query" | "params" = "body"
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      const result = schema.parse(data);
      // Replace the source with parsed (and potentially transformed) data
      req[source] = result;
      next();
    } catch (error) {
      next(error);
    }
  };
}
