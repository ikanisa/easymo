# wa-webhook Enhancements Quick Reference

## 🚀 Quick Start

### 1. Deploy (Zero Risk)
```bash
# All enhancements are disabled by default
supabase functions deploy wa-webhook
```

### 2. Add Health Check (3 lines)
```typescript
// In index.ts
import { createHealthCheckResponse } from "./utils/health_check.ts";

if (req.url.endsWith("/health")) {
  return await createHealthCheckResponse();
}
```

### 3. Enable Features Gradually
```bash
# Start with metrics only
WA_METRICS_ENABLED=true

# Then caching (after monitoring)
WA_ENABLE_CACHING=true

# Finally rate limiting (carefully!)
WA_ENABLE_RATE_LIMITING=true
WA_RATE_LIMIT_MAX_REQUESTS=1000  # Start high!
```

---

## 📦 What's Included

| Utility | Lines | Purpose | Risk |
|---------|-------|---------|------|
| `rate_limiter.ts` | 197 | Prevent abuse | Medium |
| `cache.ts` | 244 | Speed up lookups | Low |
| `error_handler.ts` | 288 | Better errors | Low |
| `metrics_collector.ts` | 359 | Observability | None |
| `health_check.ts` | 187 | Monitoring | None |
| `config_validator.ts` | 215 | Config safety | None |
| `middleware.ts` | 285 | Easy integration | Low |

**Total**: 1,775 lines of production code

---

## 🎯 Common Use Cases

### Track Request Metrics
```typescript
import { incrementMetric, recordMetricHistogram } from "./utils/metrics_collector.ts";

incrementMetric("wa_message_received", 1, { type: "text" });
recordMetricHistogram("wa_duration_ms", duration);
```

### Cache User Lookups
```typescript
import { getOrSetCached } from "./utils/cache.ts";

const user = await getOrSetCached(`user:${phone}`, async () => {
  return await fetchUserFromDB(phone);
}, 300); // Cache 5 minutes
```

### Apply Rate Limiting
```typescript
import { checkRateLimit } from "./utils/rate_limiter.ts";

const result = checkRateLimit(phoneNumber, correlationId);
if (!result.allowed) {
  return new Response("Rate limited", { status: 429 });
}
```

### Enhanced Error Handling
```typescript
import { handleWebhookError } from "./utils/error_handler.ts";

try {
  // Your code
} catch (error) {
  return await handleWebhookError(error, {
    correlationId,
    phoneNumber,
    operation: "transfer"
  });
}
```

---

## ⚙️ Configuration Cheatsheet

```bash
# Metrics (always enabled)
WA_METRICS_ENABLED=true

# Rate Limiting
WA_ENABLE_RATE_LIMITING=false          # Default: disabled
WA_RATE_LIMIT_WINDOW_MS=60000          # 1 minute
WA_RATE_LIMIT_MAX_REQUESTS=100         # 100 req/min
WA_RATE_LIMIT_BLACKLIST_THRESHOLD=10   # 10 violations → ban

# Caching
WA_ENABLE_CACHING=false                # Default: disabled
WA_CACHE_DEFAULT_TTL=300               # 5 minutes
WA_CACHE_MAX_SIZE=1000                 # Max 1000 entries

# Error Notifications
WA_ENABLE_USER_ERROR_NOTIFICATIONS=false  # Default: disabled
```

---

## 📊 Health Check Response

```bash
curl https://your-function-url/health
```

```json
{
  "healthy": true,
  "status": "healthy",
  "checks": {
    "database": { "healthy": true, "responseTime": 45 },
    "rateLimiter": { "healthy": true, "bucketsCount": 127 },
    "cache": { "healthy": true, "hitRate": 0.87 },
    "metrics": { "healthy": true }
  },
  "version": "2.0.0",
  "uptime": 3600
}
```

---

## 📈 Metrics Endpoint

```bash
curl https://your-function-url/metrics
```

```
# TYPE wa_webhook_requests counter
wa_webhook_requests{messageCount="2"} 42

# TYPE wa_webhook_duration_ms histogram
wa_webhook_duration_ms_count{} 42
wa_webhook_duration_ms_sum{} 1234
wa_webhook_duration_ms_avg{} 29.38
```

---

## 🚨 Emergency Commands

### Disable All Enhancements
```bash
WA_ENABLE_RATE_LIMITING=false
WA_ENABLE_CACHING=false
WA_ENABLE_USER_ERROR_NOTIFICATIONS=false

supabase functions deploy wa-webhook
```

### Check Component Health
```bash
curl https://your-function-url/health | jq '.checks'
```

### Unblock User
```typescript
import { unblockIdentifier } from "./utils/rate_limiter.ts";
unblockIdentifier("+250788123456");
```

### Clear Cache
```typescript
import { getCacheManager } from "./utils/cache.ts";
getCacheManager().clear();
```

---

## 📋 Integration Checklist

### Phase 1: Deploy (Day 1)
- [ ] Deploy all files
- [ ] Verify compilation
- [ ] Check health endpoint works

### Phase 2: Monitoring (Week 1)
- [ ] Add `/health` endpoint
- [ ] Add `/metrics` endpoint
- [ ] Set up dashboards

### Phase 3: Caching (Week 2)
- [ ] Enable caching
- [ ] Monitor hit rate (target > 70%)
- [ ] Tune TTL values

### Phase 4: Rate Limiting (Week 3-4)
- [ ] Enable with high limits
- [ ] Monitor for false positives
- [ ] Gradually decrease limits
- [ ] Set up blacklist monitoring

### Phase 5: Notifications (Optional)
- [ ] Enable error notifications
- [ ] Monitor user feedback
- [ ] Tune message templates

---

## 🔍 Troubleshooting

| Issue | Check | Solution |
|-------|-------|----------|
| High error rate | `/health` endpoint | Check database connectivity |
| Low cache hit rate | Cache stats in health | Increase TTL or check access patterns |
| Users blocked | Rate limit stats | Adjust limits or unblock manually |
| High memory | Cache size, buckets | Reduce max sizes |
| Slow responses | Metrics histogram | Check p95/p99 latencies |

---

## 📚 Documentation

- **Full Documentation**: `ENHANCEMENTS.md`
- **Integration Guide**: `INTEGRATION_GUIDE.md`
- **This Summary**: `README.md`
- **Tests**: `*.test.ts`

---

## 🎓 Best Practices

1. **Always start with features disabled**
2. **Enable one feature at a time**
3. **Monitor for 24-48 hours before next change**
4. **Start rate limits high, lower gradually**
5. **Cache only stable data (user profiles, settings)**
6. **Test in staging first**
7. **Have rollback plan ready**

---

## ✅ Safety Guarantees

- ✅ Zero changes to existing code
- ✅ All features disabled by default
- ✅ Easy rollback (just delete files)
- ✅ No external dependencies
- ✅ Resource limits enforced
- ✅ Automatic cleanup
- ✅ Ground rules compliant

---

## 📞 Quick Support

```typescript
// Get all stats
import { getRateLimitStats } from "./utils/rate_limiter.ts";
import { getCacheStats } from "./utils/cache.ts";
import { getMetricsStats } from "./utils/metrics_collector.ts";

console.log({
  rateLimit: getRateLimitStats(),
  cache: getCacheStats(),
  metrics: getMetricsStats()
});
```

---

**Remember**: Everything is **optional** and **additive**. The webhook works perfectly without any enhancements enabled!

---

**Quick Links**:
- 🏥 Health: `https://your-function-url/health`
- 📊 Metrics: `https://your-function-url/metrics`
- 📚 Docs: `ENHANCEMENTS.md`
- 🚀 Guide: `INTEGRATION_GUIDE.md`
