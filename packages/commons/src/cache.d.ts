/**
 * Redis Caching Strategy for EasyMO Services
 *
 * Implements caching for frequently accessed data
 * Expected impact: 40-60% reduction in database queries
 */
interface CacheOptions {
    ttl?: number;
    prefix?: string;
}
export declare class CacheService {
    private redis;
    private readonly defaultTTL;
    constructor(redisUrl: string);
    /**
     * Get value from cache
     */
    get<T>(key: string, options?: CacheOptions): Promise<T | null>;
    /**
     * Set value in cache
     */
    set(key: string, value: any, options?: CacheOptions): Promise<void>;
    /**
     * Delete from cache
     */
    del(key: string, options?: CacheOptions): Promise<void>;
    /**
     * Get or compute value with caching
     */
    getOrSet<T>(key: string, computeFn: () => Promise<T>, options?: CacheOptions): Promise<T>;
    /**
     * Invalidate pattern (useful for clearing related keys)
     */
    invalidatePattern(pattern: string): Promise<void>;
    /**
     * Cache statistics
     */
    stats(): Promise<{
        hits: number;
        misses: number;
        keys: number;
    }>;
    private buildKey;
    /**
     * Close Redis connection
     */
    close(): Promise<void>;
}
/**
 * Caching strategies for common queries
 */
export declare const CacheStrategies: {
    user: (userId: string) => {
        key: string;
        ttl: number;
    };
    voiceCall: (callId: string) => {
        key: string;
        ttl: number;
    };
    whatsappMessage: (messageId: string) => {
        key: string;
        ttl: number;
    };
    analytics: (query: string, params: any) => {
        key: string;
        ttl: number;
    };
    rateLimit: (identifier: string) => {
        key: string;
        ttl: number;
    };
    agentSession: (sessionId: string) => {
        key: string;
        ttl: number;
    };
    healthCheck: (service: string) => {
        key: string;
        ttl: number;
    };
};
export {};
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
//# sourceMappingURL=cache.d.ts.map