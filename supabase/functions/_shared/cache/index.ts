/**
 * Cache Module Exports
 */

export {
  MemoryCache,
  createCache,
  profileCache,
  stateCache,
  configCache,
  locationCache,
} from "./memory-cache.ts";

export type {
  CacheEntry,
  CacheOptions,
  CacheStats,
} from "./memory-cache.ts";

export {
  cacheMiddleware,
  clearResponseCache,
  getResponseCacheStats,
} from "./cache-middleware.ts";

export type {
  CachedResponse,
  CacheConfig,
} from "./cache-middleware.ts";

export {
  getCachedProfile,
  getCachedProfileByPhone,
  invalidateProfileCache,
  getCachedState,
  invalidateStateCache,
  getCachedAppConfig,
  invalidateConfigCache,
  getCachedLocation,
  setCachedLocation,
  invalidateLocationCache,
  getAllCacheStats,
  clearAllCaches,
  cleanupAllCaches,
} from "./cached-accessors.ts";
