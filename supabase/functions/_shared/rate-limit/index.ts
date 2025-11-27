/**
 * Rate Limiting Module for Supabase Edge Functions
 * 
 * Uses Redis (Upstash) with sliding window algorithm
 * Implements best practices from GROUND_RULES.md
 */

import { Redis } from "https://esm.sh/@upstash/redis@1.28.0";

export interface RateLimitConfig {
  /** Unique identifier for rate limit (e.g., "wa-webhook:user-id" or IP) */
  key: string;
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in current window */
  remaining: number;
  /** Timestamp when the rate limit resets */
  resetAt: Date;
  /** Current request count in window */
  current: number;
}

/**
 * Check if a request should be rate limited
 */
export async function checkRateLimit(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redisUrl = Deno.env.get("UPSTASH_REDIS_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_TOKEN");

  if (!redisUrl || !redisToken) {
    // Fail open if Redis is not configured (log warning)
    console.warn("Rate limiting disabled: Redis not configured");
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: new Date(Date.now() + config.windowSeconds * 1000),
      current: 0,
    };
  }

  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  const redisKey = `ratelimit:${config.key}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const windowStart = now - windowMs;

  try {
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    pipeline.zadd(redisKey, { score: now, member: `${now}-${Math.random()}` });
    pipeline.zcard(redisKey);
    pipeline.pexpire(redisKey, windowMs);

    const results = await pipeline.exec();
    const requestCount = (results[2] as number) || 0;

    const allowed = requestCount <= config.limit;
    const remaining = Math.max(0, config.limit - requestCount);

    return {
      allowed,
      remaining,
      resetAt: new Date(now + windowMs),
      current: requestCount,
    };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: new Date(Date.now() + config.windowSeconds * 1000),
      current: 0,
    };
  }
}

/**
 * Create a 429 Rate Limit Exceeded response
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil(
    (result.resetAt.getTime() - Date.now()) / 1000
  );

  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: `Too many requests. Please retry after ${retryAfter} seconds.`,
      retryAfter,
      limit: result.current,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(result.current),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": result.resetAt.toISOString(),
        "Retry-After": String(retryAfter),
      },
    }
  );
}

/**
 * Extract client identifier from request
 */
export function getClientIdentifier(req: Request): string {
  const clientId = req.headers.get("x-client-id");
  if (clientId) return clientId;

  const wamid = req.headers.get("x-wamid");
  if (wamid) return wamid;

  const ip = req.headers.get("x-forwarded-for") || 
             req.headers.get("x-real-ip") ||
             "unknown";
  
  return ip.split(",")[0].trim();
}

/**
 * Rate limit middleware for edge functions
 */
export async function rateLimitMiddleware(
  req: Request,
  config: Omit<RateLimitConfig, "key">
): Promise<{ allowed: boolean; response?: Response; result: RateLimitResult }> {
  const clientId = getClientIdentifier(req);
  const url = new URL(req.url);
  const endpoint = url.pathname.split("/").pop() || "unknown";

  const result = await checkRateLimit({
    key: `${endpoint}:${clientId}`,
    limit: config.limit,
    windowSeconds: config.windowSeconds,
  });

  if (!result.allowed) {
    return {
      allowed: false,
      response: rateLimitResponse(result),
      result,
    };
  }

  return {
    allowed: true,
    result,
  };
}
