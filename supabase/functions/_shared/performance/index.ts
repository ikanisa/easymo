/**
 * Performance Module Exports
 */

// Cache
export {
  MemoryCache,
  createCache,
  profileCache,
  stateCache,
  configCache,
  locationCache,
} from "../cache/memory-cache.ts";

export {
  cacheMiddleware,
  clearResponseCache,
  getResponseCacheStats,
} from "../cache/cache-middleware.ts";

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
} from "../cache/cached-accessors.ts";

// Database
export { QueryBuilder, query } from "../database/query-builder.ts";

export {
  getProfileById,
  getProfileByPhone,
  findNearbyDrivers,
  getActiveTrip,
  getRecentInsuranceLead,
  getUserClaims,
  getWalletBalance,
  getTransactionHistory,
} from "../database/optimized-queries.ts";

export {
  getClientPool,
  getPooledClient,
  getSupabaseClient,
  SupabaseClientPool,
} from "../database/client-pool.ts";

// Deduplication
export {
  deduplicationMiddleware,
  checkDuplicate,
  getDeduplicationStats,
  clearDeduplicationCache,
} from "../middleware/deduplication.ts";

// Lazy Loading
export {
  lazy,
  registerLazyHandler,
  getLazyHandler,
  isHandlerLoaded,
  preloadHandlers,
  getHandlerLoadingStats,
  lazyExecute,
} from "../handlers/lazy-loader.ts";

// Metrics
export {
  incrementCounter,
  getCounter,
  setGauge,
  getGauge,
  incrementGauge,
  decrementGauge,
  recordHistogram,
  getHistogramStats,
  startTimer,
  timeAsync,
  timeSync,
  recordRequestMetrics,
  recordDatabaseMetrics,
  recordApiMetrics,
  getAllMetrics,
  resetMetrics,
  exportPrometheusMetrics,
} from "../observability/metrics.ts";

export {
  performanceMiddleware,
  trackColdStart,
  trackHandler,
  trackDatabaseOp,
  trackApiCall,
} from "../observability/performance-middleware.ts";

export {
  generatePerformanceReport,
  handlePerformanceRequest,
  getHealthMetrics,
} from "../observability/performance-endpoint.ts";

// Warmup
export {
  warmup,
  backgroundWarmup,
  warmupOnce,
  isWarmedUp,
} from "../warmup/index.ts";
