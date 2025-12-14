# Phase 2: Consolidate Logging - Analysis & Plan

**Date**: 2025-12-14 13:08 UTC  
**Status**: ANALYSIS IN PROGRESS

---

## Current State Analysis

### Logging Implementations Found (7 files)

#### 1. `_shared/observability/logger.ts` (388 lines) ⭐ BEST
**Features**:
- ✅ Sentry integration (@sentry/deno)
- ✅ PII scrubbing (emails, phones, UUIDs)
- ✅ Structured JSON logging
- ✅ PostHog integration (likely)
- ✅ Error tracking
- ✅ Most comprehensive

**Decision**: **WINNER** - Use as unified logging system

---

#### 2. `_shared/observability.ts` (unknown size)
**Status**: Need to check if this exports from logger.ts or is separate

---

#### 3. `wa-webhook-mobility/observe/logger.ts` (28 lines)
**Features**:
- ❌ Basic - just console.log wrapper
- ❌ No PII scrubbing
- ❌ No Sentry integration
- ❌ Simple event logging only

**Decision**: DELETE (inferior to _shared version)

---

#### 4. `wa-webhook-mobility/observe/log.ts` (197 lines)
**Features**:
- Partial Sentry integration
- Some PII scrubbing
- Structured logging

**Decision**: DELETE (superseded by _shared/observability/logger.ts)

---

#### 5. `wa-webhook-mobility/observe/logging.ts` (21 lines)
**Features**:
- Very basic
- Console wrapper only

**Decision**: DELETE

---

#### 6. `_shared/wa-webhook-shared/observe/log.ts`
**Status**: Need to check

---

#### 7. `_shared/wa-webhook-shared/observe/logging.ts`
**Status**: Need to check

---

#### 8. `_shared/wa-webhook-packages/observability/src/logging.ts`
**Status**: Need to check if this is a package or duplicate

---

## Webhook Functions to Migrate (8+ functions)

### Core Webhooks:
1. **wa-webhook-profile** - Profile management
2. **wa-webhook-mobility** - Ride booking (partially done)
3. **wa-webhook-core** - Core routing
4. **wa-webhook-buy-sell** - Marketplace (already migrated?)
5. **wa-webhook-voice-calls** - Voice integration

### Supporting Functions:
6. **notify-buyers** - Buyer notifications (already migrated?)
7. **wa-agent-support** - Support agent
8. **simulator** - Testing simulator

### Admin Functions:
9. **admin-api** - Admin endpoints
10. **admin-***  - Various admin functions

---

## Unified API Design

### Target API (already in _shared/observability/logger.ts):

```typescript
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";

// Structured event logging
await logStructuredEvent("USER_CREATED", {
  userId,
  method: "whatsapp",
  correlationId,
}, "info");

// Metric recording
await recordMetric("user.created", 1, {
  source: "whatsapp",
});

// Error tracking
await logStructuredEvent("PROCESSING_ERROR", {
  error: error.message,
  from: maskPhone(from),
}, "error");
```

---

## Migration Strategy

### Phase 2A: Verify Winner (Day 1 Morning)
**Tasks**:
1. ✅ Confirm _shared/observability/logger.ts is most complete
2. Check _shared/observability.ts exports
3. Verify all functions available
4. Check for any missing features in other implementations

**Time**: 1 hour

---

### Phase 2B: Delete Duplicate Logging Files (Day 1 Afternoon)
**Tasks**:
1. Delete wa-webhook-mobility/observe/logger.ts (28 lines)
2. Delete wa-webhook-mobility/observe/logging.ts (21 lines)
3. Keep wa-webhook-mobility/observe/log.ts temporarily (197 lines) - verify in use
4. Check and delete wa-webhook-shared duplicates

**Time**: 1 hour

---

### Phase 2C: Update All Webhooks - Batch 1 (Day 1-2)
**Functions** (3 functions):
1. wa-webhook-profile
2. wa-webhook-core  
3. wa-webhook-voice-calls

**Pattern**:
```typescript
// BEFORE (various styles)
import { logEvent } from "../observe/logger.ts";
import { log } from "../observe/log.ts";
console.log("Event:", data);

// AFTER (unified)
import { logStructuredEvent } from "../_shared/observability.ts";
logStructuredEvent("EVENT_NAME", { data }, "info");
```

**Time**: 4-6 hours

---

### Phase 2D: Update All Webhooks - Batch 2 (Day 2-3)
**Functions** (5 functions):
1. wa-agent-support
2. simulator
3. admin-api
4. admin-* functions
5. Any remaining

**Time**: 4-6 hours

---

### Phase 2E: Remove Old Logging Systems (Day 3)
**Tasks**:
1. Delete all observe/log*.ts files (after migration complete)
2. Delete backup files
3. Verify no imports remain
4. Run type checks

**Time**: 2 hours

---

### Phase 2F: Test & Deploy (Day 3)
**Tasks**:
1. Type check all webhooks
2. Deploy to staging
3. Smoke test logging
4. Monitor Sentry/PostHog
5. Deploy to production

**Time**: 2-3 hours

---

## Import Mappings

| Old Import | New Import |
|------------|------------|
| `from "../observe/logger.ts"` | `from "../_shared/observability.ts"` |
| `from "../observe/log.ts"` | `from "../_shared/observability.ts"` |
| `from "../observe/logging.ts"` | `from "../_shared/observability.ts"` |
| `from "./observe/log.ts"` | `from "../_shared/observability.ts"` |

| Old Function | New Function |
|--------------|--------------|
| `logEvent(...)` | `logStructuredEvent(...)` |
| `log.info(...)` | `logStructuredEvent(..., "info")` |
| `log.error(...)` | `logStructuredEvent(..., "error")` |
| `console.log(...)` | `logStructuredEvent(...)` |

---

## Success Metrics

### Before Phase 2
- ❌ 7+ different logging files
- ❌ 3 different logging implementations
- ❌ Inconsistent log formats
- ❌ No unified PII scrubbing
- ❌ Partial Sentry integration

### After Phase 2
- ✅ 1 unified logging system
- ✅ All webhooks use same API
- ✅ Consistent structured logs
- ✅ Universal PII scrubbing
- ✅ Complete Sentry integration
- ✅ Metrics tracking enabled

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Missing log calls | MEDIUM | Low | Grep for all logging patterns |
| Different log APIs | HIGH | Medium | Map all function signatures |
| Production log loss | LOW | High | Test extensively, deploy gradually |
| Breaking changes | LOW | Medium | TypeScript will catch |

---

## Timeline

```
Day 1 (Today):
  Morning:   Phase 2A - Verify winner (1hr)
  Afternoon: Phase 2B - Delete duplicates (1hr)
  Evening:   Phase 2C - Batch 1 start (3hrs)

Day 2 (Tomorrow):
  Morning:   Phase 2C - Batch 1 complete (3hrs)
  Afternoon: Phase 2D - Batch 2 start (4hrs)

Day 3 (Day After):
  Morning:   Phase 2D - Batch 2 complete (2hrs)
  Afternoon: Phase 2E - Cleanup (2hrs)
  Evening:   Phase 2F - Test & deploy (3hrs)
```

**Total**: ~21 hours over 3 days

---

## Next Steps

1. **Verify** `_shared/observability.ts` exports
2. **Check** if any unique features in other logging files
3. **Create** comprehensive import mapping
4. **Start** Phase 2B deletion

---

**Status**: Analysis Complete - Ready for Phase 2A Verification

**Time**: 2025-12-14 13:08 UTC
