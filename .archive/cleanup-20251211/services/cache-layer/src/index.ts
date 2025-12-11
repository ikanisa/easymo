/**
 * Redis Cache Layer
 * 
 * Centralized caching for mobility services
 * 
 * Cache Keys:
 * - matches:{tripId} - Match results (TTL: 5 min)
 * - driver:{userId}:metrics - Driver metrics (TTL: 10 min)
 * - trip:{tripId} - Trip details (TTL: 15 min)
 */

import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ level: 'info' });

// Configuration
const REDIS_URL = Deno.env.get('REDIS_URL') || 'redis://localhost:6379';
const CACHE_TTLS = {
  MATCHES: 5 * 60, // 5 minutes
  DRIVER_METRICS: 10 * 60, // 10 minutes
  TRIP: 15 * 60, // 15 minutes
};

// Redis client
let redis: Redis;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redis.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });

    redis.on('connect', () => {
      logger.info('Redis connected');
    });
  }
  return redis;
}

// Cache functions
export async function cacheMatches(tripId: string, matches: any[]): Promise<void> {
  const client = getRedis();
  const key = `matches:${tripId}`;

  try {
    await client.setex(key, CACHE_TTLS.MATCHES, JSON.stringify(matches));
    logger.debug({ tripId, count: matches.length }, 'Cached matches');
  } catch (error) {
    logger.error({ error, tripId }, 'Failed to cache matches');
  }
}

export async function getCachedMatches(tripId: string): Promise<any[] | null> {
  const client = getRedis();
  const key = `matches:${tripId}`;

  try {
    const cached = await client.get(key);
    if (cached) {
      logger.debug({ tripId }, 'Cache hit: matches');
      return JSON.parse(cached);
    }
    logger.debug({ tripId }, 'Cache miss: matches');
    return null;
  } catch (error) {
    logger.error({ error, tripId }, 'Failed to get cached matches');
    return null;
  }
}

export async function cacheDriverMetrics(userId: string, metrics: any): Promise<void> {
  const client = getRedis();
  const key = `driver:${userId}:metrics`;

  try {
    await client.setex(key, CACHE_TTLS.DRIVER_METRICS, JSON.stringify(metrics));
    logger.debug({ userId }, 'Cached driver metrics');
  } catch (error) {
    logger.error({ error, userId }, 'Failed to cache driver metrics');
  }
}

export async function getCachedDriverMetrics(userId: string): Promise<any | null> {
  const client = getRedis();
  const key = `driver:${userId}:metrics`;

  try {
    const cached = await client.get(key);
    if (cached) {
      logger.debug({ userId }, 'Cache hit: driver metrics');
      return JSON.parse(cached);
    }
    logger.debug({ userId }, 'Cache miss: driver metrics');
    return null;
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get cached driver metrics');
    return null;
  }
}

export async function invalidateTripCache(tripId: string): Promise<void> {
  const client = getRedis();
  const keys = [
    `matches:${tripId}`,
    `trip:${tripId}`,
  ];

  try {
    await client.del(...keys);
    logger.debug({ tripId }, 'Invalidated trip cache');
  } catch (error) {
    logger.error({ error, tripId }, 'Failed to invalidate trip cache');
  }
}

export async function invalidateDriverCache(userId: string): Promise<void> {
  const client = getRedis();
  const key = `driver:${userId}:metrics`;

  try {
    await client.del(key);
    logger.debug({ userId }, 'Invalidated driver cache');
  } catch (error) {
    logger.error({ error, userId }, 'Failed to invalidate driver cache');
  }
}

// Stats
export async function getCacheStats(): Promise<any> {
  const client = getRedis();

  try {
    const info = await client.info('stats');
    const keyspace = await client.info('keyspace');

    return {
      info,
      keyspace,
      connected: client.status === 'ready',
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get cache stats');
    return { error: error.message };
  }
}

// Cleanup
export async function closeCache(): Promise<void> {
  if (redis) {
    await redis.quit();
    logger.info('Redis connection closed');
  }
}
