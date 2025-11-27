/**
 * Rate Limiting Module for Supabase Edge Functions
 * Uses Upstash Redis for distributed rate limiting with sliding window algorithm
 */

export interface RateLimitConfig {
  key: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check rate limit using sliding window algorithm
 * @param config Rate limit configuration
 * @returns Rate limit result with allowed status
 */
export async function checkRateLimit(
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const redisUrl = Deno.env.get("UPSTASH_REDIS_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_TOKEN");

  if (!redisUrl || !redisToken) {
    // Fallback: allow if Redis not configured (dev mode)
    console.warn("Rate limiting disabled - Redis not configured");
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: new Date(Date.now() + config.windowSeconds * 1000),
    };
  }

  const redisKey = `ratelimit:${config.key}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  try {
    // Use Upstash REST API for edge compatibility
    const headers = {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    };

    // Pipeline commands for atomic operations
    const commands = [
      // Remove old entries outside window
      ["ZREMRANGEBYSCORE", redisKey, 0, now - windowMs],
      // Add current request
      ["ZADD", redisKey, now, `${now}-${Math.random()}`],
      // Count requests in window
      ["ZCARD", redisKey],
      // Set expiry
      ["PEXPIRE", redisKey, windowMs],
    ];

    const response = await fetch(`${redisUrl}/pipeline`, {
      method: "POST",
      headers,
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      throw new Error(`Redis error: ${response.statusText}`);
    }

    const results = await response.json();
    const requestCount = results[2].result as number;

    return {
      allowed: requestCount <= config.limit,
      remaining: Math.max(0, config.limit - requestCount),
      resetAt: new Date(now + windowMs),
    };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    // Fail open in case of errors to prevent blocking legitimate traffic
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: new Date(now + windowMs),
    };
  }
}

/**
 * Create a 429 Too Many Requests response
 * @param result Rate limit result
 * @returns Response with rate limit headers
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil(
    (result.resetAt.getTime() - Date.now()) / 1000,
  );

  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: "Too many requests. Please try again later.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": result.resetAt.toISOString(),
        "Retry-After": retryAfter.toString(),
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Extract client identifier for rate limiting
 * Tries multiple sources: custom header, forwarded IP, or fallback
 * @param req Request object
 * @returns Client identifier string
 */
export function getClientIdentifier(req: Request): string {
  // Try WhatsApp message ID first (most specific)
  const wamid = req.headers.get("x-wamid");
  if (wamid) return `wamid:${wamid}`;

  // Try forwarded IP
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    return `ip:${ip}`;
  }

  // Try real IP
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return `ip:${realIp}`;

  // Fallback to anonymous (least specific, highest limit needed)
  return "anonymous";
}
