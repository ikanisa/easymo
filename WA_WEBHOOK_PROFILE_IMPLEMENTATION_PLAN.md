# WA-Webhook-Profile: Critical Fixes Implementation Plan

**Date:** 2025-12-14
**Status:** IN PROGRESS  
**Priority:** P0 (CRITICAL)

---

## 🚨 CRITICAL ISSUES FOUND

### Issue #1: Broken Code Structure in index.ts
**Location:** `supabase/functions/wa-webhook-profile/index.ts`  
**Severity:** P0 - BLOCKING ALL REQUESTS

**Problem:**
```typescript
// Line 119: respond() function defined INSIDE serve() handler
const respond = (body: unknown, init: ResponseInit = {}): Response => {
  // Lines 120-125: Set headers (OK)
  headers.set("X-Service-Version", SERVICE_VERSION);
  
  // Lines 126-850: ALL BUSINESS LOGIC INSIDE respond() (WRONG!)
  const cacheKey = `${from}:${messageId}`;  // ❌ from/messageId undefined!
  const cached = responseCache.get(cacheKey);
  // ... 700 more lines of business logic ...
  return respond(successResponse);  // ❌ Recursive call!
};
```

**Root Cause:**
- The `respond()` helper function incorrectly contains ALL the webhook handling logic
- Variables `from`, `messageId`, `message` are referenced but never defined
- Creates impossible recursive calls
- Makes the entire webhook non-functional

**Impact:**
- **Every request fails** with undefined variable errors
- Explains the 500 errors in production logs
- No request can be processed successfully

---

### Issue #2: No Request Parsing
**Problem:** Missing payload extraction before respond()  
**Fix:** Add proper WhatsApp webhook payload parsing

```typescript
// MUST ADD before line 119:
// Parse request body
const payload = await req.json() as WhatsAppWebhookPayload;

// Validate payload structure
if (!payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
  return json({ success: true, ignored: "no_messages" }, { status: 200 });
}

// Extract message data
const change = payload.entry[0].changes[0].value;
const message = change.messages[0];
const from = message.from;
const messageId = message.id;
```

---

### Issue #3: No GET Handler (WhatsApp Verification)
**Problem:** Missing WhatsApp webhook verification endpoint  
**Impact:** Webhook cannot be registered with WhatsApp

**Fix:** Add before POST handling:
```typescript
// WhatsApp verification (GET)
if (req.method === "GET") {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  
  if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
    return new Response(challenge ?? "", { status: 200 });
  }
  
  return json({ error: "forbidden" }, { status: 403 });
}
```

---

### Issue #4: No Signature Verification
**Problem:** No webhook signature verification (security risk)  
**Fix:** Add after request parsing:

```typescript
const appSecret = Deno.env.get("WA_APP_SECRET") ?? "";
const signature = req.headers.get("x-hub-signature-256") ?? "";

const isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
if (!isValid) {
  return json({ error: "unauthorized" }, { status: 401 });
}
```

---

### Issue #5: Missing logEvent Helper
**Problem:** Code calls `logEvent()` but it's not defined  
**Fix:** Add helper function:

```typescript
const logEvent = (
  event: string,
  payload: Record<string, unknown> = {},
  level: "debug" | "info" | "warn" | "error" = "info",
) => {
  logStructuredEvent(event, {
    service: SERVICE_NAME,
    requestId,
    correlationId,
    ...payload,
  }, level);
};
```

---

## 📋 IMPLEMENTATION PHASES

### **PHASE 1: Fix Critical Structure (P0)**
**Goal:** Make webhook functional  
**Time:** 2-3 hours

#### Steps:
1. ✅ Create this implementation plan
2. ⬜ Backup current index.ts
3. ⬜ Restructure index.ts:
   - Move `respond()` to simple helper (10 lines max)
   - Add GET handler for WhatsApp verification
   - Add proper request parsing
   - Add signature verification
   - Move business logic out of respond()
4. ⬜ Add missing helper functions (logEvent, json)
5. ⬜ Test locally with curl
6. ⬜ Deploy to dev environment
7. ⬜ Test with WhatsApp webhook simulator

**Success Criteria:**
- [ ] GET /wa-webhook-profile?hub.mode=subscribe returns challenge
- [ ] POST with valid signature returns 200
- [ ] POST with invalid signature returns 401
- [ ] No undefined variable errors
- [ ] Requests processed in < 2s

---

### **PHASE 2: Fix Error Handling (P0)**
**Goal:** Proper error classification  
**Time:** 1 hour

#### Fix 1: Profile Duplicate Errors Return 400
**File:** `_shared/wa-webhook-shared/utils/profile.ts`

**Current:**
```typescript
throw new Error("Phone number already registered");  // Becomes 500!
```

**New:**
```typescript
return { 
  profileId: null, 
  error: { 
    type: "USER_ERROR", 
    code: "PHONE_DUPLICATE",
    message: "Phone already registered",
    statusCode: 400 
  } 
};
```

#### Fix 2: Classify All Errors
```typescript
class WebhookError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isRetryable: boolean = false,
  ) {
    super(message);
    this.name = "WebhookError";
  }
}

// Usage
throw new WebhookError(
  "Phone already registered",
  "PHONE_DUPLICATE",
  400,  // Client error
  false // Don't retry
);
```

---

### **PHASE 3: Security Hardening (P0)**
**Goal:** No production bypasses  
**Time:** 30 minutes

**File:** `_shared/webhook-security.ts` (lines 70-90)

**Current:**
```typescript
const bypass = allowUnsigned || (internalForward && allowInternalForward);
if (!bypass) { /* reject */ }
```

**New:**
```typescript
const isProduction = runtimeEnv === "production" || runtimeEnv === "prod";

if (isProduction) {
  // NEVER bypass in production
  if (!signature) {
    return unauthorized("Missing signature");
  }
  if (!isValid) {
    return unauthorized("Invalid signature");
  }
} else {
  // Dev mode: Allow bypass only if explicitly enabled
  const allowBypass = Deno.env.get("WA_ALLOW_UNSIGNED") === "true";
  if (!allowBypass && !isValid) {
    return unauthorized("Invalid signature (dev mode bypass disabled)");
  }
}
```

---

### **PHASE 4: Rate Limiting (P1)**
**Goal:** Enable rate limiting (already implemented)  
**Time:** 15 minutes

**File:** `_shared/rate-limit/index.ts`

**Status:** ✅ In-memory fallback already exists  
**Action:** Just needs deployment

**Verify:**
```bash
# Check rate limit logs
supabase functions logs wa-webhook-profile --limit 50 | grep -i "rate"
```

**Expected:**
```
✅ "Rate limiting enabled: in-memory store"
❌ "Rate limiting disabled: Redis not configured"
```

---

### **PHASE 5: Testing (P0)**
**Goal:** Ensure all fixes work  
**Time:** 1 hour

#### Test Cases:
1. **WhatsApp Verification (GET)**
   ```bash
   curl "https://[project].supabase.co/functions/v1/wa-webhook-profile?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=$WA_VERIFY_TOKEN"
   # Expected: "test123"
   ```

2. **Valid Webhook (POST)**
   ```bash
   # Generate signature
   echo -n '{"entry":[]}' | openssl dgst -sha256 -hmac "$WA_APP_SECRET" | sed 's/^.* //'
   
   curl -X POST https://[project].supabase.co/functions/v1/wa-webhook-profile \
     -H "Content-Type: application/json" \
     -H "x-hub-signature-256: sha256=<signature>" \
     -d '{"entry":[]}'
   # Expected: 200 {"success":true}
   ```

3. **Invalid Signature (POST)**
   ```bash
   curl -X POST https://[project].supabase.co/functions/v1/wa-webhook-profile \
     -H "Content-Type: application/json" \
     -H "x-hub-signature-256: sha256=invalid" \
     -d '{"entry":[]}'
   # Expected: 401 {"error":"unauthorized"}
   ```

4. **Duplicate Phone (POST)**
   ```bash
   # Send message from already registered phone
   # Expected: 400 {"error":"USER_ERROR","code":"PHONE_DUPLICATE"}
   ```

5. **Rate Limiting (POST)**
   ```bash
   # Send 101 requests in 60 seconds
   for i in {1..101}; do curl -X POST ...; done
   # Expected: 101st request returns 429
   ```

---

## 📊 VERIFICATION CHECKLIST

### Before Deployment:
- [ ] index.ts restructured (respond() is simple helper)
- [ ] GET handler added (WhatsApp verification)
- [ ] Request parsing added (payload extraction)
- [ ] Signature verification added
- [ ] Error classification added (400 vs 500)
- [ ] Production bypass removed (no signature skip in prod)
- [ ] All tests pass locally
- [ ] No TypeScript errors
- [ ] No undefined variables

### After Deployment (Dev):
- [ ] GET verification works
- [ ] POST with valid signature works
- [ ] POST with invalid signature returns 401
- [ ] Duplicate phone returns 400 (not 500)
- [ ] Rate limiting enabled (logs confirm)
- [ ] No INSURANCE_AUTH_BYPASS in logs
- [ ] Response time < 2s (p95)

### After Deployment (Production):
- [ ] Monitor logs for 1 hour (no 500 errors)
- [ ] Signature bypass logs = 0
- [ ] USER_ERROR returns 400
- [ ] SYSTEM_ERROR returns 500
- [ ] Rate limiting working
- [ ] Insurance requests successful

---

## 🚀 DEPLOYMENT SEQUENCE

### Step 1: Deploy to Dev
```bash
# Deploy profile webhook
supabase functions deploy wa-webhook-profile --project-ref lhbowpbcpwoiparwnwgt

# Verify deployment
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-profile/health

# Test with simulator
# (Use WhatsApp webhook simulator or Postman)
```

### Step 2: Monitor Dev (30 min)
```bash
# Watch logs
supabase functions logs wa-webhook-profile --follow

# Check for errors
supabase functions logs wa-webhook-profile --limit 100 | grep -i "error\|500\|unauthorized"
```

### Step 3: Deploy to Production
```bash
# Only if dev tests pass!
supabase functions deploy wa-webhook-profile --project-ref lhbowpbcpwoiparwnwgt

# Monitor production
supabase functions logs wa-webhook-profile --follow
```

---

## 📈 SUCCESS METRICS

| Metric | Before | Target | How to Measure |
|--------|--------|--------|----------------|
| 500 Errors | 100% | < 1% | `logs \| grep "500" \| wc -l` |
| Signature Bypass (Prod) | Yes | 0 | `logs \| grep "AUTH_BYPASS"` |
| User Errors as 400 | 0% | 100% | `logs \| grep "PHONE_DUPLICATE.*400"` |
| Rate Limiting | Disabled | Enabled | `logs \| grep "rate_limit.*enabled"` |
| Response Time (p95) | 1334ms | < 1200ms | Check X-WA-Core-Latency header |

---

## 🔧 ROLLBACK PLAN

If deployment fails:

```bash
# 1. Rollback to previous version
git revert <commit_hash>
git push origin main

# 2. Redeploy old version
supabase functions deploy wa-webhook-profile

# 3. Verify old version working
curl .../wa-webhook-profile/health

# 4. Investigate logs
supabase functions logs wa-webhook-profile --limit 500 > rollback-logs.txt

# 5. Fix issues offline
# 6. Test locally
# 7. Redeploy
```

---

## 📝 NOTES

### Why This is Critical:
1. **Every profile webhook request is failing** due to broken code structure
2. **Production is bypassing security** (signature verification skipped)
3. **User errors return 500** instead of 400 (wrong error codes)
4. **No rate limiting** (vulnerable to abuse)

### What Was Wrong:
- `respond()` helper function contained ALL business logic (700+ lines)
- Variables used before definition (`from`, `messageId` undefined)
- No request parsing (payload never extracted)
- No GET handler (WhatsApp verification missing)
- No signature verification
- No error classification

### What We're Fixing:
- Proper request handling structure
- Request parsing and validation
- Signature verification
- Error classification (400 vs 500)
- Production security (no bypasses)
- Rate limiting already done (just needs deployment)

---

## 🎯 NEXT STEPS

1. ⬜ **YOU:** Review this plan (5 min)
2. ⬜ **ME:** Implement Phase 1 (fix structure)
3. ⬜ **ME:** Implement Phase 2 (error handling)
4. ⬜ **ME:** Implement Phase 3 (security)
5. ⬜ **ME:** Test locally (Phase 5)
6. ⬜ **YOU:** Approve for deployment
7. ⬜ **ME:** Deploy to dev
8. ⬜ **YOU:** Test in dev
9. ⬜ **ME:** Deploy to production
10. ⬜ **YOU:** Monitor production

---

**READY TO IMPLEMENT?** 
- All phases documented ✅
- Root causes identified ✅
- Fixes specified ✅
- Tests defined ✅
- Rollback plan ready ✅

**AUTHORIZATION REQUIRED:** Type "PROCEED" to start Phase 1 implementation.
