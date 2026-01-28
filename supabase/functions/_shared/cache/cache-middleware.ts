/**
 * Cache Middleware
 * HTTP response caching for frequently accessed endpoints
 */

import { logStructuredEvent } from "../observability/index.ts";
import { MemoryCache } from "./memory-cache.ts";

// ============================================================================
// TYPES
// ============================================================================

export type CachedResponse = {
  body: string;
  status: number;
  headers: Record<string, string>;
  cachedAt: number;
};

export type CacheConfig = {
  /** Cache key generator */
  keyGenerator: (req: Request) => string;
  /** TTL in milliseconds */
  ttlMs: number;
  /** Paths to cache */
  includePaths: string[];
  /** Paths to exclude */
  excludePaths: string[];
  /** Methods to cache */
  methods: string[];
  /** Cache condition */
  condition?: (req: Request) => boolean;
};

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  keyGenerator: (req) => `${req.method}:${new URL(req.url).pathname}`,
  ttlMs: 60 * 1000, // 1 minute
  includePaths: ["/health"],
  excludePaths: [],
  methods: ["GET"],
};

// ============================================================================
// RESPONSE CACHE
// ============================================================================

const responseCache = new MemoryCache<CachedResponse>({
  ttlMs: 60 * 1000,
  maxSize: 200,
});

/**
 * Cache middleware for HTTP responses
 */
export function cacheMiddleware(config: Partial<CacheConfig> = {}) {
  const fullConfig: CacheConfig = { ...DEFAULT_CACHE_CONFIG, ...config };

  return async (
    req: Request,
    handler: (req: Request) => Promise<Response>
  ): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    // Check if request should be cached
    if (!shouldCache(req, path, fullConfig)) {
      return handler(req);
    }

    // Generate cache key
    const cacheKey = fullConfig.keyGenerator(req);

    // Check cache
    const cached = responseCache.get(cacheKey);
    if (cached) {
      logStructuredEvent("CACHE_HIT", { path, cacheKey }, "debug");
      
      return new Response(cached.body, {
        status: cached.status,
        headers: {
          ...cached.headers,
          "X-Cache": "HIT",
          "X-Cache-Age": String(Date.now() - cached.cachedAt),
        },
      });
    }

    // Execute handler
    const response = await handler(req);

    // Cache successful responses
    if (response.ok) {
      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      responseCache.set(cacheKey, {
        body,
        status: response.status,
        headers,
        cachedAt: Date.now(),
      }, fullConfig.ttlMs);

      logStructuredEvent("CACHE_SET", { path, cacheKey }, "debug");

      return new Response(body, {
        status: response.status,
        headers: {
          ...headers,
          "X-Cache": "MISS",
        },
      });
    }

    return response;
  };
}

/**
 * Check if request should be cached
 */
function shouldCache(req: Request, path: string, config: CacheConfig): boolean {
  // Check method
  if (!config.methods.includes(req.method)) {
    return false;
  }

  // Check excluded paths
  if (config.excludePaths.some((p) => path.startsWith(p))) {
    return false;
  }

  // Check included paths
  if (config.includePaths.length > 0) {
    if (!config.includePaths.some((p) => path.startsWith(p))) {
      return false;
    }
  }

  // Check custom condition
  if (config.condition && !config.condition(req)) {
    return false;
  }

  return true;
}

/**
 * Clear response cache
 */
export function clearResponseCache(): void {
  responseCache.clear();
}

/**
 * Get cache stats
 */
export function getResponseCacheStats() {
  return responseCache.getStats();
}
