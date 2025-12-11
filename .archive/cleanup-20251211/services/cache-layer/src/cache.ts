/**
 * Redis Cache Layer for Mobility Services
 * 
 * Provides caching for:
 * - Match results (5 min TTL)
 * - Driver metrics (10 min TTL)
 * - Trip details (15 min TTL)
 */

import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ level: 'info' });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTLS = {
  MATCHES: 5 * 60,
  DRIVER_METRICS: 10 * 60,
  TRIP: 15 * 60,
};

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });
    redis.on('error', (err) => logger.error({ err }, 'Redis error'));
    redis.on('connect', () => logger.info('Redis connected'));
  }
  return redis;
}

export async function cacheMatches(tripId: string, matches: any[]): Promise<void> {
  try {
    await getRedis().setex(`matches:${tripId}`, CACHE_TTLS.MATCHES, JSON.stringify(matches));
  } catch (error) {
    logger.error({ error, tripId }, 'Cache write failed');
  }
}

export async function getCachedMatches(tripId: string): Promise<any[] | null> {
  try {
    const cached = await getRedis().get(`matches:${tripId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.error({ error, tripId }, 'Cache read failed');
    return null;
  }
}

export async function cacheDriverMetrics(userId: string, metrics: any): Promise<void> {
  try {
    await getRedis().setex(`driver:${userId}:metrics`, CACHE_TTLS.DRIVER_METRICS, JSON.stringify(metrics));
  } catch (error) {
    logger.error({ error, userId }, 'Cache write failed');
  }
}

export async function getCachedDriverMetrics(userId: string): Promise<any | null> {
  try {
    const cached = await getRedis().get(`driver:${userId}:metrics`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.error({ error, userId }, 'Cache read failed');
    return null;
  }
}

export async function invalidateTripCache(tripId: string): Promise<void> {
  try {
    await getRedis().del(`matches:${tripId}`, `trip:${tripId}`);
  } catch (error) {
    logger.error({ error, tripId }, 'Cache invalidation failed');
  }
}

export async function closeCache(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
