/**
 * In-Memory Cache
 * High-performance caching with TTL support
 */

// ============================================================================
// TYPES
// ============================================================================

export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  lastAccessedAt: number;
};

export type CacheOptions = {
  /** Time to live in milliseconds */
  ttlMs: number;
  /** Maximum number of entries */
  maxSize: number;
  /** Enable LRU eviction */
  enableLru: boolean;
  /** Clone values on get/set (prevents mutation) */
  cloneValues: boolean;
};

export type CacheStats = {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
  evictions: number;
};

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

const DEFAULT_OPTIONS: CacheOptions = {
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxSize: 1000,
  enableLru: true,
  cloneValues: false,
};

// ============================================================================
// MEMORY CACHE CLASS
// ============================================================================

export class MemoryCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private options: CacheOptions;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    hitRate: 0,
    evictions: 0,
  };

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Check expiry
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      this.updateHitRate();
      return undefined;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    this.stats.hits++;
    this.updateHitRate();

    return this.options.cloneValues ? this.clone(entry.value) : entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttlMs?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this.evict();
    }

    const now = Date.now();
    const effectiveTtl = ttlMs ?? this.options.ttlMs;

    this.cache.set(key, {
      value: this.options.cloneValues ? this.clone(value) : value,
      expiresAt: now + effectiveTtl,
      createdAt: now,
      accessCount: 0,
      lastAccessedAt: now,
    });

    this.stats.size = this.cache.size;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete key from cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get or set with factory function
   */
  async getOrSet(
    key: string,
    factory: () => T | Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.stats.size = this.cache.size;
    return cleaned;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private evict(): void {
    if (!this.options.enableLru) {
      // Simple FIFO eviction
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
      return;
    }

    // LRU eviction - find least recently accessed
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < lruTime) {
        lruTime = entry.lastAccessedAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private clone(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }
}

// ============================================================================
// GLOBAL CACHES
// ============================================================================

// Profile cache (5 min TTL)
export const profileCache = new MemoryCache<any>({
  ttlMs: 5 * 60 * 1000,
  maxSize: 500,
});

// State cache (1 min TTL)
export const stateCache = new MemoryCache<any>({
  ttlMs: 60 * 1000,
  maxSize: 1000,
});

// Config cache (10 min TTL)
export const configCache = new MemoryCache<any>({
  ttlMs: 10 * 60 * 1000,
  maxSize: 100,
});

// Location cache (30 min TTL)
export const locationCache = new MemoryCache<any>({
  ttlMs: 30 * 60 * 1000,
  maxSize: 500,
});

/**
 * Create a new cache instance
 */
export function createCache<T>(options?: Partial<CacheOptions>): MemoryCache<T> {
  return new MemoryCache<T>(options);
}
