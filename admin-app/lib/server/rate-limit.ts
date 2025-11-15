import { LRUCache } from 'lru-cache';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  lockedUntil?: number;
}

const rateLimitStore = new LRUCache<string, RateLimitEntry>({
  max: 500,
  ttl: 15 * 60 * 1000,
});

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export function checkRateLimit(
  identifier: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.lockedUntil,
      retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }
  
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(identifier, newEntry);
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetAt: newEntry.resetAt,
    };
  }
  
  if (entry.count >= maxAttempts) {
    entry.lockedUntil = now + windowMs;
    rateLimitStore.set(identifier, entry);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil(windowMs / 1000),
    };
  }
  
  entry.count++;
  rateLimitStore.set(identifier, entry);
  
  return {
    allowed: true,
    remaining: maxAttempts - entry.count,
    resetAt: entry.resetAt,
  };
}

export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}
