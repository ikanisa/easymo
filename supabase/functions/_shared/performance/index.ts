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

  cacheMiddleware,
  clearResponseCache,
  getResponseCacheStats,
} from "../cache/cache-middleware.ts";

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

  getProfileById,
  getProfileByPhone,
  findNearbyDrivers,
  getActiveTrip,
  getRecentInsuranceLead,
  getUserClaims,
  getWalletBalance,
  getTransactionHistory,
} from "../database/optimized-queries.ts";

  getClientPool,
  getPooledClient,
  getSupabaseClient,
  SupabaseClientPool,
} from "../database/client-pool.ts";

// Deduplication
  deduplicationMiddleware,
  checkDuplicate,
  getDeduplicationStats,
  clearDeduplicationCache,
} from "../middleware/deduplication.ts";

// Lazy Loading
  lazy,
  registerLazyHandler,
  getLazyHandler,
  isHandlerLoaded,
  preloadHandlers,
  getHandlerLoadingStats,
  lazyExecute,
} from "../handlers/lazy-loader.ts";

// Metrics
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

  performanceMiddleware,
  trackColdStart,
  trackHandler,
  trackDatabaseOp,
  trackApiCall,
} from "../observability/performance-middleware.ts";

  generatePerformanceReport,
  handlePerformanceRequest,
  getHealthMetrics,
} from "../observability/performance-endpoint.ts";

// Warmup
  warmup,
  backgroundWarmup,
  warmupOnce,
  isWarmedUp,
} from "../warmup/index.ts";
