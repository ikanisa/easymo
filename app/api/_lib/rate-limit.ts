const buckets = new Map<string, { count: number; expiresAt: number }>();

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
  resetAt: number;
}

function now() {
  return Date.now();
}

function cleanupBucket(key: string, bucket: { count: number; expiresAt: number }) {
  if (bucket.expiresAt <= now()) {
    buckets.delete(key);
  }
}

export function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  currentTime = now(),
): RateLimitResult {
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeWindow = Math.max(1, Math.floor(windowMs));
  const existing = buckets.get(key);

  if (!existing || existing.expiresAt <= currentTime) {
    const expiresAt = currentTime + safeWindow;
    buckets.set(key, { count: 1, expiresAt });
    return {
      ok: true,
      limit: safeLimit,
      remaining: Math.max(0, safeLimit - 1),
      retryAfterMs: 0,
      resetAt: expiresAt,
    };
  }

  if (existing.count >= safeLimit) {
    cleanupBucket(key, existing);
    return {
      ok: false,
      limit: safeLimit,
      remaining: 0,
      retryAfterMs: Math.max(0, existing.expiresAt - currentTime),
      resetAt: existing.expiresAt,
    };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return {
    ok: true,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - existing.count),
    retryAfterMs: 0,
    resetAt: existing.expiresAt,
  };
}

export function resetRateLimiter() {
  buckets.clear();
}
