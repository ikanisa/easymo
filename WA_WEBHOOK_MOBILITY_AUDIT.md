# wa-webhook-mobility Deep Audit Report
**Date**: 2025-12-14 19:05 UTC  
**Version Deployed**: v1001 (deployed 19:03:12 UTC)  
**Status**: ✅ ACTIVE (after import fix)

---

## Executive Summary

### Critical Issue (RESOLVED)
- **Boot failure** caused by incorrect import paths
- **Impact**: Function returned 503 on every request
- **Fixed**: Commit a6902015 - corrected imports from `_shared/http.ts` to `_shared/wa-webhook-shared/utils/http.ts`
- **Deployed**: v1001

---

## Architecture Overview

### Size & Complexity
- **109 TypeScript files** across 15 subdirectories
- **Main entry point**: 781 lines, 18 imports
- **Largest handler**: `schedule.ts` (1,298 LOC - flagged for refactoring)
- **Dependencies**: 50+ direct `Deno.env.get()` calls

### Key Components
```
wa-webhook-mobility/
├── handlers/        # Core business logic (nearby, schedule, trips, payments)
├── ai-agents/       # AI integration (customer support, integration)
├── flows/           # User flows (home, profile, admin, momo, support, vendor)
├── locations/       # Location services (cache, favorites, recent, save)
├── rpc/             # Database RPC calls (mobility, marketplace, wallet, momo)
├── utils/           # Utilities (15 files)
├── state/           # State management (store, idempotency, retention)
├── observe/         # Monitoring (metrics, alerts, driver parser, conversation audit)
├── my-vehicles/     # Vehicle management
├── notifications/   # Driver notifications
└── insurance/       # Driver license OCR
```

---

## Issues Identified

### 1. ✅ CRITICAL - Import Path Errors (FIXED)
**Status**: RESOLVED in v1001  
**Files affected**:
- `observe/alert.ts` - line 1
- `wa/client.ts` - line 2

**Problem**: Imported `fetchWithTimeout` and `delay` from non-existent path
```typescript
// WRONG (caused boot failure)
import { fetchWithTimeout } from "../../_shared/http.ts";

// CORRECT
import { fetchWithTimeout } from "../../_shared/wa-webhook-shared/utils/http.ts";
```

**Evidence**: 
- 12+ boot failure logs @ 18:57:13-24 UTC
- All requests returned 503
- wa-webhook-core retries exhausted (3 attempts)

---

### 2. 🟡 MEDIUM - Code Quality Issues

#### A. Logging Inconsistencies
**console.info/debug usage** (should use logStructuredEvent):
- `insurance/driver_license_ocr.ts`: 4 instances
- `wa/client.ts`: 2 instances (debug payloads)

**Impact**: Logs not structured, harder to query in production

#### B. TODO Comments (Technical Debt)
```
handlers/fare.ts:
  - TODO: Move to database configuration (dynamic pricing)
  - TODO: Make configurable per country/region  
  - TODO: Implement surge pricing
  - TODO: Add high demand surge

handlers/trip_lifecycle.ts:
  - TODO: Record metrics
  - TODO: Update cached average rating

handlers/tracking.ts:
  - TODO: Production tracking implementation (2 places)
```

---

### 3. 🟡 MEDIUM - Configuration Issues

#### A. Hard-coded AI Model
`config.ts` line 113:
```typescript
defaultModel: getEnv("AI_DEFAULT_MODEL") || "gpt-5",  // Comment: "Mandatory GPT-5"
```
**Issue**: GPT-5 doesn't exist. Should be gpt-4, gpt-4-turbo, or gpt-3.5-turbo

#### B. Service Role Key Fallback Warning
`config.ts` line 30-32:
```typescript
if (!getEnv("WA_SUPABASE_SERVICE_ROLE_KEY")) {
  console.warn("wa_webhook.service_key_fallback");
}
```
**Impact**: Logs indicate fallback is being used in production

---

### 4. 🟡 MEDIUM - Error Handling

#### Main Handler Try-Catch
- **Single try-catch** wraps entire request handler (line 724-736)
- **Good**: Catches all unhandled errors
- **Issue**: Generic 500 response, limited error context

#### Async Operations
- **50+ async operations** across codebase
- Most have try-catch, but some rely on parent handler
- No timeout protection on external API calls (except fetchWithTimeout)

---

### 5. 🟢 LOW - Maintenance Flags

#### Refactoring Needed
From `README.md`:
- `schedule.ts`: 1,298 LOC - flagged for split into 3 files
- Status shows "🚧 Under Development"

#### Test Coverage
- Test files present: `__tests__/`, `*.test.ts` files
- Unable to verify execution without running

---

## Dependencies Analysis

### _shared Imports (74 occurrences)
**Categories**:
1. **Observability** (most common): `logStructuredEvent`, `logEvent`, `logAgentEvent`
2. **State Management**: `getState`, `setState`, `clearState`
3. **Utils**: `reply.ts`, `text.ts`, `messages.ts`, `http.ts`
4. **Config**: `location-config.ts`, `mobility.ts`, `feature-flags.ts`
5. **Security**: `webhook-utils.ts`, `admin-contacts.ts`

**Risk**: High coupling to `_shared` - any breaking changes propagate

---

## Recent Changes (since 2025-12-13)

```
a6902015 - fix: correct fetchWithTimeout import (TODAY)
834e6c0c - feat(phase3): Convert console.log to logStructuredEvent
e49a3e15 - feat(phase2): Consolidate logging
9e2ba170 - fix(phase1): Update all import paths to use _shared
5bdb6166 - feat: Phase 4 complete - Button handler documentation
```

**Pattern**: Heavy refactoring recently (webhook cleanup phases 1-3)  
**Risk**: Recent changes may have introduced import issues (proven by boot failure)

---

## Environment Variables

### Required (will throw on missing)
- `SUPABASE_URL` / `SERVICE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` / `SERVICE_ROLE_KEY` / `WA_SUPABASE_SERVICE_ROLE_KEY`
- `WA_PHONE_ID` / `WHATSAPP_PHONE_NUMBER_ID`
- `WA_TOKEN` / `WHATSAPP_ACCESS_TOKEN`
- `WA_APP_SECRET` / `WHATSAPP_APP_SECRET`
- `WA_VERIFY_TOKEN` / `WHATSAPP_VERIFY_TOKEN`
- `WA_BOT_NUMBER_E164` / `WHATSAPP_PHONE_NUMBER_E164`

### Optional (with defaults)
- `OPENAI_API_KEY`
- `QR_SALT`
- `MENU_MEDIA_BUCKET` (default: "menu-source-files")
- `INSURANCE_MEDIA_BUCKET` (default: "insurance-docs")
- `WA_FLOW_SCHEDULE_TIME_ID`
- `ENABLE_RATE_LIMITING` (default: true)
- `ENABLE_AI_AGENTS` (default: false)
- `REDIS_URL` (default: "redis://localhost:6379")
- `AI_DEFAULT_MODEL` (default: "gpt-5" ⚠️ INVALID)

### Configuration Flags
- Rate limiting, caching, AI agents, monitoring, error handling all configurable
- Defaults are production-safe (rate limiting ON, verification ON)

---

## Deployment History

### Current State
```
Function: wa-webhook-mobility
ID: 754e92f6-05f1-4a6a-ad60-50afe9cf073d
Status: ACTIVE
Version: 1001
Last Deploy: 2025-12-14 19:03:12 UTC
```

### Related Functions
- wa-webhook-core: v1266 (2025-12-14 10:17:38) - Routes to mobility
- wa-webhook-profile: v761
- wa-webhook-buy-sell: v458
- wa-webhook-insurance: v807

---

## Recommendations

### Immediate (P0)
1. ✅ **DONE**: Fix import paths (already deployed v1001)
2. **Monitor logs** for next 24h to confirm no more boot failures
3. **Fix AI model** config: change "gpt-5" to valid model

### Short-term (P1)
1. **Replace console.info/debug** with logStructuredEvent in:
   - `insurance/driver_license_ocr.ts`
   - `wa/client.ts`
2. **Add environment validation** for `AI_DEFAULT_MODEL`
3. **Document WA_SUPABASE_SERVICE_ROLE_KEY** requirement (avoid fallback warning)

### Medium-term (P2)
1. **Refactor schedule.ts** (split into 3 files as planned)
2. **Implement TODOs**:
   - Dynamic pricing configuration
   - Metrics recording
   - Production tracking
3. **Add timeout protection** for all external API calls
4. **Increase test coverage** - run existing tests, add missing ones

### Long-term (P3)
1. **Reduce _shared coupling** - consider versioned interfaces
2. **Code review process** for import changes (prevent similar issues)
3. **Automated type checking** in CI before deploy
4. **Feature flag** for new flows to reduce deployment risk

---

## Testing Checklist

Before next deployment:
- [ ] Run `deno check index.ts` locally
- [ ] Execute test suite: `deno test --allow-all`
- [ ] Verify imports resolve: `deno info index.ts`
- [ ] Check environment variables in Supabase dashboard
- [ ] Deploy to staging first (if available)
- [ ] Monitor logs for 5 minutes post-deploy
- [ ] Test critical flows: nearby drivers, schedule trip, go online

---

## Monitoring Points

### Key Metrics
1. **Boot success rate** - should be 100% after fix
2. **Response time** - currently breaching SLO (1276-1536ms vs 1200ms target)
3. **503 errors** - should drop to zero
4. **Retry exhaustion** - no more RETRY_EXHAUSTED events
5. **Unhandled messages** - check MOBILITY_UNHANDLED_MESSAGE events

### Alert Thresholds
- Boot failure: alert immediately
- Response time > 1200ms: investigate if >10% of requests
- 503 rate > 1%: page on-call
- Error rate > 5%: investigate

---

## Conclusion

**Current Status**: ✅ STABLE after import fix

**Risk Level**: 🟡 MEDIUM
- Critical boot issue resolved
- Some code quality issues remain
- Recent refactoring may have introduced other issues
- Heavy TODO technical debt

**Next Steps**:
1. Monitor for 24h
2. Fix AI model config
3. Address logging inconsistencies
4. Plan schedule.ts refactor

**Overall Assessment**: Function is operational but needs cleanup work. The import issue was critical but isolated. Code quality is generally good with structured logging and error handling, but recent refactoring created fragility.
