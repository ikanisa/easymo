import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

/**
 * In-memory idempotency cache for wallet transfers
 * In production, replace with Redis for distributed deployments
 */
class IdempotencyStore {
  private cache = new Map<string, { response: any; timestamp: number }>();
  private readonly ttlMs = 24 * 60 * 60 * 1000; // 24 hours

  set(key: string, value: any): void {
    this.cache.set(key, {
      response: value,
      timestamp: Date.now(),
    });
    
    // Cleanup old entries
    this.cleanup();
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.response;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

const store = new IdempotencyStore();

/**
 * Middleware to handle idempotent requests
 * Requires Idempotency-Key header for financial operations
 */
export function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const idempotencyKey = req.headers["idempotency-key"] as string;

  // Only enforce for POST requests (mutations)
  if (req.method !== "POST") {
    return next();
  }

  if (!idempotencyKey) {
    logger.warn({ 
      path: req.path,
      method: req.method 
    }, "Missing idempotency key for financial operation");
    
    // For backward compatibility, allow requests without idempotency key
    // but log warning
    return next();
  }

  // Check if we've seen this request before
  const cached = store.get(idempotencyKey);
  if (cached) {
    logger.info({ 
      idempotencyKey,
      path: req.path 
    }, "Returning cached response for idempotent request");
    
    return res.status(cached.status || 201).json(cached.data);
  }

  // Store the original json method
  const originalJson = res.json.bind(res);

  // Override json method to cache the response
  res.json = function (data: any) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      store.set(idempotencyKey, {
        status: res.statusCode,
        data,
      });
      
      logger.info({ 
        idempotencyKey,
        path: req.path,
        status: res.statusCode 
      }, "Cached response for idempotent request");
    }
    
    return originalJson(data);
  };

  next();
}

/**
 * Helper to validate idempotency key format
 */
export function isValidIdempotencyKey(key: string | undefined): boolean {
  if (!key) return false;
  // Must be a non-empty string, typically UUID or similar
  return key.length >= 16 && key.length <= 255;
}
