import { describe, expect, it, beforeEach } from 'vitest';
import { enforceRateLimit, resetRateLimiter } from '../../app/api/_lib/rate-limit';

describe('rate limiter', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('allows requests within the window', () => {
    const result1 = enforceRateLimit('key', 2, 1000, 0);
    const result2 = enforceRateLimit('key', 2, 1000, 10);
    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    expect(result2.remaining).toBe(0);
  });

  it('blocks when the limit is exceeded', () => {
    enforceRateLimit('blocked', 1, 1000, 0);
    const result = enforceRateLimit('blocked', 1, 1000, 100);
    expect(result.ok).toBe(false);
    expect(result.retryAfterMs).toBe(900);
  });

  it('resets after the window expires', () => {
    enforceRateLimit('reset', 1, 1000, 0);
    const result = enforceRateLimit('reset', 1, 1000, 1200);
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(0);
  });
});
