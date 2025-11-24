# wa-webhook Enhancements

## Overview

This directory contains **additive enhancements** to the wa-webhook edge function. All enhancements are:
- ✅ **Additive-only** (no modifications to existing code)
- ✅ **Optional** (can be enabled/disabled via env vars)
- ✅ **Production-ready** with proper error handling
- ✅ **Compliant** with EasyMO Ground Rules
- ✅ **Well-tested** architecture patterns

## New Utilities

### 1. Rate Limiting (`rate_limiter.ts`)

**Purpose**: Prevent abuse by limiting requests per phone number

**Features**:
- In-memory rate limiting with configurable windows
- Automatic blacklisting after repeated violations
- PII masking in logs
- Cleanup of expired buckets

**Configuration**:
```bash
WA_RATE_LIMIT_WINDOW_MS=60000          # Window size in ms (default: 60s)
WA_RATE_LIMIT_MAX_REQUESTS=100         # Max requests per window (default: 100)
WA_RATE_LIMIT_BLACKLIST_THRESHOLD=10   # Violations before blacklist (default: 10)
WA_ENABLE_RATE_LIMITING=true           # Enable/disable (default: true)
```

**Usage**:
```typescript
import { checkRateLimit } from "./utils/rate_limiter.ts";

const result = checkRateLimit(phoneNumber, correlationId);
if (!result.allowed) {
  // Return 429 with Retry-After header
}
```

**Metrics**:
- `RATE_LIMIT_BLACKLISTED` - Phone number blacklisted
- `RATE_LIMIT_BLACKLIST_ADDED` - New blacklist entry
- `RATE_LIMIT_CLEANUP` - Periodic cleanup executed

---

### 2. Caching (`cache.ts`)

**Purpose**: Cache user context and frequently accessed data

**Features**:
- In-memory caching with TTL
- LRU eviction when cache is full
- Hit rate tracking
- Automatic cleanup of expired entries

**Configuration**:
```bash
WA_CACHE_DEFAULT_TTL=300      # Default TTL in seconds (default: 5 minutes)
WA_CACHE_MAX_SIZE=1000        # Max cache entries (default: 1000)
WA_CACHE_CHECK_PERIOD=600     # Cleanup period in seconds (default: 10 minutes)
WA_ENABLE_CACHING=true        # Enable/disable (default: true)
```

**Usage**:
```typescript
import { getOrSetCached } from "./utils/cache.ts";

const userContext = await getOrSetCached(
  `user:${phoneNumber}`,
  async () => {
    // Fetch from database
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone_number", phoneNumber)
      .single();
    return data;
  },
  300 // Cache for 5 minutes
);
```

**Statistics**:
```typescript
import { getCacheStats } from "./utils/cache.ts";

const stats = getCacheStats();
// { hits, misses, sets, deletes, evictions, size, hitRate, avgHitsPerEntry }
```

---

### 3. Error Handling (`error_handler.ts`)

**Purpose**: Structured error handling with user notifications

**Features**:
- Error classification and normalization
- User-friendly error messages
- Automatic retry detection
- PII masking in logs
- Optional user notifications via WhatsApp

**Configuration**:
```bash
WA_ENABLE_USER_ERROR_NOTIFICATIONS=false  # Send errors to users (default: false)
```

**Usage**:
```typescript
import { handleWebhookError, WebhookError, ErrorCode } from "./utils/error_handler.ts";

try {
  // Your code
} catch (error) {
  return await handleWebhookError(error, {
    correlationId,
    phoneNumber,
    userId,
    operation: "transfer",
    duration: Date.now() - startTime,
  }, true); // true = notify user
}
```

**Error Codes**:
- `VALIDATION_ERROR` (400) - Invalid input
- `AUTHENTICATION_ERROR` (401) - Auth failed
- `RATE_LIMIT_ERROR` (429) - Too many requests
- `DATABASE_ERROR` (500, retryable) - DB operation failed
- `EXTERNAL_SERVICE_ERROR` (503, retryable) - Service unavailable
- `TIMEOUT_ERROR` (504, retryable) - Request timed out
- `PAYLOAD_TOO_LARGE` (413) - Payload exceeds limit

---

### 4. Metrics Collection (`metrics_collector.ts`)

**Purpose**: Aggregate and export metrics

**Features**:
- In-memory metrics aggregation
- Counters, gauges, and histograms
- Automatic periodic flushing (30s)
- Prometheus-compatible export
- Dimension-based grouping

**Usage**:
```typescript
import {
  incrementMetric,
  setMetricGauge,
  recordMetricHistogram
} from "./utils/metrics_collector.ts";

// Counter
incrementMetric("wa_message_received", 1, { type: "text" });

// Gauge
setMetricGauge("wa_cache_size", cacheSize, { status: "healthy" });

// Histogram (for durations, sizes, etc.)
recordMetricHistogram("wa_processing_duration_ms", duration, {
  type: "interactive",
  status: "success"
});
```

**Prometheus Endpoint**:
```typescript
import { getPrometheusMetrics } from "./utils/metrics_collector.ts";

// In your endpoint handler:
if (req.url.endsWith("/metrics")) {
  return new Response(getPrometheusMetrics(), {
    headers: { "Content-Type": "text/plain" }
  });
}
```

---

### 5. Health Checks (`health_check.ts`)

**Purpose**: Comprehensive health monitoring

**Features**:
- Database connectivity check
- Rate limiter health
- Cache health
- Metrics collector status
- Uptime tracking
- Liveness and readiness probes

**Endpoints**:
```typescript
import {
  createHealthCheckResponse,
  createLivenessResponse,
  createReadinessResponse
} from "./utils/health_check.ts";

// Comprehensive health check
if (req.url.endsWith("/health")) {
  return await createHealthCheckResponse();
}

// Kubernetes liveness probe
if (req.url.endsWith("/healthz")) {
  return createLivenessResponse();
}

// Kubernetes readiness probe
if (req.url.endsWith("/ready")) {
  return await createReadinessResponse();
}
```

**Response Format**:
```json
{
  "healthy": true,
  "status": "healthy",
  "checks": {
    "database": {
      "healthy": true,
      "message": "Database connected",
      "responseTime": 45
    },
    "rateLimiter": {
      "healthy": true,
      "message": "Rate limiter operational",
      "details": { "bucketsCount": 127, "blacklistCount": 2 }
    },
    "cache": {
      "healthy": true,
      "message": "Cache operational",
      "details": { "size": 234, "hitRate": 0.87 }
    },
    "metrics": {
      "healthy": true,
      "message": "Metrics collector operational"
    }
  },
  "version": "2.0.0",
  "environment": "production",
  "timestamp": "2025-11-13T08:23:07.426Z",
  "uptime": 3600
}
```

---

### 6. Configuration Validator (`config_validator.ts`)

**Purpose**: Validate environment variables on startup

**Features**:
- Required variable checking
- Numeric range validation
- Warning for recommended variables
- Default value management

**Usage**:
```typescript
import { assertConfigValid, printConfigStatus } from "./utils/config_validator.ts";

// On startup, validate configuration
assertConfigValid(); // Throws if invalid

// Or print status
printConfigStatus(); // Logs warnings/errors
```

---

### 7. Middleware Integration (`middleware.ts`)

**Purpose**: Easy integration of enhancements into existing pipeline

**Features**:
- Non-invasive middleware functions
- Optional enhancement application
- Composable architecture
- Feature flag support

**Usage Example** (in existing code):
```typescript
import {
  applyRateLimiting,
  trackWebhookMetrics,
  getCachedUserContext,
  wrapError
} from "./utils/middleware.ts";

// In pipeline.ts (example integration point):
export async function processWebhookRequest(req: Request): Promise<PreparedWebhook | PreparedResponse> {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();
  
  try {
    // ... existing webhook processing ...
    
    // OPTIONAL: Add rate limiting
    if (messages.length > 0) {
      const sender = messages[0].from;
      const rateLimitResult = applyRateLimiting(sender, correlationId);
      if (!rateLimitResult.allowed) {
        return { type: "response", response: rateLimitResult.response! };
      }
    }
    
    // OPTIONAL: Track metrics
    trackWebhookMetrics(prepared, startTime);
    
    return prepared;
  } catch (error) {
    // OPTIONAL: Enhanced error handling
    return {
      type: "response",
      response: await wrapError(error, { correlationId, duration: Date.now() - startTime })
    };
  }
}

// In message_context.ts (example integration point):
export async function buildMessageContext(...) {
  // OPTIONAL: Use cached user context
  const userContext = await getCachedUserContext(phoneNumber, async () => {
    const { data } = await supabase.from("profiles")...
    return data;
  });
}
```

---

## Integration Strategy

### Phase 1: Non-Breaking Additions (Current)
All utilities are standalone and don't modify existing code. They can be imported and used wherever needed.

### Phase 2: Optional Integration (Recommended)
Add optional middleware calls in key points:
1. **Rate limiting** in `router/pipeline.ts` after message extraction
2. **Caching** in `router/message_context.ts` for user lookups
3. **Error handling** in `index.ts` main try-catch
4. **Metrics** at request start/end
5. **Health checks** as new endpoints

### Phase 3: Feature Flags (Production)
Control enhancements via environment variables:
```bash
# Enable all enhancements
WA_ENABLE_RATE_LIMITING=true
WA_ENABLE_CACHING=true
WA_ENABLE_USER_ERROR_NOTIFICATIONS=false  # Start disabled

# Fine-tune settings
WA_RATE_LIMIT_MAX_REQUESTS=100
WA_CACHE_DEFAULT_TTL=300
```

---

## Testing

All utilities include test helpers:
```typescript
import {
  __resetRateLimiter,
  __resetCache,
  __resetMetrics
} from "./utils/...";

// In tests:
afterEach(() => {
  __resetRateLimiter();
  __resetCache();
  __resetMetrics();
});
```

---

## Monitoring

### Key Metrics to Watch

**Rate Limiting**:
- `RATE_LIMIT_BLACKLISTED` - Monitor blacklist additions
- Bucket count in health check (alert if > 5000)

**Caching**:
- Hit rate (target > 70%)
- Cache size (alert if near maxSize)
- Eviction rate

**Error Handling**:
- `WEBHOOK_ERROR` events by error code
- Retry patterns
- User notification failures

**Performance**:
- `wa_webhook_duration_ms` histogram
- `wa_message_processing_duration_ms` histogram
- Database response times in health checks

---

## Performance Impact

All enhancements are designed for minimal overhead:

- **Rate Limiter**: O(1) lookups, periodic cleanup
- **Cache**: O(1) get/set with occasional LRU eviction
- **Metrics**: In-memory aggregation, batched flushing
- **Health Checks**: Async, non-blocking

Expected overhead: **< 5ms per request** with all features enabled.

---

## Compliance

✅ **Ground Rules** (docs/GROUND_RULES.md):
- Structured logging in JSON format
- Correlation IDs in all logs
- PII masking (phone numbers, emails)
- Event counters and metrics
- Error context preservation

✅ **Additive-Only Guards**:
- No modifications to existing files
- All code in new `utils/` files
- Optional integration via middleware
- Feature flags for all enhancements

✅ **Production Readiness**:
- Comprehensive error handling
- Resource cleanup (intervals, maps)
- Memory limits (cache size, rate limit buckets)
- Health monitoring
- Graceful degradation

---

## Future Enhancements

Potential additions (not implemented yet):
- Distributed rate limiting (Redis-backed)
- Persistent caching layer
- Circuit breaker pattern
- Request tracing / distributed tracing
- Advanced anomaly detection
- A/B testing framework

---

## Support

For questions or issues with these enhancements:
1. Check this README
2. Review inline code documentation
3. Check logs for structured events
4. Use `/health` endpoint for diagnostics

---

**Version**: 2.0.0  
**Last Updated**: 2025-11-13  
**Status**: Production Ready
