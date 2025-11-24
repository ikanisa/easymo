/**
 * Simple In-Memory Cache for Webhook Processing
 * Provides TTL-based caching with LRU eviction
 */

import { logStructuredEvent } from "../observe/log.ts";

interface CacheEntry<T> {
  value: T;
  expires: number;
  hits: number;
  created: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  size: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number;
  private maxSize: number;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    size: 0,
  };

  constructor(config: { defaultTTL: number; maxSize: number; checkPeriod: number }) {
    this.cache = new Map();
    this.defaultTTL = config.defaultTTL;
    this.maxSize = config.maxSize;

    // Periodic cleanup
    setInterval(() => this.cleanup(), config.checkPeriod * 1000);
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
  set<T>(key: string, value: T, ttl?: number): void {
    const expires = Date.now() + ((ttl || this.defaultTTL) * 1000);

    // Check size limit
    if (this.cache.size >= this.maxSize) {
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
    this.stats.size = this.cache.size;
  }

  /**
   * Get or set value
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Delete from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
    }
    return deleted;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.size = 0;
    logStructuredEvent("CACHE_CLEARED", { entriesCleared: size });
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      const lastAccess = entry.created + entry.hits * 1000;
      if (lastAccess < lruTime) {
        lruTime = lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
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

    this.stats.size = this.cache.size;

    if (cleaned > 0) {
      logStructuredEvent("CACHE_CLEANUP", {
        entriesCleaned: cleaned,
        remainingEntries: this.cache.size,
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    return {
      ...this.stats,
      hitRate:
        this.stats.hits / Math.max(1, this.stats.hits + this.stats.misses),
    };
  }

  /**
   * Check if cache is healthy
   */
  isHealthy(): boolean {
    return this.cache.size < this.maxSize * 0.9;
  }
}
