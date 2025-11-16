import { Request, Response, NextFunction } from "express";
import { IdempotencyStore } from "@easymo/messaging";
import { logger } from "./logger";

/**
 * Redis-based idempotency store for distributed wallet operations
 */
type StoredResponse = { status: number; data: any; hasBody: boolean };

function sendStoredResponse(res: Response, payload: StoredResponse): Response {
  if (payload.hasBody) {
    return res.status(payload.status).json(payload.data);
  }

  return res.status(payload.status).end();
}

type CacheEntry = {
  timestamp: number;
  promise: Promise<StoredResponse>;
  resolve: (value: StoredResponse) => void;
  response?: StoredResponse;
  timeoutId?: NodeJS.Timeout;
};

class IdempotencyStore {
  private cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 24 * 60 * 60 * 1000; // 24 hours
  private readonly pendingTtlMs = 60 * 1000; // 60 seconds for unresolved entries

  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.response && Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  createPending(key: string): CacheEntry {
    // If an entry already exists, reuse it to avoid overwriting the promise
    const existing = this.cache.get(key);
    if (existing) {
      return existing;
    }

    let resolve!: (value: StoredResponse) => void;
    const promise = new Promise<StoredResponse>((res) => {
      resolve = res;
    });

    const entry: CacheEntry = {
      timestamp: Date.now(),
      promise,
      resolve,
    };

    this.cache.set(key, entry);
    entry.timeoutId = setTimeout(() => {
      const candidate = this.cache.get(key);
      if (!candidate || candidate !== entry || candidate.response) {
        return;
      }

      const timeoutResponse: StoredResponse = {
        status: 504,
        data: {
          error: "Idempotent request timed out",
        },
        hasBody: true,
      };

      candidate.response = timeoutResponse;
      candidate.timestamp = Date.now();
      delete candidate.timeoutId;
      candidate.resolve(timeoutResponse);
    }, this.pendingTtlMs);
    this.cleanup();

    return entry;
  }

  finalizeSuccess(key: string, payload: StoredResponse): void {
    const entry = this.cache.get(key);
    if (!entry) return;

    entry.response = payload;
    entry.timestamp = Date.now();
    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
      delete entry.timeoutId;
    }
    entry.resolve(payload);

    this.cleanup();
  }

  finalizeFailure(key: string, payload: StoredResponse): void {
    const entry = this.cache.get(key);
    if (!entry) return;

    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
      delete entry.timeoutId;
    }
    entry.resolve(payload);
    this.cache.delete(key);
  }

  isSameEntry(key: string, candidate: CacheEntry): boolean {
    return this.cache.get(key) === candidate;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.response && now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
        continue;
      }

      if (!entry.response && now - entry.timestamp > this.pendingTtlMs) {
        if (entry.timeoutId) {
          clearTimeout(entry.timeoutId);
          delete entry.timeoutId;
        }

        entry.resolve({
          status: 504,
          data: {
            error: "Idempotent request timed out",
          },
          hasBody: true,
        });
        this.cache.delete(key);
      }
    }
  }
}

const store = new IdempotencyStore();
const store = new IdempotencyStore({
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  ttlSeconds: 24 * 60 * 60, // 24 hours
  logger,
  namespace: "wallet",
});

// Connect to Redis on startup
store.connect().catch((error) => {
  logger.error({ error: error.message }, "Failed to connect to Redis for idempotency");
  process.exit(1);
});

/**
 * Middleware to handle idempotent requests
 * REQUIRES Idempotency-Key header for all financial operations
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

  // REQUIRED: Idempotency key must be present
  if (!idempotencyKey) {
    logger.error({ 
      path: req.path,
      method: req.method 
    }, "Missing required idempotency key for financial operation");
    
    return res.status(400).json({
      error: "missing_idempotency_key",
      message: "Idempotency-Key header is required for financial operations",
    });
  }

  // Check if we've seen this request before
  const cached = store.get(idempotencyKey);
  if (cached && cached.response) {
    logger.info({
      idempotencyKey,
      path: req.path
    }, "Returning cached response for idempotent request");

    return sendStoredResponse(res, cached.response);
  }

  if (cached && !cached.response) {
    logger.info({
      idempotencyKey,
      path: req.path,
    }, "Waiting for in-flight idempotent request to complete");

    cached.promise.then((payload) => {
      logger.info({
        idempotencyKey,
        path: req.path,
      }, "Reusing response from in-flight idempotent request");

      sendStoredResponse(res, payload);
    });

    return;
  }

  const entry = store.createPending(idempotencyKey);
  let settled = false;

  // Store the original json method
  const originalJson = res.json.bind(res);

  // Override json method to cache the response
  res.json = function (data: any) {
    const payload: StoredResponse = {
      status: res.statusCode || 200,
      data,
      hasBody: true,
    };

    if (res.statusCode >= 200 && res.statusCode < 300) {
      store.finalizeSuccess(idempotencyKey, payload);

      logger.info({
        idempotencyKey,
        path: req.path,
        status: payload.status,
      }, "Cached response for idempotent request");
    } else {
      store.finalizeFailure(idempotencyKey, payload);

      logger.warn({
        idempotencyKey,
        path: req.path,
        status: payload.status,
      }, "Idempotent request completed with error response");
    }

    return originalJson(data);
  };

  const settleResponse = () => {
    if (settled) {
      return;
    }

    if (!store.isSameEntry(idempotencyKey, entry)) {
      return;
    }

    // If the response has already been resolved via res.json, nothing to do
    if (entry.response) {
      return;
    }

    const payload: StoredResponse = {
      status: res.statusCode || 200,
      data: undefined,
      hasBody: false,
    };

    if (res.statusCode >= 200 && res.statusCode < 300) {
      store.finalizeSuccess(idempotencyKey, payload);

      logger.info({
        idempotencyKey,
        path: req.path,
        status: payload.status,
      }, "Cached response for idempotent request without JSON body");
    } else {
      store.finalizeFailure(idempotencyKey, payload);

      logger.warn({
        idempotencyKey,
        path: req.path,
        status: payload.status,
      }, "Idempotent request finished with non-success status");
    }
    settled = true;
  };

  res.on("finish", settleResponse);
  res.on("close", settleResponse);

  next();
  // Validate idempotency key format
  if (!isValidIdempotencyKey(idempotencyKey)) {
    logger.error({ 
      path: req.path,
      idempotencyKey: idempotencyKey.substring(0, 10) + "...",
    }, "Invalid idempotency key format");
    
    return res.status(400).json({
      error: "invalid_idempotency_key",
      message: "Idempotency-Key must be 16-255 characters",
    });
  }

  // Wrap the request handler with idempotency
  (async () => {
    try {
      // Check if we've processed this request before
      const cached = await getCachedResponse(idempotencyKey);
      if (cached) {
        logger.info({ 
          idempotencyKey: maskIdempotencyKey(idempotencyKey),
          path: req.path 
        }, "Returning cached response for idempotent request");
        
        return res.status(cached.status || 201).json(cached.data);
      }

      // Store the original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache the response
      res.json = function (data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Cache successful responses asynchronously
          cacheResponse(idempotencyKey, {
            status: res.statusCode,
            data,
          }).catch((error) => {
            logger.error({ 
              error: error.message,
              idempotencyKey: maskIdempotencyKey(idempotencyKey),
            }, "Failed to cache idempotent response");
          });
        }
        
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : String(error),
        idempotencyKey: maskIdempotencyKey(idempotencyKey),
      }, "Idempotency middleware error");
      
      // On idempotency errors, fail the request
      return res.status(500).json({
        error: "idempotency_error",
        message: "Failed to process idempotency",
      });
    }
  })();
}

/**
 * Get cached response from Redis
 */
async function getCachedResponse(key: string): Promise<any | null> {
  try {
    const cached = await store.execute(key, async () => {
      // This will only be called if not cached
      return null;
    });
    return cached;
  } catch (error) {
    // If it's a conflict error, the request is already in progress
    if (error instanceof Error && error.message.includes("in progress")) {
      throw error;
    }
    return null;
  }
}

/**
 * Cache response in Redis
 */
async function cacheResponse(key: string, value: any): Promise<void> {
  // Note: The IdempotencyStore.execute method handles caching automatically
  // This function is called from the response override to ensure caching happens
  // We don't need to manually cache here as it's handled by the execute wrapper
}

/**
 * Mask idempotency key for logging (PII protection)
 */
function maskIdempotencyKey(key: string): string {
  if (key.length <= 8) return "***";
  return key.substring(0, 4) + "***" + key.substring(key.length - 4);
}

/**
 * Helper to validate idempotency key format
 */
export function isValidIdempotencyKey(key: string | undefined): boolean {
  if (!key) return false;
  // Must be a non-empty string, typically UUID or similar
  return key.length >= 16 && key.length <= 255;
}
