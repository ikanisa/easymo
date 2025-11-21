# Integration Guide: wa-webhook Enhancements

This guide shows how to integrate the new enhancements into the existing wa-webhook without breaking existing functionality.

## ⚠️ Important Principles

1. **Additive Only**: No modifications to existing code
2. **Feature Flags**: All enhancements can be toggled via env vars
3. **Backward Compatible**: Existing behavior unchanged when features disabled
4. **Gradual Rollout**: Enable features one at a time
5. **Monitoring First**: Set up observability before enabling features

---

## Phase 1: Non-Breaking Setup (0 Risk)

### Step 1.1: Add Environment Variables

Add to your `.env` or Supabase secrets:

```bash
# Rate Limiting (disabled by default for safety)
WA_ENABLE_RATE_LIMITING=false
WA_RATE_LIMIT_WINDOW_MS=60000
WA_RATE_LIMIT_MAX_REQUESTS=100
WA_RATE_LIMIT_BLACKLIST_THRESHOLD=10

# Caching (disabled by default)
WA_ENABLE_CACHING=false
WA_CACHE_DEFAULT_TTL=300
WA_CACHE_MAX_SIZE=1000

# Error Notifications (disabled by default)
WA_ENABLE_USER_ERROR_NOTIFICATIONS=false

# Monitoring
WA_METRICS_ENABLED=true
```

### Step 1.2: Deploy Without Integration

Deploy the new utility files without any integration. This ensures:
- Files are available
- No compilation errors
- No runtime impact

```bash
# Deploy to Supabase
supabase functions deploy wa-webhook
```

### Step 1.3: Verify Health Endpoint

The health endpoint is standalone and safe to add immediately.

**Option A: Add to existing `health.ts`:**

```typescript
// In health.ts
import { createHealthCheckResponse } from "./utils/health_check.ts";

export async function handleHealthCheck(): Promise<Response> {
  return await createHealthCheckResponse();
}
```

**Option B: Add as new endpoint in `index.ts`:**

```typescript
// In index.ts
import { createHealthCheckResponse } from "./utils/health_check.ts";

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  
  // Health check endpoint
  if (url.pathname.endsWith("/health")) {
    return await createHealthCheckResponse();
  }
  
  // ... existing code ...
});
```

Test: `curl https://your-function-url/health`

---

## Phase 2: Metrics Collection (Low Risk)

Metrics collection is passive and safe to enable.

### Step 2.1: Add Metrics Endpoint

```typescript
// In index.ts
import { getPrometheusMetrics } from "./utils/metrics_collector.ts";

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  
  // Metrics endpoint
  if (url.pathname.endsWith("/metrics")) {
    return new Response(getPrometheusMetrics(), {
      headers: { "Content-Type": "text/plain" }
    });
  }
  
  // ... existing code ...
});
```

### Step 2.2: Add Basic Metrics Tracking

**In `router/pipeline.ts`**, add metrics at the end of `processWebhookRequest`:

```typescript
import { incrementMetric, recordMetricHistogram } from "../utils/metrics_collector.ts";

export async function processWebhookRequest(req: Request): Promise<PreparedWebhook | PreparedResponse> {
  const requestStart = Date.now();
  
  // ... existing code ...
  
  // ENHANCEMENT: Track metrics (passive, no side effects)
  if (result.type === "messages") {
    incrementMetric("wa_webhook_messages_received", result.messages.length, {
      hasMessages: result.messages.length > 0 ? "true" : "false"
    });
    
    const duration = Date.now() - requestStart;
    recordMetricHistogram("wa_webhook_request_duration_ms", duration, {
      messageCount: result.messages.length
    });
  }
  
  return result;
}
```

### Step 2.3: Verify Metrics

```bash
curl https://your-function-url/metrics
```

Expected output:
```
# TYPE wa_webhook_messages_received counter
wa_webhook_messages_received{hasMessages="true"} 42
# TYPE wa_webhook_request_duration_ms histogram
...
```

---

## Phase 3: Caching (Medium Risk)

Enable caching for user context lookups.

### Step 3.1: Enable Caching

```bash
# Update environment variable
WA_ENABLE_CACHING=true
WA_CACHE_DEFAULT_TTL=300  # 5 minutes
```

### Step 3.2: Add Cache to User Context Lookup

**In `router/message_context.ts`**, wrap user lookups with cache:

```typescript
import { getOrSetCached } from "../utils/cache.ts";
import { loadConfig } from "../utils/config_validator.ts";

const config = loadConfig();

export async function buildMessageContext(
  supabase: SupabaseClient,
  msg: WhatsAppMessage,
  contactLocales: Map<string, string>
): Promise<{ context: RouterContext; state: ChatState } | null> {
  
  // ... existing code ...
  
  // ENHANCEMENT: Cache user profile lookup
  let profile;
  if (config.enableCaching) {
    profile = await getOrSetCached(
      `profile:${msg.from}`,
      async () => {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, name, locale")
          .eq("phone_number", msg.from)
          .single();
        return data;
      },
      config.cacheDefaultTTL
    );
  } else {
    // Original code path
    const { data } = await supabase
      .from("profiles")
      .select("user_id, name, locale")
      .eq("phone_number", msg.from)
      .single();
    profile = data;
  }
  
  // ... rest of existing code ...
}
```

### Step 3.3: Monitor Cache Performance

Check health endpoint for cache statistics:

```bash
curl https://your-function-url/health | jq '.checks.cache'
```

Look for:
- `hitRate` > 0.7 (70% hit rate)
- `size` < `maxSize * 0.9`

---

## Phase 4: Rate Limiting (High Risk - Careful!)

Rate limiting can block legitimate users, so enable cautiously.

### Step 4.1: Test in Development First

```bash
# In development environment only
WA_ENABLE_RATE_LIMITING=true
WA_RATE_LIMIT_MAX_REQUESTS=1000  # High limit initially
```

### Step 4.2: Add Rate Limiting Check

**In `router/pipeline.ts`**, add rate limiting after message extraction:

```typescript
import { applyRateLimiting } from "../utils/middleware.ts";
import { loadConfig } from "../utils/config_validator.ts";

const config = loadConfig();

export async function processWebhookRequest(req: Request): Promise<PreparedWebhook | PreparedResponse> {
  // ... existing code until message extraction ...
  
  const messages = dedupeMessages(normalizedMessages);
  
  // ENHANCEMENT: Apply rate limiting
  if (config.enableRateLimiting && messages.length > 0) {
    const correlationId = crypto.randomUUID();
    
    // Check each unique sender
    const uniqueSenders = new Set(messages.map(m => m.from));
    for (const sender of uniqueSenders) {
      const rateLimitResult = applyRateLimiting(sender, correlationId);
      
      if (!rateLimitResult.allowed) {
        await hooks.logStructuredEvent("RATE_LIMIT_APPLIED", {
          sender: sender.slice(0, 4) + "***",
          correlationId,
        });
        
        return {
          type: "response",
          response: rateLimitResult.response!,
        };
      }
    }
  }
  
  // ... rest of existing code ...
}
```

### Step 4.3: Monitor Rate Limiting

Watch for these events in logs:
- `RATE_LIMIT_APPLIED` - Rate limit triggered
- `RATE_LIMIT_BLACKLISTED` - User blacklisted

Check metrics:
```bash
curl https://your-function-url/metrics | grep rate_limit
```

### Step 4.4: Adjust Limits Based on Traffic

Start with high limits and gradually decrease:

```bash
# Week 1: High limit
WA_RATE_LIMIT_MAX_REQUESTS=1000

# Week 2: Medium limit
WA_RATE_LIMIT_MAX_REQUESTS=500

# Week 3: Normal limit
WA_RATE_LIMIT_MAX_REQUESTS=100

# Monitor and adjust based on legitimate traffic patterns
```

---

## Phase 5: Enhanced Error Handling (Low Risk)

Add enhanced error handling to improve user experience.

### Step 5.1: Wrap Main Error Handler

**In `index.ts`**, enhance the main error handler:

```typescript
import { handleWebhookError } from "./utils/error_handler.ts";
import { loadConfig } from "./utils/config_validator.ts";

const config = loadConfig();

serve(async (req: Request): Promise<Response> => {
  const cid = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    // ... existing code ...
  } catch (err) {
    // ENHANCEMENT: Enhanced error handling
    return await handleWebhookError(err, {
      correlationId: cid,
      duration: Date.now() - startTime,
    }, false); // Don't notify users yet
    
    // Original fallback (kept for safety):
    // console.error("wa_webhook.unhandled", { cid, error: String(err) });
    // return new Response("ok", { status: 200 });
  }
});
```

### Step 5.2: Enable User Notifications (Optional)

Only after monitoring error rates:

```bash
# Enable user notifications for errors
WA_ENABLE_USER_ERROR_NOTIFICATIONS=true
```

Update the error handler call:

```typescript
return await handleWebhookError(err, {
  correlationId: cid,
  phoneNumber: extractPhoneNumber(req), // Add helper to extract
  duration: Date.now() - startTime,
}, config.enableUserErrorNotifications);
```

---

## Rollback Plan

If any enhancement causes issues:

### Quick Disable

```bash
# Disable specific features
WA_ENABLE_RATE_LIMITING=false
WA_ENABLE_CACHING=false
WA_ENABLE_USER_ERROR_NOTIFICATIONS=false
```

Redeploy:
```bash
supabase functions deploy wa-webhook
```

### Full Rollback

If needed, you can safely delete all enhancement files:
```bash
rm supabase/functions/wa-webhook/utils/rate_limiter.ts
rm supabase/functions/wa-webhook/utils/cache.ts
rm supabase/functions/wa-webhook/utils/error_handler.ts
rm supabase/functions/wa-webhook/utils/metrics_collector.ts
rm supabase/functions/wa-webhook/utils/health_check.ts
rm supabase/functions/wa-webhook/utils/config_validator.ts
rm supabase/functions/wa-webhook/utils/middleware.ts
```

Existing code will continue to work unchanged.

---

## Monitoring Checklist

After each phase, verify:

- [ ] Health endpoint returns 200
- [ ] No new errors in logs
- [ ] Response times unchanged (< 5ms overhead)
- [ ] Metrics are being collected
- [ ] Cache hit rate (if enabled) > 70%
- [ ] Rate limiting stats reasonable (if enabled)
- [ ] No legitimate users blocked

---

## Production Checklist

Before enabling in production:

- [ ] All enhancements tested in development
- [ ] Monitoring dashboards configured
- [ ] Alert thresholds set
- [ ] Rollback plan documented
- [ ] Team trained on new features
- [ ] Gradual rollout plan ready
- [ ] Load testing completed

---

## Support

If you encounter issues:

1. Check `/health` endpoint for diagnostics
2. Review structured logs for events
3. Disable problematic features via env vars
4. Consult `utils/ENHANCEMENTS.md` for documentation

---

**Remember**: All enhancements are **optional** and **additive-only**. The existing webhook continues to work perfectly without any of these features enabled.
