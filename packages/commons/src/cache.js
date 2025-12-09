/**
 * Redis Caching Strategy for EasyMO Services
 *
 * Implements caching for frequently accessed data
 * Expected impact: 40-60% reduction in database queries
 */
import Redis from 'ioredis';
import { logger } from './logger';
export class CacheService {
    redis;
    defaultTTL = 300; // 5 minutes
    constructor(redisUrl) {
        this.redis = new Redis(redisUrl, {
            retryStrategy: (times) => {
                if (times > 3) {
                    logger.error('Redis connection failed after 3 retries');
                    return null;
                }
                return Math.min(times * 100, 3000);
            },
            enableReadyCheck: true,
            maxRetriesPerRequest: 3,
        });
        this.redis.on('error', (err) => {
            logger.error({ err }, 'Redis error');
        });
        this.redis.on('connect', () => {
            logger.info('Redis connected');
        });
    }
    /**
     * Get value from cache
     */
    async get(key, options) {
        try {
            const fullKey = this.buildKey(key, options?.prefix);
            const value = await this.redis.get(fullKey);
            if (!value) {
                return null;
            }
            return JSON.parse(value);
        }
        catch (err) {
            logger.error({ err, key }, 'Cache get error');
            return null; // Fail gracefully
        }
    }
    /**
     * Set value in cache
     */
    async set(key, value, options) {
        try {
            const fullKey = this.buildKey(key, options?.prefix);
            const ttl = options?.ttl || this.defaultTTL;
            const serialized = JSON.stringify(value);
            await this.redis.setex(fullKey, ttl, serialized);
        }
        catch (err) {
            logger.error({ err, key }, 'Cache set error');
            // Don't throw - caching failures shouldn't break the app
        }
    }
    /**
     * Delete from cache
     */
    async del(key, options) {
        try {
            const fullKey = this.buildKey(key, options?.prefix);
            await this.redis.del(fullKey);
        }
        catch (err) {
            logger.error({ err, key }, 'Cache delete error');
        }
    }
    /**
     * Get or compute value with caching
     */
    async getOrSet(key, computeFn, options) {
        // Try to get from cache first
        const cached = await this.get(key, options);
        if (cached !== null) {
            logger.debug({ key }, 'Cache hit');
            return cached;
        }
        // Cache miss - compute value
        logger.debug({ key }, 'Cache miss');
        const value = await computeFn();
        // Store in cache for next time
        await this.set(key, value, options);
        return value;
    }
    /**
     * Invalidate pattern (useful for clearing related keys)
     */
    async invalidatePattern(pattern) {
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
                logger.info({ pattern, count: keys.length }, 'Cache invalidated');
            }
        }
        catch (err) {
            logger.error({ err, pattern }, 'Cache invalidation error');
        }
    }
    /**
     * Cache statistics
     */
    async stats() {
        try {
            const info = await this.redis.info('stats');
            const dbSize = await this.redis.dbsize();
            // Parse keyspace_hits and keyspace_misses from info
            const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
            const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
            return { hits, misses, keys: dbSize };
        }
        catch (err) {
            logger.error({ err }, 'Cache stats error');
            return { hits: 0, misses: 0, keys: 0 };
        }
    }
    buildKey(key, prefix) {
        return prefix ? `${prefix}:${key}` : key;
    }
    /**
     * Close Redis connection
     */
    async close() {
        await this.redis.quit();
    }
}
/**
 * Caching strategies for common queries
 */
export const CacheStrategies = {
    // User profile - changes infrequently
    user: (userId) => ({
        key: `user:${userId}`,
        ttl: 3600, // 1 hour
    }),
    // Voice call status - updates frequently
    voiceCall: (callId) => ({
        key: `voice_call:${callId}`,
        ttl: 60, // 1 minute
    }),
    // WhatsApp message - immutable once sent
    whatsappMessage: (messageId) => ({
        key: `whatsapp_message:${messageId}`,
        ttl: 86400, // 24 hours
    }),
    // Analytics - expensive queries
    analytics: (query, params) => ({
        key: `analytics:${query}:${JSON.stringify(params)}`,
        ttl: 300, // 5 minutes
    }),
    // Rate limiting - short-lived
    rateLimit: (identifier) => ({
        key: `ratelimit:${identifier}`,
        ttl: 900, // 15 minutes
    }),
    // Agent session - active during conversation
    agentSession: (sessionId) => ({
        key: `agent_session:${sessionId}`,
        ttl: 1800, // 30 minutes
    }),
    // Health check - very short
    healthCheck: (service) => ({
        key: `health:${service}`,
        ttl: 10, // 10 seconds
    }),
};
/**
 * Usage example:
 *
 * const cache = new CacheService(process.env.REDIS_URL);
 *
 * // Get user with caching
 * const user = await cache.getOrSet(
 *   CacheStrategies.user(userId).key,
 *   () => db.users.findOne({ id: userId }),
 *   { ttl: CacheStrategies.user(userId).ttl }
 * );
 *
 * // Invalidate user cache on update
 * await db.users.update({ id: userId }, data);
 * await cache.del(CacheStrategies.user(userId).key);
 *
 * // Check cache performance
 * const stats = await cache.stats();
 * console.log(`Cache hit rate: ${stats.hits / (stats.hits + stats.misses)}`);
 */
