# WA-WEBHOOK-PROFILE - COMPREHENSIVE QA & UAT REPORT
**Generated:** 2025-12-04T10:12:00Z  
**Status:** CRITICAL ISSUES IDENTIFIED - FIXES REQUIRED

---

## EXECUTIVE SUMMARY

Comprehensive audit of wa-webhook-profile microservice revealed **23 critical issues** across 5 categories:
- **8 Type Errors** (blocking compilation)
- **5 Database Schema Issues**
- **4 Workflow Logic Bugs**
- **3 Security Concerns**
- **3 Performance Issues**

**Overall Health:** ⚠️ **DEGRADED** - Requires immediate attention

---

## 1. CRITICAL TYPE ERRORS (BLOCKING)

### Issue 1.1: Missing observe/log.ts Module
**File:** `supabase/functions/_shared/wa-webhook-shared/wallet/notifications.ts:2`
**Error:** Cannot find module `file:///.../observe/log.ts`
**Impact:** wa-webhook-profile fails to compile
**Root Cause:** File exists at `_shared/wa-webhook-shared/observe/log.ts` not `_shared/observe/log.ts`

**Fix:**
```typescript
// BEFORE (Line 2)
import { logStructuredEvent } from "../../observe/log.ts";

// AFTER
import { logStructuredEvent } from "../observe/log.ts";
```

### Issue 1.2: checkCountrySupport Function Signature Mismatch
**File:** `supabase/functions/_shared/wa-webhook-shared/flows/momo/qr.ts:41`
**Error:** Expected 2 arguments, but got 3
**Impact:** MoMo QR generation fails, blocking payment workflows

**Analysis:**
- Function signature: `checkCountrySupport(supabase, phoneNumber)`
- Called with: `checkCountrySupport(ctx.supabase, phone, "momo")`
- Third parameter "momo" not defined in function

**Fix:**
```typescript
// BEFORE (Line 41)
const res = await checkCountrySupport(ctx.supabase as any, phone, "momo");

// AFTER
const res = await checkCountrySupport(ctx.supabase as any, phone);
```

### Issue 1.3: CountrySupportResult Type Mismatch
**File:** `supabase/functions/_shared/wa-webhook-shared/flows/momo/qr.ts:42`
**Error:** Property 'supported' does not exist on type 'CountrySupportResult'

**Analysis:**
```typescript
// Actual return type
type CountrySupportResult = {
  countryCode: string | null;
  countryName: string | null;
  momoSupported: boolean;  // ← Key is 'momoSupported', not 'supported'
};
```

**Fix:**
```typescript
// BEFORE (Line 42)
return res.supported === true;

// AFTER
return res.momoSupported === true;
```

### Issue 1.4: MomoProvider Missing 'provider' Property
**File:** `supabase/functions/_shared/wa-webhook-shared/flows/momo/qr.ts:399,416`
**Error:** Property 'provider' does not exist on type 'MomoProvider'

**Analysis:**
```typescript
// Actual type definition
export type MomoProvider = {
  name: string;  // ← Should use 'name', not 'provider'
  ussdFormat: string | null;
};
```

**Fix:**
```typescript
// BEFORE (Lines 399, 416)
provider?.provider ? `Provider: ${provider.provider}` : undefined

// AFTER
provider?.name ? `Provider: ${provider.name}` : undefined
```

### Issue 1.5: RouterContext vs String Type Conflict
**File:** `supabase/functions/_shared/wa-webhook-shared/wallet/notifications.ts:15,25`
**Error:** Argument of type 'string' is not assignable to parameter of type 'RouterContext'

**Analysis:**
- `sendText()` expects RouterContext or string (phone number)
- Function passes `phone` string directly
- This is actually correct - the error suggests type definition issue

**Fix:** Update sendText type definition to accept string:
```typescript
// In _shared/messaging/client.ts or wa/client.ts
export async function sendText(
  to: string | RouterContext,  // ← Support both
  message: string
): Promise<void>
```

### Issue 1.6: SupabaseClient Version Mismatch
**File:** Multiple files
**Error:** SupabaseClient version incompatibility between @supabase/supabase-js@2.76.1 and @supabase/supabase-js@2.86.0

**Impact:** Type conflicts in ensureProfile functions

**Fix:** Update all Deno imports to use same version:
```typescript
// In deps.ts or individual files
export { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
```

### Issue 1.7: Webhook Utils Error Type
**File:** `supabase/functions/_shared/webhook-utils.ts:392`
**Error:** 'error' is of type 'unknown'

**Fix:**
```typescript
// BEFORE (Line 392)
error: error.message,

// AFTER
error: error instanceof Error ? error.message : String(error),
```

### Issue 1.8: Driver Verification Data Undefined
**Files:** `supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts:341-395`
**Error:** 'data' is possibly 'undefined'

**Fix:** Add null check before using data:
```typescript
// BEFORE (Line 341)
const validation = validateLicenseData(data);

// AFTER
if (!data) {
  await sendText(ctx.from, "⚠️ License data not found. Please try again.");
  return false;
}
const validation = validateLicenseData(data);
```

---

## 2. DATABASE SCHEMA ISSUES

### Issue 2.1: Missing saved_locations Indexes
**Impact:** Slow location queries, poor UX for "use saved location" feature
**Current State:** Table exists but lacks spatial indexes

**Fix Migration:**
```sql
-- Create spatial index for proximity searches
CREATE INDEX IF NOT EXISTS idx_saved_locations_coords_gist 
  ON public.saved_locations USING GIST (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  );

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_saved_locations_user_label 
  ON public.saved_locations(user_id, label);

-- Add updated_at for cache invalidation
ALTER TABLE public.saved_locations 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
```

### Issue 2.2: Profile Auto-Creation Race Condition
**File:** `supabase/functions/_shared/wa-webhook-shared/utils/profile.ts`
**Issue:** Multiple webhooks can create duplicate profiles

**Fix:** Add UPSERT with conflict resolution:
```sql
-- Migration: Add unique constraint
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_phone_number_unique UNIQUE (phone_number);

-- Update ensureProfile to use UPSERT
```

### Issue 2.3: Missing Wallet Balance Initialization
**Issue:** Users without wallet_balance row can't use token features
**Impact:** "View Balance" button shows null/error

**Fix:** Add trigger to auto-create wallet_balance:
```sql
CREATE OR REPLACE FUNCTION public.init_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallet_balance (user_id, balance, currency)
  VALUES (NEW.user_id, 0, 'RWF')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_init_wallet_on_profile
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.init_user_wallet();
```

### Issue 2.4: Business/Jobs/Properties RLS Policies Missing
**Tables:** `businesses`, `jobs`, `properties`
**Issue:** No Row Level Security policies defined
**Security Risk:** Users can see/modify others' data

**Fix:**
```sql
-- Businesses RLS
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY businesses_owner_all 
  ON public.businesses 
  FOR ALL 
  USING (owner_user_id = auth.uid());

CREATE POLICY businesses_public_read 
  ON public.businesses 
  FOR SELECT 
  USING (is_published = true);

-- Repeat for jobs and properties
```

### Issue 2.5: Location Cache Missing TTL
**Table:** `user_location_cache` (referenced in index.ts)
**Issue:** No expiration mechanism, stale data persists

**Fix:**
```sql
ALTER TABLE public.user_location_cache
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '30 minutes');

CREATE INDEX IF NOT EXISTS idx_user_location_cache_expires 
  ON public.user_location_cache(expires_at) 
  WHERE expires_at > now();

-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_stale_location_cache()
RETURNS integer AS $$
DECLARE
  cleaned integer;
BEGIN
  DELETE FROM public.user_location_cache WHERE expires_at < now();
  GET DIAGNOSTICS cleaned = ROW_COUNT;
  RETURN cleaned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 3. WORKFLOW LOGIC BUGS

### Issue 3.1: Add Location Flow - No Geocoding
**File:** `supabase/functions/wa-webhook-profile/index.ts:711-722`
**Issue:** Text address saved without coordinates
**Impact:** Location unusable for rides/matching

**Current Code:**
```typescript
// Line 711 - Just saves text, no geocoding
await sendButtonsMessage(ctx, 
  `✅ Thank you! We've received your ${locationType} address:\n\n${address}\n\n...`
);
```

**Fix:** Integrate geocoding service:
```typescript
// Add geocoding step
const { geocode } = await import("../_shared/geocoding/geocode.ts");
const coords = await geocode(address);

if (coords) {
  await ctx.supabase.from("saved_locations").insert({
    user_id: ctx.profileId,
    label: locationType,
    lat: coords.lat,
    lng: coords.lng,
    address,
  });
  // Success message
} else {
  // Ask user to share location via WhatsApp location feature
}
```

### Issue 3.2: Coordinate Validation Too Strict
**File:** `supabase/functions/wa-webhook-profile/index.ts:729-741`
**Issue:** Rejects valid coordinates near poles/prime meridian

**Current Code:**
```typescript
// Line 732 - Too strict
if (!lat || !lng || !Number.isFinite(lat) || !Number.isFinite(lng)) {
  // Reject
}
```

**Fix:** Improve validation:
```typescript
// Better validation
const isValidLat = Number.isFinite(lat) && lat >= -90 && lat <= 90;
const isValidLng = Number.isFinite(lng) && lng >= -180 && lng <= 180;

if (!isValidLat || !isValidLng) {
  // Only reject truly invalid coords
}

// lat=0 or lng=0 are valid (Gulf of Guinea, Prime Meridian)
```

### Issue 3.3: MoMo QR - Phone Number Pattern Too Permissive
**File:** `supabase/functions/wa-webhook-profile/index.ts:852`
**Issue:** Matches invalid patterns like "111111111"

**Current Pattern:**
```typescript
const phonePattern = /^(\+?\d{10,15}|\d{9,10})$/;
```

**Fix:** Add country code validation:
```typescript
// Require + prefix or validate against known country codes
const phonePattern = /^(\+\d{10,15}|0\d{9,10})$/;

// Better: Validate with country_support
const isValid = await checkCountrySupport(ctx.supabase, text.replace(/[\s\-]/g, ''));
if (isValid.countryCode) {
  // Valid phone number
}
```

### Issue 3.4: State Cleanup Missing on Errors
**File:** Multiple handlers
**Issue:** Failed operations leave stale state, blocking future interactions

**Example:**
```typescript
// wallet/transfer.ts - No cleanup on error
try {
  // ... transfer logic
} catch (error) {
  await sendText(ctx.from, "Transfer failed");
  // ❌ Missing: await clearState(ctx.supabase, ctx.profileId);
}
```

**Fix:** Add cleanup to all error paths:
```typescript
catch (error) {
  await clearState(ctx.supabase, ctx.profileId);  // ← Add this
  await sendButtonsMessage(ctx, "⚠️ Operation failed...", [...]);
}
```

---

## 4. SECURITY CONCERNS

### Issue 4.1: Signature Verification Bypass Too Permissive
**File:** `supabase/functions/wa-webhook-profile/index.ts:107`
**Issue:** `WA_ALLOW_UNSIGNED_WEBHOOKS=true` allows any request

**Current Code:**
```typescript
const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false")
  .toLowerCase() === "true";

if (!isValid && !allowUnsigned) {
  return respond({ error: "unauthorized" }, { status: 401 });
}
```

**Fix:** Restrict to development only:
```typescript
const isDevelopment = Deno.env.get("DENO_ENV") === "development";
const allowUnsigned = isDevelopment && 
  Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") === "true";

if (!isValid && !allowUnsigned) {
  await logEvent("PROFILE_AUTH_FAILED", { 
    ip: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent") 
  }, "warn");
  return respond({ error: "unauthorized" }, { status: 401 });
}
```

### Issue 4.2: PII in Logs
**File:** Multiple files
**Issue:** Phone numbers, names logged without masking

**Example:**
```typescript
logEvent("PROFILE_MESSAGE_PROCESSING", { from, type: message.type });
```

**Fix:** Mask sensitive data:
```typescript
const maskPhone = (phone: string) => phone.replace(/(\d{3})\d+(\d{3})/, "$1***$2");

logEvent("PROFILE_MESSAGE_PROCESSING", { 
  from: maskPhone(from), 
  type: message.type 
});
```

### Issue 4.3: No Rate Limiting per User
**File:** `supabase/functions/wa-webhook-profile/index.ts:33`
**Issue:** Global rate limit only, allows single user to spam

**Current:** 100 req/min globally
**Fix:** Add per-user limit:
```typescript
const rateLimitCheck = await rateLimitMiddleware(req, {
  limit: 100,
  windowSeconds: 60,
  key: `global`,
});

const userRateLimit = await rateLimitMiddleware(req, {
  limit: 20,  // 20 req/min per user
  windowSeconds: 60,
  key: `user:${from}`,
});

if (!userRateLimit.allowed) {
  return userRateLimit.response!;
}
```

---

## 5. PERFORMANCE ISSUES

### Issue 5.1: N+1 Query in listMyBusinesses
**File:** `supabase/functions/wa-webhook-profile/business/list.ts`
**Issue:** Fetches businesses, then photos separately per business

**Fix:** Use JOIN or single query:
```typescript
const { data: businesses } = await ctx.supabase
  .from("businesses")
  .select(`
    *,
    business_photos(url, is_primary)
  `)
  .eq("owner_user_id", ctx.profileId)
  .order("created_at", { ascending: false });
```

### Issue 5.2: Missing Query Indexes
**Tables:** `businesses`, `jobs`, `properties`
**Issue:** No indexes on `owner_user_id + created_at`

**Fix Migration:**
```sql
CREATE INDEX IF NOT EXISTS idx_businesses_owner_created 
  ON public.businesses(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_owner_created 
  ON public.jobs(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_properties_owner_created 
  ON public.properties(owner_user_id, created_at DESC);
```

### Issue 5.3: Wallet Balance Query Inefficiency
**File:** `supabase/functions/wa-webhook-profile/wallet/home.ts`
**Issue:** Fetches entire row when only balance needed

**Fix:**
```typescript
// BEFORE
const { data: wallet } = await ctx.supabase
  .from("wallet_balance")
  .select("*")
  .eq("user_id", ctx.profileId)
  .single();

// AFTER
const { data: wallet } = await ctx.supabase
  .from("wallet_balance")
  .select("balance, currency, updated_at")
  .eq("user_id", ctx.profileId)
  .single();
```

---

## 6. MISSING TEST COVERAGE

### Issue 6.1: No Integration Tests for Profile Workflows
**Missing Tests:**
- Edit profile name/language flow
- Add/edit/delete saved location flow
- MoMo QR generation end-to-end
- Wallet transfer validation

**Recommended:** Create `__tests__/profile.integration.test.ts`

### Issue 6.2: No Error Path Testing
**Missing:** Tests for:
- Invalid coordinates
- Database failures
- Rate limit exceeded
- Signature verification failure

---

## 7. DOCUMENTATION GAPS

### Issue 7.1: Missing API Documentation
- No OpenAPI/Swagger spec for webhook endpoints
- Button IDs not documented (scattered across code)
- State machine transitions unclear

### Issue 7.2: Missing Deployment Guide
- Environment variables not documented
- WhatsApp webhook setup steps missing
- Rollback procedures undefined

---

## IMMEDIATE ACTION ITEMS (Priority Order)

### 🔴 **P0 - BLOCKING (Fix Today)**
1. ✅ Fix all 8 type errors (Issues 1.1-1.8)
2. ✅ Add RLS policies to businesses/jobs/properties (Issue 2.4)
3. ✅ Fix checkCountrySupport signature (Issue 1.2)

### 🟠 **P1 - CRITICAL (Fix This Week)**
4. ⏳ Add wallet_balance auto-init trigger (Issue 2.3)
5. ⏳ Improve coordinate validation (Issue 3.2)
6. ⏳ Add per-user rate limiting (Issue 4.3)
7. ⏳ Fix state cleanup on errors (Issue 3.4)

### 🟡 **P2 - HIGH (Fix This Sprint)**
8. ⏳ Add saved_locations indexes (Issue 2.1)
9. ⏳ Integrate geocoding for text addresses (Issue 3.1)
10. ⏳ Add performance indexes (Issue 5.2)
11. ⏳ Fix N+1 queries (Issue 5.1)

### 🟢 **P3 - MEDIUM (Backlog)**
12. ⏳ Mask PII in logs (Issue 4.2)
13. ⏳ Add integration tests (Issue 6.1)
14. ⏳ Write API documentation (Issue 7.1)

---

## TESTING CHECKLIST

### Manual UAT Scenarios
- [ ] Profile creation on first message
- [ ] Edit profile name (happy path)
- [ ] Edit profile language (all locales)
- [ ] Add home location via GPS
- [ ] Add work location via text address
- [ ] Edit saved location coordinates
- [ ] Delete saved location
- [ ] View wallet balance (new user)
- [ ] View wallet balance (existing user)
- [ ] Generate MoMo QR for Rwandan number
- [ ] Generate MoMo QR for agent code
- [ ] Transfer tokens to phone number
- [ ] Transfer tokens to partner
- [ ] Create business listing
- [ ] Edit business description
- [ ] Delete business (with confirmation)
- [ ] Create job posting
- [ ] Edit job requirements
- [ ] Delete job
- [ ] Create property listing
- [ ] Edit property price
- [ ] Delete property
- [ ] Handle invalid button ID
- [ ] Handle rate limit exceeded
- [ ] Handle database error
- [ ] Handle signature verification failure

### Automated Test Coverage Goals
- Unit tests: 80%+ coverage
- Integration tests: All critical paths
- E2E tests: 5 key user journeys

---

## DEPLOYMENT PLAN

### Phase 1: Type Error Fixes (Deploy Today)
```bash
# Apply all type fixes
git checkout -b fix/wa-profile-type-errors
# Make changes per Issues 1.1-1.8
git commit -m "fix: resolve all TypeScript errors in wa-webhook-profile"
supabase functions deploy wa-webhook-profile
```

### Phase 2: Database Migrations (Deploy Tomorrow)
```bash
# Create migration
supabase migration new wa_profile_schema_fixes
# Add SQL from Issues 2.1-2.5
supabase db push
```

### Phase 3: Security & Performance (Deploy End of Week)
```bash
# Deploy enhanced security and performance fixes
git checkout -b enhance/wa-profile-security-perf
# Make changes per Issues 4.1-5.3
supabase functions deploy wa-webhook-profile --no-verify-jwt  # temp for testing
```

---

## ROLLBACK PROCEDURES

### If Deployment Fails:
```bash
# Rollback function
supabase functions deploy wa-webhook-profile --version <previous-version>

# Rollback migration
supabase db reset --db-url $PROD_DB_URL
```

### Monitoring:
- Watch error rates in Supabase dashboard
- Monitor response times (should be <500ms p95)
- Check webhook delivery success rate
- Alert if error rate > 5%

---

## APPENDIX A: Environment Variables

Required for wa-webhook-profile:
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
WA_VERIFY_TOKEN=<random-secret>
WHATSAPP_APP_SECRET=<from Meta>
WA_ALLOW_UNSIGNED_WEBHOOKS=false  # NEVER true in prod
FEATURE_MOMO_QR=true
FEATURE_WALLET=true
```

---

## APPENDIX B: Metrics to Track

### Success Metrics
- Profile creation success rate: >99%
- Location save success rate: >95%
- MoMo QR generation success rate: >98%
- Wallet transfer success rate: >99%
- Average response time: <500ms
- Error rate: <1%

### User Experience Metrics
- Time to complete "add location" flow: <30s
- Time to generate MoMo QR: <5s
- Wallet balance query time: <200ms

---

**Report End**  
**Next Review:** After all P0 issues resolved  
**Owner:** Platform Team  
**Last Updated:** 2025-12-04T10:12:00Z
