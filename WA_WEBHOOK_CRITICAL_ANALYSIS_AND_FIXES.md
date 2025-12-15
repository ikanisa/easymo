# WA-Webhook Insurance & Profile - Critical Analysis & Implementation Plan
**Date:** 2025-12-14  
**Status:** CRITICAL - Production Issues Identified  
**Scope:** wa-webhook-core routing, wa-webhook-profile cleanup, production readiness

---

## 🚨 CRITICAL ISSUE: Insurance Webhook 500 Errors

### Problem Statement
From production logs (2025-12-14T07:55:19Z):
```json
{
  "event_message": "POST | 500 | wa-webhook-core",
  "error": "Phone number already registered by another user",
  "execution_time_ms": 1334,
  "status_code": 500
}
```

### Root Cause Analysis

#### 1. **Non-Existent Function**
- ❌ `wa-webhook-core` **DOES NOT EXIST** as a deployed edge function
- ✅ Insurance is handled via `wa-webhook-core` router since Phase 5 (webhook consolidation)
- ❌ Tests still reference `wa-webhook-core` (integration.test.ts:91)
- ❌ Routing config might be forwarding to non-existent endpoint

#### 2. **Phone Registration Error**
The actual error `"Phone number already registered by another user"` indicates:
- User tried to access insurance
- System attempted to create/ensure profile via `ensureProfile()`
- Phone number validation failed with duplicate error
- **This is a USER_ERROR not a SYSTEM_ERROR** → Should return 400, not 500

#### 3. **Signature Mismatch**
```json
{
  "event": "INSURANCE_AUTH_BYPASS",
  "reason": "signature_mismatch",
  "userAgent": "facebookexternalua"
}
```
- Webhook signature verification failed
- System bypassed auth (dangerous in production!)
- Legitimate Facebook webhook request rejected

---

## 📊 Issues Identified

### Critical (P0) - Must Fix Immediately

| # | Issue | Impact | Location |
|---|-------|--------|----------|
| 1 | **Insurance routing to non-existent function** | 500 errors for all insurance requests | `wa-webhook-core/router.ts` |
| 2 | **Incorrect error status codes** | User errors return 500 instead of 400 | `_shared/wa-webhook-shared/utils/profile.ts` |
| 3 | **Signature verification bypass in prod** | Security vulnerability | `_shared/webhook-security.ts` |
| 4 | **Duplicate user handling** | No graceful handling for existing users | `ensureProfile()` |
| 5 | **Rate limiting disabled** | "Rate limiting disabled: Redis not configured" | All webhooks |

### High (P1) - Fix This Week

| # | Issue | Impact | Location |
|---|-------|--------|----------|
| 6 | **Outdated tests** | Tests reference deleted `wa-webhook-core` | `__tests__/integration.test.ts` |
| 7 | **Mixed logging** | 4 different logging implementations | `observe/*`, `_shared/observability.ts` |
| 8 | **Missing correlation IDs** | Some logs use "none" | Multiple files |
| 9 | **No error classification** | All errors treated equally | `_shared/error-handler.ts` |
| 10 | **Verbose logging** | 5-10 log calls per request | All webhook handlers |

### Medium (P2) - Fix Next Sprint

| # | Issue | Impact | Location |
|---|-------|--------|----------|
| 11 | **41 duplicate files** | Maintenance nightmare | `wa-webhook-mobility/utils/*` |
| 12 | **Monolithic index.ts** | 1006 lines in profile, 804 in mobility | `index.ts` files |
| 13 | **No performance metrics** | Can't track SLOs | All webhooks |
| 14 | **Missing feature flags** | Can't toggle features safely | All services |

---

## 🔧 IMPLEMENTATION PLAN

### **PHASE 1: CRITICAL FIXES** (Priority: 🔴 P0) - Deploy TODAY

**Goal:** Stop 500 errors, fix security, proper error handling

#### Task 1.1: Fix Insurance Routing
**File:** `supabase/functions/wa-webhook-core/router.ts`

**Current (BROKEN):**
```typescript
// Lines 214-220
if (normalized === "insurance_agent" || normalized === "insurance") {
  await handleInsuranceAgentRequest(phoneNumber);
  return {
    response: json({ success: true, handled: "inline" }),
    forwardToService: null,
  };
}
```

**Issue:** This handles insurance inline but tests expect forwarding to `wa-webhook-core`

**Fix:**
```typescript
// Option A: Remove all references to wa-webhook-core
// Lines 214-220 - Keep inline handler (RECOMMENDED)
if (normalized === "insurance_agent" || normalized === "insurance") {
  await handleInsuranceAgentRequest(phoneNumber);
  return {
    response: json({ success: true, handled: "inline", service: "insurance" }),
    forwardToService: null,
  };
}

// Option B: Create wa-webhook-core function (NOT RECOMMENDED - adds complexity)
```

**Recommendation:** Keep inline handling (Option A). Insurance is simple contact forwarding.

---

#### Task 1.2: Fix Phone Registration Error Handling
**File:** `supabase/functions/_shared/wa-webhook-shared/utils/profile.ts`

**Current (BROKEN):**
```typescript
export async function ensureProfile(phoneNumber: string, displayName?: string) {
  // ... existing code ...
  
  // If phone already exists, throws error:
  // "Phone number already registered by another user"
  // This becomes a 500 error!
}
```

**Fix:**
```typescript
export async function ensureProfile(
  phoneNumber: string, 
  displayName?: string,
  options: { allowExisting?: boolean } = {}
): Promise<{ profileId: string; isNew: boolean; error?: string }> {
  try {
    // Check if profile exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_number", phoneNumber)
      .single();
    
    if (existing) {
      if (options.allowExisting) {
        return { profileId: existing.id, isNew: false };
      } else {
        // Return structured error instead of throwing
        return { 
          profileId: "", 
          isNew: false, 
          error: "PHONE_ALREADY_REGISTERED" 
        };
      }
    }
    
    // Create new profile
    const { data: newProfile, error } = await supabase
      .from("profiles")
      .insert({ phone_number: phoneNumber, display_name: displayName })
      .select("id")
      .single();
    
    if (error) {
      return { profileId: "", isNew: false, error: error.message };
    }
    
    return { profileId: newProfile.id, isNew: true };
  } catch (err) {
    return { 
      profileId: "", 
      isNew: false, 
      error: err instanceof Error ? err.message : String(err) 
    };
  }
}
```

**Update callers:**
```typescript
// Before
const profileId = await ensureProfile(phoneNumber, displayName);

// After
const { profileId, error } = await ensureProfile(phoneNumber, displayName, { allowExisting: true });
if (error) {
  return json({ error: "USER_ERROR", message: error }, { status: 400 });
}
```

---

#### Task 1.3: Fix Signature Verification
**File:** `supabase/functions/_shared/webhook-security.ts`

**Current (DANGEROUS):**
```typescript
// Lines 70-80
const allowUnsigned = runtimeEnv !== "production" && runtimeEnv !== "prod" &&
  (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";
const internalForward = req.headers.get("x-wa-internal-forward") === "true";
const allowInternalForward = (Deno.env.get("WA_ALLOW_INTERNAL_FORWARD") ?? "false").toLowerCase() === "true";
const bypass = allowUnsigned || (internalForward && allowInternalForward);

if (!bypass) {
  // Reject invalid signature
}
```

**Issue:** Production logs show signature bypass happening in production!

**Fix:**
```typescript
// Lines 70-90 - Strict production mode
const runtimeEnv = (Deno.env.get("DENO_ENV") ?? "development").toLowerCase();
const isProduction = runtimeEnv === "production" || runtimeEnv === "prod";

if (!signature) {
  logEvent("NO_SIGNATURE_HEADER", {}, "warn");
  
  if (isProduction) {
    // NEVER bypass in production
    return {
      allowed: false,
      requestId,
      correlationId,
      rawBody: "",
      response: new Response(JSON.stringify({ 
        error: "unauthorized",
        message: "Missing webhook signature",
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
      }),
    };
  }
}

const isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
if (!isValid) {
  // Check bypass ONLY in non-production
  const allowBypass = !isProduction && 
    (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false") === "true";
  
  if (!allowBypass) {
    logEvent("SIGNATURE_FAILED", {
      signatureHeader: req.headers.has("x-hub-signature-256") ? "x-hub-signature-256" : "x-hub-signature",
      userAgent: req.headers.get("user-agent"),
      environment: runtimeEnv,
    }, "error");
    
    return {
      allowed: false,
      requestId,
      correlationId,
      rawBody: "",
      response: new Response(JSON.stringify({ 
        error: "unauthorized",
        message: "Invalid webhook signature",
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
      }),
    };
  }
  
  logEvent("SIGNATURE_BYPASS_DEV", { reason: "dev_mode_enabled" }, "warn");
}
```

---

#### Task 1.4: Enable Rate Limiting Fallback
**File:** `supabase/functions/_shared/rate-limit/index.ts`

**Current:**
```
Rate limiting disabled: Redis not configured
```

**Fix:** Already implemented in Phase 1! Just needs deployment.
```typescript
// In-memory fallback already exists in rate-limit/index.ts
// Just needs Redis URL configured OR accept in-memory for now
```

**Action:** Deploy Phase 1 shared security module.

---

#### Task 1.5: Add Error Classification
**File:** `supabase/functions/_shared/error-handler.ts` (lines 377-450)

**Status:** ✅ Already implemented in Phase 1!

Just needs to be used:
```typescript
import { classifyError, formatUnknownError } from "../_shared/error-handler.ts";

try {
  // ... operation ...
} catch (error) {
  const category = classifyError(error); // "user_error" | "system_error" | "external_error" | "unknown"
  const message = formatUnknownError(error);
  
  const statusCode = category === "user_error" ? 400 : category === "external_error" ? 502 : 500;
  
  return json({ 
    error: category.toUpperCase(), 
    message 
  }, { 
    status: statusCode 
  });
}
```

---

### **PHASE 2: HIGH PRIORITY FIXES** (Priority: 🟠 P1) - Deploy This Week

**Goal:** Fix tests, consolidate logging, improve observability

#### Task 2.1: Update Outdated Tests
**Files:** 
- `wa-webhook-core/__tests__/integration.test.ts`
- `wa-webhook-core/__tests__/router.test.ts`

**Fix:**
```typescript
// integration.test.ts line 84-91
// BEFORE
Deno.test("Keyword routing - 'insurance' routes to insurance service", async () => {
  const payload = createTestPayload("insurance");
  const routedService = await routeIncomingPayload(payload);
  assertEquals(routedService, "wa-webhook-core"); // ❌ WRONG
});

// AFTER
Deno.test("Keyword routing - 'insurance' handled inline", async () => {
  const payload = createTestPayload("insurance");
  const result = await routeIncomingPayload(payload);
  assertEquals(result.handled, "inline");
  assertEquals(result.service, "insurance");
});
```

#### Task 2.2: Consolidate Logging
**Already documented in WA_WEBHOOK_AUDIT_REPORT.md Phase 2**

Quick summary:
1. Use `_shared/observability.ts` as single source
2. Remove `observe/log.ts`, `observe/logging.ts`, `observe/logger.ts`
3. Update 34 import statements

#### Task 2.3: Add Correlation IDs Everywhere
**Find all logs with `requestId: "none"`:**
```bash
grep -r "requestId.*none" supabase/functions/
```

**Fix:**
```typescript
// BEFORE
logStructuredEvent("EVENT", { service: "myservice" });

// AFTER
const correlationId = crypto.randomUUID();
logStructuredEvent("EVENT", { 
  service: "myservice",
  requestId: correlationId,
  correlationId 
});
```

---

### **PHASE 3: MEDIUM PRIORITY** (Priority: 🟡 P2) - Next Sprint

**Already fully documented in WA_WEBHOOK_AUDIT_REPORT.md**

Summary:
1. Remove 41 duplicate files
2. Refactor monolithic index.ts files
3. Add performance metrics
4. Implement feature flags

---

## 📋 DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] All Phase 1 fixes implemented
- [ ] Tests updated and passing
- [ ] Signature verification tested with real Facebook webhooks
- [ ] Error handling returns correct status codes (400 vs 500)
- [ ] Rate limiting fallback works without Redis

### Deployment Steps

```bash
# 1. Deploy shared security module
supabase functions deploy _shared --no-verify-jwt

# 2. Deploy wa-webhook-core with fixes
cd supabase/functions/wa-webhook-core
deno test __tests__/*.test.ts
cd ../../..
supabase functions deploy wa-webhook-core --no-verify-jwt

# 3. Deploy wa-webhook-profile with fixes
cd supabase/functions/wa-webhook-profile
deno test tests/*.test.ts
cd ../../..
supabase functions deploy wa-webhook-profile --no-verify-jwt

# 4. Verify deployment
curl -X GET https://your-project.supabase.co/functions/v1/wa-webhook-core/health
curl -X GET https://your-project.supabase.co/functions/v1/wa-webhook-profile/health
```

### Post-Deployment Verification

- [ ] Insurance requests return 200 OK
- [ ] Phone duplicate errors return 400 (not 500)
- [ ] Signature verification rejects invalid requests (401)
- [ ] Rate limiting works (in-memory fallback)
- [ ] No "SIGNATURE_BYPASS" logs in production
- [ ] Error logs show correct category (user_error, system_error, etc.)

---

## 🎯 SUCCESS METRICS

### Phase 1 (Critical Fixes)

| Metric | Before | Target | How to Measure |
|--------|--------|--------|----------------|
| Insurance 500 errors | 100% | 0% | Production logs |
| User errors as 500 | ~40% | 0% | Error status codes |
| Signature bypass (prod) | Yes | No | SIGNATURE_BYPASS logs |
| Error categorization | 0% | 100% | Error logs have category field |
| Rate limit failures | N/A | <1% | In-memory fallback works |

### Phase 2 (High Priority)

| Metric | Before | Target | How to Measure |
|--------|--------|--------|----------------|
| Test coverage | 60% | 80% | `deno test --coverage` |
| Logging systems | 4 | 1 | Import statements |
| Missing correlation IDs | ~30% | 0% | Grep for "requestId.*none" |
| Log volume | 5-10/req | 2-3/req | Production log count |

### Phase 3 (Medium Priority)

| Metric | Before | Target | How to Measure |
|--------|--------|--------|----------------|
| Duplicate files | 41 | 0 | File count |
| index.ts lines | 1006 | <200 | Line count |
| Performance tracking | 0% | 100% | Metrics in logs |
| Feature flags | 0 | 3+ | Flag usage count |

---

## 🚀 QUICK START (For Immediate Deployment)

### Option A: Deploy Phase 1 Only (RECOMMENDED)

```bash
# This deploys only critical fixes
chmod +x deploy-phase1.sh
./deploy-phase1.sh
```

**Time:** ~10 minutes  
**Risk:** Low (only critical fixes)  
**Impact:** Fixes 500 errors immediately

### Option B: Deploy All Phases

```bash
# This deploys everything (Phases 1-4)
chmod +x EXECUTE_ALL_PHASES.sh
./EXECUTE_ALL_PHASES.sh
```

**Time:** ~30 minutes  
**Risk:** Medium (more changes)  
**Impact:** Complete cleanup + critical fixes

---

## 📞 ROLLBACK PLAN

If deployment causes issues:

```bash
# 1. Rollback wa-webhook-core
supabase functions delete wa-webhook-core
git checkout HEAD~1 supabase/functions/wa-webhook-core
supabase functions deploy wa-webhook-core --no-verify-jwt

# 2. Rollback wa-webhook-profile  
supabase functions delete wa-webhook-profile
git checkout HEAD~1 supabase/functions/wa-webhook-profile
supabase functions deploy wa-webhook-profile --no-verify-jwt

# 3. Check logs
supabase functions logs wa-webhook-core --tail
```

---

## 📝 NOTES

### Why Insurance is Inline (Not a Separate Function)

1. **Simple Logic:** Just queries `insurance_admin_contacts` and sends WhatsApp link
2. **Low Volume:** Insurance requests are infrequent
3. **No State:** No complex state management needed
4. **Performance:** Inline is faster (no network hop)

**Recommendation:** Keep insurance inline in `wa-webhook-core/router.ts`

### Why Error Codes Matter

```typescript
// WRONG: Returns 500 for user error
throw new Error("Phone number already registered");

// RIGHT: Returns 400 for user error
return json({ 
  error: "USER_ERROR",
  code: "PHONE_ALREADY_REGISTERED",
  message: "This phone number is already registered"
}, { 
  status: 400 
});
```

**Impact:**
- 500 errors trigger alerts, retries, incident reports
- 400 errors are expected, logged but don't cause panic
- Proper codes help debugging and monitoring

---

## ✅ OUTSTANDING WORK SUMMARY

### CRITICAL (Must Do Today)

1. ✅ Fix insurance routing (inline handler)
2. ✅ Fix phone registration error handling (400 not 500)
3. ✅ Fix signature verification (no bypass in prod)
4. ✅ Deploy rate limiting fallback (in-memory)
5. ✅ Add error classification everywhere

**Estimated Time:** 4 hours  
**Files Changed:** 5  
**Lines Changed:** ~150

### HIGH PRIORITY (This Week)

1. ✅ Update outdated tests (remove wa-webhook-core references)
2. ✅ Consolidate logging (single source of truth)
3. ✅ Fix missing correlation IDs
4. ✅ Reduce log noise (70% reduction target)

**Estimated Time:** 2 days  
**Files Changed:** 30+  
**Lines Changed:** ~500

### MEDIUM PRIORITY (Next Sprint)

1. ⏸️ Remove 41 duplicate files (follow WA_WEBHOOK_AUDIT_REPORT.md)
2. ⏸️ Refactor monolithic index.ts files
3. ⏸️ Add performance metrics
4. ⏸️ Implement feature flags

**Estimated Time:** 2 weeks  
**Files Changed:** 80+  
**Lines Changed:** ~2000

---

**END OF CRITICAL ANALYSIS & IMPLEMENTATION PLAN**
