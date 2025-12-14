# Phase 3: Reduce Log Noise - Analysis & Implementation Plan

**Date**: 2025-12-14 14:17 UTC  
**Status**: ANALYSIS COMPLETE - READY TO IMPLEMENT

---

## Executive Summary

Found **35 console.log calls** across 4 webhooks:
- **22** in wa-webhook-mobility (11 production, 11 test)
- **7** in wa-webhook-core (5 production, 2 test likely)
- **3** in wa-webhook-profile
- **1** in wa-webhook-buy-sell
- **2** console.debug/trace

**Analysis**: Most are already structured JSON logs or event markers. Only **11-15 production calls** need conversion.

---

## Findings by Webhook

### wa-webhook-mobility (22 calls)

#### ✅ Test Files (9 calls - KEEP)
- nearby.test.ts: 3 calls
- schedule.test.ts: 3 calls  
- mobility-uat.test.ts: 1 call
- trip-lifecycle.test.ts: 1 call

**Decision**: Keep test logging

---

#### 🔧 Production Code (11 calls - CONVERT)

**1. ai-agents/integration.ts (2 calls)**
```typescript
Line 199: console.log("FALLBACK: Attempting direct schedule trip creation");
Line 228: console.log("FALLBACK SUCCESS: Trip scheduled via direct DB insert");
```
**Action**: Convert to `logStructuredEvent("AI_FALLBACK_*", {...}, "info")`

---

**2. utils/middleware.ts (1 call)**
```typescript
Line 216: console.log(JSON.stringify({ ... }));
```
**Action**: Already structured - convert to `logStructuredEvent()`

---

**3. utils/metrics_collector.ts (3 calls)**
```typescript
Line 161: console.log(JSON.stringify({ ... }));
Line 175: console.log(JSON.stringify({ ... }));
Line 190: console.log(JSON.stringify({ ... }));
```
**Action**: Already structured - convert to `logStructuredEvent()` OR keep if pure metrics output

---

**4. utils/bar_numbers.ts (1 call)**
```typescript
Line 290: console.log("bar_numbers.auto_provision_success", { ... });
```
**Action**: Convert to `logStructuredEvent("BAR_AUTO_PROVISION", {...}, "info")`

---

**5. utils/config_validator.ts (1 call)**
```typescript
Line 195: console.log(JSON.stringify({ ... }));
```
**Action**: Convert to `logStructuredEvent()`

---

**6. flows/vendor/menu.ts (3 calls)**
```typescript
Line 188: console.log("vendor.menu.ocr_trigger_start");
Line 191: console.log("vendor.menu.ocr_trigger_processor_ok");
Line 192: console.log("vendor.menu.ocr_trigger_notifier_skipped");
```
**Action**: Convert to `logStructuredEvent("VENDOR_MENU_OCR_*", {...}, "info")`

---

### wa-webhook-core (7 calls)

**1. router.ts (2 calls)**
```typescript
Line 261: console.log(JSON.stringify({ ... }));
Line 695: console.log(JSON.stringify({ event: "MENU_SENT_SUCCESS", ... }));
```
**Action**: Convert to `logStructuredEvent()`

---

**2. telemetry.ts (2 calls)**
```typescript
Line 25: console.log(JSON.stringify({ ... }));
Line 49: console.log(JSON.stringify({ ... }));
```
**Action**: Convert to `logStructuredEvent()` OR keep if telemetry-specific

---

### wa-webhook-buy-sell (1 call)

**utils/index.ts (1 call)**
```typescript
Line 415: console.log(`[${level.toUpperCase()}] MARKETPLACE_${event}`, JSON.stringify(maskedDetails));
```
**Action**: Already has custom logger wrapper - verify uses `logStructuredEvent()` internally

---

### wa-webhook-profile (3 calls)

**Need to investigate** - likely similar patterns

---

## Strategy: Surgical Conversion (NOT Mass Deletion)

### ⚠️ Important Discovery
Most console.log calls are **already structured** and **contain valuable telemetry**. They're not "noise" - they're **proto-structured logs** that just need the right API.

### Goals:
1. ✅ Convert console.log → logStructuredEvent (preserve info)
2. ✅ Keep test logging (essential for debugging)
3. ✅ Keep metrics output (if not duplicated)
4. ❌ Don't delete valuable telemetry

---

## Implementation Plan

### Phase 3A: Convert Mobility Webhook (30 min)

**Files to update** (6 files):
1. ai-agents/integration.ts (2 calls)
2. utils/bar_numbers.ts (1 call)
3. flows/vendor/menu.ts (3 calls)
4. utils/middleware.ts (1 call)
5. utils/config_validator.ts (1 call)
6. utils/metrics_collector.ts (3 calls) - **REVIEW FIRST**

**Pattern**:
```typescript
// BEFORE
console.log("FALLBACK: Attempting direct schedule trip creation");
console.log(JSON.stringify({ event: "CONFIG_LOADED", ... }));

// AFTER
logStructuredEvent("AI_FALLBACK_ATTEMPT", { 
  action: "direct_schedule_trip",
  reason: "primary_method_failed"
}, "info");

logStructuredEvent("CONFIG_LOADED", { ... }, "info");
```

---

### Phase 3B: Convert Core Webhook (20 min)

**Files to update** (2 files):
1. router.ts (2 calls)
2. telemetry.ts (2 calls)

---

### Phase 3C: Review Profile & Buy-Sell (10 min)

Check if they already use proper logging or need conversion.

---

### Phase 3D: Verify Metrics Collector (15 min)

**Decision point**: 
- If metrics_collector.ts is outputting metrics to external system → KEEP console.log
- If it's just logging events → CONVERT to logStructuredEvent

---

### Phase 3E: Test & Validate (15 min)

1. Type check all webhooks
2. Search for remaining console.log (excluding tests)
3. Deploy to staging
4. Verify logs still appear in Sentry/PostHog

---

## Conversion Script Template

```typescript
// Add import at top
import { logStructuredEvent } from "../../_shared/observability.ts";

// Pattern 1: Simple message
console.log("FALLBACK: Attempting X");
→ logStructuredEvent("FALLBACK_ATTEMPT", { action: "X" }, "info");

// Pattern 2: Already structured JSON
console.log(JSON.stringify({ event: "FOO", ...data }));
→ logStructuredEvent("FOO", { ...data }, "info");

// Pattern 3: Event + data
console.log("event.name", { data });
→ logStructuredEvent("EVENT_NAME", { data }, "info");
```

---

## Expected Results

### Before Phase 3
- 35 console.log calls
- 16 production calls (mobility + core + profile + buy-sell)
- Mixed logging styles
- Some structured, some not

### After Phase 3
- 0 console.log in production code
- 9 console.log in test files (kept)
- All logging via logStructuredEvent()
- Consistent format everywhere
- Same information, better structure

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Lost telemetry | LOW | HIGH | Review each call, preserve data |
| Breaking changes | LOW | MEDIUM | Type checks will catch |
| Metrics disruption | MEDIUM | HIGH | Review metrics_collector.ts carefully |
| Over-logging | LOW | LOW | Most are already appropriate |

---

## Success Metrics

- ✅ 0 console.log in production code (excluding tests)
- ✅ All telemetry preserved
- ✅ Consistent logStructuredEvent() usage
- ✅ Type checks passing
- ✅ Logs visible in Sentry/PostHog
- ✅ No metrics disruption

---

## Timeline

```
Phase 3A: Convert Mobility (30 min)
Phase 3B: Convert Core (20 min)
Phase 3C: Review Profile & Buy-Sell (10 min)
Phase 3D: Verify Metrics (15 min)
Phase 3E: Test & Validate (15 min)
```

**Total**: ~90 minutes (vs 1 day estimate)

---

## Important Notes

1. **This is NOT a deletion exercise** - it's a conversion to structured logging
2. **Preserve all telemetry** - these logs contain valuable business/technical events
3. **Test files are exempt** - console.log is fine for tests
4. **Metrics output may be intentional** - review before converting
5. **Focus on consistency** - use logStructuredEvent() everywhere

---

## Next Steps

1. ✅ Analysis complete
2. ⏳ Start Phase 3A - Convert mobility webhook
3. ⏳ Start Phase 3B - Convert core webhook
4. ⏳ Review remaining webhooks
5. ⏳ Test & deploy

---

**Status**: Ready to implement  
**Time**: 2025-12-14 14:17 UTC
