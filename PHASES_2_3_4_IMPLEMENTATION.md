# Phases 2, 3, 4 - Complete Implementation Guide

**Date:** 2025-12-14  
**Status:** READY TO IMPLEMENT  
**Time:** 6-8 hours

---

## PHASE 2: CODE CONSOLIDATION (2-3 hours)

### 2.1 Migrate wa-webhook-profile to Shared Security

**File:** `supabase/functions/wa-webhook-profile/index.ts`

**Current code (lines 72-230):** ~160 lines of security logic

**Replace with:**

```typescript
import { webhookSecurityCheck, createResponder } from "../_shared/webhook-security.ts";
import { formatUnknownError } from "../_shared/utils/error-formatter.ts";

// Remove these imports (no longer needed):
// - rateLimitMiddleware
// - verifyWebhookSignature
// - MAX_BODY_SIZE constant
// - respond function (replaced by createResponder)

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  
  // Health check (keep as-is)
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    // ... existing health check code ...
  }
  
  // Webhook verification (keep as-is)
  if (req.method === "GET") {
    // ... existing verification code ...
  }
  
  // Main webhook handler - REPLACE ENTIRE SECURITY SECTION
  try {
    // Use shared security check (replaces 160 lines!)
    const securityCheck = await webhookSecurityCheck(req, {
      serviceName: SERVICE_NAME,
      maxBodySize: profileConfig.maxBodySize,
      rateLimit: profileConfig.rateLimit,
      rateWindow: profileConfig.rateWindow,
      verifySignature: true,
    });
    
    if (!securityCheck.allowed) {
      return securityCheck.response!;
    }
    
    const { rawBody, requestId, correlationId } = securityCheck;
    const respond = createResponder(SERVICE_NAME, requestId, correlationId);
    
    // Continue with existing business logic...
    const body: WhatsAppWebhookPayload = JSON.parse(rawBody);
    // ... rest of handler ...
    
  } catch (error) {
    return respond({
      error: "internal_error",
      message: formatUnknownError(error),
    }, { status: 500 });
  }
});
```

**Impact:**
- 160 lines → 15 lines (90% reduction)
- Consistent security across webhooks
- Easier to maintain

### 2.2 Create Performance Timing Utility (Phase 3 prep)

**File:** `supabase/functions/_shared/utils/performance.ts`

```typescript
/**
 * Performance Timing Utility
 * Tracks operation duration and success/failure metrics
 */

import { logStructuredEvent } from "../observability/index.ts";

export interface TimingResult<T> {
  result: T;
  durationMs: number;
}

/**
 * Wrap async operation with timing
 */
export async function withTiming<T>(
  operation: string,
  fn: () => Promise<T>,
  context: Record<string, unknown> = {}
): Promise<TimingResult<T>> {
  const start = performance.now();
  
  try {
    const result = await fn();
    const durationMs = performance.now() - start;
    
    logStructuredEvent(`${operation}_COMPLETED`, {
      durationMs,
      success: true,
      ...context,
    }, "info");
    
    return { result, durationMs };
  } catch (error) {
    const durationMs = performance.now() - start;
    
    logStructuredEvent(`${operation}_FAILED`, {
      durationMs,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      ...context,
    }, "error");
    
    throw error;
  }
}

/**
 * Track operation metrics (for Prometheus/PostHog)
 */
export async function recordMetric(
  metric: string,
  value: number,
  tags: Record<string, string> = {}
): Promise<void> {
  // Log as structured event for now
  // Can be enhanced to push to PostHog/Prometheus later
  logStructuredEvent("METRIC_RECORDED", {
    metric,
    value,
    tags,
    timestamp: Date.now(),
  }, "info");
}
```

---

## PHASE 3: OBSERVABILITY (2-3 hours)

### 3.1 Enhanced Error Logging with Classification

**Update:** `supabase/functions/_shared/utils/error-formatter.ts`

Add this function:

```typescript
import { logStructuredEvent } from "../observability/index.ts";
import { recordMetric } from "./performance.ts";

/**
 * Log error with classification and metrics
 */
export function logError(
  error: unknown,
  context: {
    service: string;
    operation: string;
    requestId?: string;
    correlationId?: string;
    [key: string]: unknown;
  }
): void {
  const category = classifyError(error);
  const message = formatUnknownError(error);
  const stackTrace = getStackTrace(error);
  
  logStructuredEvent("ERROR_CLASSIFIED", {
    error: message,
    category,
    stackTrace: stackTrace?.split('\n').slice(0, 5).join('\n'), // First 5 lines
    retryable: isRetryableError(category),
    ...context,
  }, "error");
  
  // Track error metrics by category
  recordMetric("errors_total", 1, {
    category,
    service: context.service,
    operation: context.operation,
  });
}

/**
 * Determine if error is retryable
 */
export function isRetryableError(category: ErrorCategory): boolean {
  return category === "external_error"; // Only retry external errors
}
```

### 3.2 Use Enhanced Error Logging

**Update webhook handlers to use:**

```typescript
try {
  // ... operation ...
} catch (error) {
  logError(error, {
    service: SERVICE_NAME,
    operation: "process_message",
    requestId,
    correlationId,
    phoneNumber: from,
    messageType: body.entry[0]?.changes[0]?.value?.messages?.[0]?.type,
  });
  
  // Return appropriate response based on category
  const category = classifyError(error);
  if (category === "user_error") {
    return respond({ error: "invalid_request" }, { status: 400 });
  } else if (category === "external_error") {
    return respond({ error: "service_unavailable" }, { status: 503 });
  } else {
    return respond({ error: "internal_error" }, { status: 500 });
  }
}
```

### 3.3 Add Performance Tracking

**Wrap expensive operations:**

```typescript
// Database queries
const { result: profile, durationMs } = await withTiming(
  "ENSURE_PROFILE",
  () => ensureProfile(supabase, from),
  { phoneNumber: from }
);

if (durationMs > 1000) {
  logStructuredEvent("SLOW_OPERATION", {
    operation: "ENSURE_PROFILE",
    durationMs,
    phoneNumber: from,
  }, "warn");
}

// External API calls
const { result: waResponse } = await withTiming(
  "WHATSAPP_SEND_MESSAGE",
  () => sendText(to, message),
  { messageType: "text" }
);

// State operations
const { result: state } = await withTiming(
  "GET_STATE",
  () => getState(supabase, from),
  { phoneNumber: from }
);
```

---

## PHASE 4: COMPREHENSIVE TESTS (2 hours)

### 4.1 Core Security Tests

**File:** `supabase/functions/__tests__/webhook-security-advanced.test.ts`

```typescript
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { checkRateLimit } from "../_shared/rate-limit/index.ts";
import { checkIdempotency } from "../_shared/webhook-security.ts";
import { ensureProfile } from "../_shared/wa-webhook-shared/utils/profile.ts";

Deno.test("Rate Limiting - In-memory fallback works", async () => {
  // Unset Redis to force in-memory
  const originalUrl = Deno.env.get("UPSTASH_REDIS_URL");
  Deno.env.delete("UPSTASH_REDIS_URL");
  
  try {
    const config = {
      key: "test-key-" + Date.now(),
      limit: 5,
      windowSeconds: 60,
    };
    
    // Send requests up to limit
    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit(config);
      assertEquals(result.allowed, true, `Request ${i + 1} should be allowed`);
    }
    
    // 6th request should be blocked
    const blocked = await checkRateLimit(config);
    assertEquals(blocked.allowed, false, "6th request should be blocked");
    assertEquals(blocked.remaining, 0);
  } finally {
    if (originalUrl) Deno.env.set("UPSTASH_REDIS_URL", originalUrl);
  }
});

Deno.test("Phone Registration - Concurrent duplicates succeed", async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseKey) {
    console.log("⚠️ Skipping (no Supabase credentials)");
    return;
  }
  
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.1");
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const testPhone = `+25078812${Date.now() % 10000}`;
  
  // Send 5 concurrent requests
  const promises = Array.from({ length: 5 }, (_, i) => 
    ensureProfile(supabase, testPhone)
      .catch(err => ({ error: err.message, index: i }))
  );
  
  const results = await Promise.all(promises);
  
  // All should succeed
  const errors = results.filter(r => 'error' in r);
  assertEquals(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors)}`);
  
  // All should return same user_id
  const userIds = results.map(r => 'user_id' in r ? r.user_id : null).filter(Boolean);
  assertEquals(new Set(userIds).size, 1, "All requests should return same user");
  
  console.log(`✅ ${results.length} concurrent requests → 1 user created`);
});

Deno.test("Memory Cleanup - In-memory store doesn't leak", async () => {
  Deno.env.delete("UPSTASH_REDIS_URL");
  
  // Create many rate limit keys
  for (let i = 0; i < 1000; i++) {
    await checkRateLimit({
      key: `leak-test-${i}`,
      limit: 100,
      windowSeconds: 1, // 1 second window
    });
  }
  
  // Wait for cleanup (runs every 60s, but let's wait 2s)
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Create one more to trigger cleanup check
  const result = await checkRateLimit({
    key: "cleanup-trigger",
    limit: 100,
    windowSeconds: 60,
  });
  
  assertEquals(result.allowed, true);
  console.log("✅ Memory cleanup working");
});
```

### 4.2 Error Classification Tests

**File:** `supabase/functions/__tests__/error-classification.test.ts`

```typescript
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { classifyError, formatUnknownError, isRetryableError } from "../_shared/utils/error-formatter.ts";

Deno.test("Error Classification - User errors", () => {
  assertEquals(classifyError(new Error("Invalid phone number")), "user_error");
  assertEquals(classifyError(new Error("User not found")), "user_error");
  assertEquals(classifyError(new Error("Unauthorized access")), "user_error");
  assertEquals(classifyError(new Error("Bad request")), "user_error");
});

Deno.test("Error Classification - System errors", () => {
  assertEquals(classifyError(new Error("Database connection failed")), "system_error");
  assertEquals(classifyError(new Error("Internal server error")), "system_error");
  assertEquals(classifyError(new Error("Panic: out of memory")), "system_error");
});

Deno.test("Error Classification - External errors", () => {
  assertEquals(classifyError(new Error("Timeout waiting for response")), "external_error");
  assertEquals(classifyError(new Error("Network error")), "external_error");
  assertEquals(classifyError(new Error("Upstream service unavailable")), "external_error");
});

Deno.test("Error Classification - Only external errors are retryable", () => {
  assertEquals(isRetryableError("user_error"), false);
  assertEquals(isRetryableError("system_error"), false);
  assertEquals(isRetryableError("external_error"), true);
  assertEquals(isRetryableError("unknown"), false);
});

Deno.test("Format Unknown Error - Handles all types", () => {
  assertEquals(formatUnknownError(new Error("test error")), "test error");
  assertEquals(formatUnknownError("string error"), "string error");
  assertEquals(formatUnknownError({ message: "object error" }), "object error");
  assertEquals(formatUnknownError(null), "null");
  assertEquals(formatUnknownError(undefined), "undefined");
});
```

### 4.3 Run All Tests

```bash
# Run all tests
cd supabase/functions
deno test --allow-net --allow-env --no-check __tests__/*.test.ts

# Expected output:
# ✅ webhook-security.test.ts: 3 passed
# ✅ webhook-security-advanced.test.ts: 3 passed
# ✅ error-classification.test.ts: 5 passed
# 
# Total: 11 passed | 0 failed
```

---

## Implementation Checklist

### Phase 2: Code Consolidation
- [ ] Create `_shared/utils/performance.ts`
- [ ] Update `wa-webhook-profile/index.ts` to use `webhookSecurityCheck()`
- [ ] Remove duplicate security code (160 lines → 15 lines)
- [ ] Test locally
- [ ] Commit changes

### Phase 3: Observability
- [ ] Add `logError()` to error-formatter.ts
- [ ] Add `isRetryableError()` helper
- [ ] Update error handlers to use `logError()`
- [ ] Add `withTiming()` to expensive operations
- [ ] Test error classification
- [ ] Commit changes

### Phase 4: Tests
- [ ] Create `webhook-security-advanced.test.ts`
- [ ] Create `error-classification.test.ts`
- [ ] Run all tests (expect 11 passed)
- [ ] Fix any failures
- [ ] Commit changes

---

## Deployment Order

1. **Deploy Phase 2** (after testing)
   ```bash
   supabase functions deploy wa-webhook-profile
   ```

2. **Monitor Phase 2** (check metrics)
   - Error rate should stay same or decrease
   - Performance should be same or better
   - Code is now 90% shorter

3. **Deploy Phase 3** (after monitoring Phase 2)
   - Enhanced error logging active
   - Performance metrics available
   - Better debugging data

4. **Verify Phase 4** (tests run locally)
   - No deployment needed
   - Tests validate all phases work

---

## Time Estimates

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 2 | Create performance util | 30min | TODO |
| 2 | Migrate wa-webhook-profile | 1-2h | TODO |
| 2 | Test locally | 30min | TODO |
| 3 | Enhanced error logging | 1h | TODO |
| 3 | Add performance tracking | 1h | TODO |
| 3 | Test error classification | 30min | TODO |
| 4 | Advanced security tests | 1h | TODO |
| 4 | Error classification tests | 30min | TODO |
| 4 | Run all tests | 30min | TODO |

**Total:** 6-8 hours

---

## Success Metrics

After full implementation:

- Code reduction: 40% (160 lines → 15 lines in profile)
- Test coverage: 80% (11 tests passing)
- Error classification: 100% (all errors categorized)
- Performance tracking: 100% (all ops timed)
- Observability: HIGH (rich debug data)

---

**Ready to implement!** Start with Phase 2, then 3, then 4.
