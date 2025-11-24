/**
 * Caching Utility for wa-webhook
 * 
 * Provides in-memory caching with TTL and LRU eviction.
 * Useful for caching user context, settings, and frequently accessed data.
 * 
 * @see docs/GROUND_RULES.md
 */

type IntervalHandle = number & { unref?: () => void };

interface CacheEntry<T> {
  value: T;
  expires: number;
  hits: number;
  created: number;
}

interface CacheConfig {
  defaultTTL: number; // seconds
  maxSize: number;
  checkPeriod: number; // seconds
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: parseInt(Deno.env.get("WA_CACHE_DEFAULT_TTL") || "300"), // 5 minutes
  maxSize: parseInt(Deno.env.get("WA_CACHE_MAX_SIZE") || "1000"),
  checkPeriod: parseInt(Deno.env.get("WA_CACHE_CHECK_PERIOD") || "600"), // 10 minutes
};

class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
  };
  private cleanupInterval?: IntervalHandle;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    this.stats.hits++;

    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds || this.config.defaultTTL;
    const expires = Date.now() + (ttl * 1000);

    // Check size limit and evict if necessary
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      expires,
      hits: 0,
      created: Date.now(),
    };

    this.cache.set(key, entry);
    this.stats.sets++;
  }

  /**
   * Get or set value using factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Delete from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(JSON.stringify({
      event: "CACHE_CLEARED",
      entriesCleared: size,
    }));
  }

  /**
   * Check if cache contains key
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Score based on age and hits (lower is worse)
      const age = Date.now() - entry.created;
      const score = entry.hits / (age / 1000); // hits per second
      
      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(JSON.stringify({
        event: "CACHE_CLEANUP",
        entriesCleaned: cleaned,
        remainingEntries: this.cache.size,
      }));
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): any {
    const entries = Array.from(this.cache.values());
    const hitRate = this.stats.hits / Math.max(1, this.stats.hits + this.stats.misses);
    const avgHitsPerEntry = entries.reduce((sum, e) => sum + e.hits, 0) / Math.max(1, entries.length);

    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: Math.round(hitRate * 100) / 100,
      avgHitsPerEntry: Math.round(avgHitsPerEntry * 100) / 100,
    };
  }

  /**
   * Check if cache is healthy
   */
  isHealthy(): boolean {
    return this.cache.size < this.config.maxSize * 0.9;
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    const handle = setInterval(
      () => this.cleanup(),
      this.config.checkPeriod * 1000,
    ) as IntervalHandle;
    handle.unref?.();
    this.cleanupInterval = handle;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Singleton instance
let cacheInstance: CacheManager | null = null;

export function getCacheManager(): CacheManager {
  if (!cacheInstance) {
    cacheInstance = new CacheManager();
  }
  return cacheInstance;
}

export function getCached<T>(key: string): T | null {
  return getCacheManager().get<T>(key);
}

export function setCached<T>(key: string, value: T, ttlSeconds?: number): void {
  getCacheManager().set(key, value, ttlSeconds);
}

export async function getOrSetCached<T>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds?: number
): Promise<T> {
  return getCacheManager().getOrSet(key, factory, ttlSeconds);
}

export function deleteCached(key: string): boolean {
  return getCacheManager().delete(key);
}

export function getCacheStats() {
  return getCacheManager().getStats();
}

// For testing
export function __resetCache(): void {
  cacheInstance?.destroy();
  cacheInstance = null;
}
