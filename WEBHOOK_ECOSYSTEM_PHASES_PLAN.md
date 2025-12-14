# Webhook Ecosystem Phases - Implementation Plan

**Date**: 2025-12-14  
**Scope**: All WhatsApp webhook functions  
**Duration**: 4 weeks (with buffer)  
**Status**: STARTING

---

## Overview

After completing buy-sell specific refactoring (Phases 1-2), we're now tackling the broader webhook ecosystem improvements covering:
- wa-webhook-profile
- wa-webhook-mobility
- wa-webhook-core
- notify-buyers
- And 4 other webhook functions

---

## Phase 1: Deduplicate Files (Days 1-2) 🔴 HIGH PRIORITY

### Goal
Remove duplicate utility files across webhooks, establish single source of truth

### Current State
- 35 duplicate files in `wa-webhook-mobility/utils/`
- Multiple copies of observability code
- Inconsistent versions causing bugs

### Tasks

#### Day 1: Delete Duplicates
```bash
# Remove local copies (keep _shared versions)
rm -rf supabase/functions/wa-webhook-mobility/utils/
rm -rf supabase/functions/wa-webhook-mobility/observe/log.ts
rm -rf supabase/functions/wa-webhook-mobility/observe/logging.ts

# Keep only:
# - wa-webhook-mobility/observe/logger.ts (will move to _shared)
# - _shared/wa-webhook-shared/*
```

**Files to Delete** (~35 files):
- `wa-webhook-mobility/utils/*` (all files)
- `wa-webhook-mobility/observe/log.ts`
- `wa-webhook-mobility/observe/logging.ts`
- Backup files: `*.backup`, `*.backup2`, `*.fixed`

#### Day 2: Update Imports
```typescript
// Find and replace across all webhook functions:

// BEFORE (local imports)
import { sendText } from "./wa/client.ts";
import { logStructuredEvent } from "./observe/log.ts";
import { maskPhone } from "./utils/text.ts";

// AFTER (shared imports)
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { maskPhone } from "../_shared/wa-webhook-shared/utils/text.ts";
```

**Files to Update** (~20 files):
- All webhook index.ts files
- Handler files
- Service files

#### Day 2: Test
```bash
# Run all tests
pnpm exec vitest run
pnpm test:functions

# Deploy to staging
supabase functions deploy wa-webhook-mobility --no-verify-jwt
supabase functions deploy wa-webhook-profile --no-verify-jwt

# Smoke test
curl -X POST https://[staging]/functions/v1/wa-webhook-mobility \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Success Criteria
- [ ] 35+ duplicate files deleted
- [ ] All imports updated and working
- [ ] All tests passing
- [ ] Staging deployment successful
- [ ] No production errors for 24 hours

### Estimated Effort
**Time**: 2 days  
**Risk**: Medium (requires comprehensive testing)  
**Impact**: -35 files, -40% technical debt

---

## Phase 2: Consolidate Logging (Days 3-5) 🟠 HIGH PRIORITY

### Goal
Single, efficient logging system for all webhooks

### Current State
- 3 different logging implementations
- Inconsistent log levels
- No unified metrics

### Tasks

#### Day 3: Create Unified Observability
```bash
# Move best implementation to shared
mkdir -p supabase/functions/_shared/observability/
cp supabase/functions/wa-webhook-mobility/observe/logger.ts \
   supabase/functions/_shared/observability/logger.ts
```

**New API**:
```typescript
// _shared/observability/index.ts
export { logStructuredEvent, recordMetric } from "./logger.ts";

// Usage in all webhooks
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";

// Structured event with context
logStructuredEvent("WORKFLOW_STARTED", {
  workflow: "seeDrivers",
  userId,
  correlationId,
}, "info");

// Metric with tags
recordMetric("mobility.match.found", 1, {
  vehicle: "moto",
  location: "kigali",
});
```

#### Day 4: Migrate All Webhooks
**Functions to Update** (8 functions):
1. wa-webhook-profile
2. wa-webhook-mobility
3. wa-webhook-core
4. wa-webhook-buy-sell (verify)
5. notify-buyers
6. wa-agent-support
7. simulator
8. admin-* functions

**Migration Pattern**:
```typescript
// Before
console.log("User created:", userId);
logger.info({ userId }, "User created");

// After
logStructuredEvent("USER_CREATED", {
  userId,
  method: "whatsapp",
  correlationId,
});

recordMetric("user.created", 1, {
  source: "whatsapp",
});
```

#### Day 5: Remove Old Systems
```bash
# Delete old logging files
find supabase/functions -name "log.ts" -not -path "*/_shared/*" -delete
find supabase/functions -name "logging.ts" -not -path "*/_shared/*" -delete

# Remove backup files
find supabase/functions -name "*.backup*" -delete
find supabase/functions -name "*.fixed" -delete
```

### Success Criteria
- [ ] Unified observability module in `_shared/`
- [ ] All 8 webhooks migrated
- [ ] Consistent log format across all functions
- [ ] Metrics appearing in dashboard
- [ ] Old logging code removed

### Estimated Effort
**Time**: 3 days  
**Risk**: Low (backward compatible)  
**Impact**: Unified ops, better debugging

---

## Phase 3: Reduce Log Noise (Day 6) 🟡 MEDIUM PRIORITY

### Goal
Remove verbose/debug logs, keep only actionable events

### Tasks

#### Audit Current Logs
```bash
# Find verbose logging
grep -r "console.log" supabase/functions/wa-webhook-*/
grep -r "debug" supabase/functions/wa-webhook-*/
grep -r "trace" supabase/functions/wa-webhook-*/
```

#### Apply Log Levels
**Keep**:
- `error` - Exceptions, failures (MUST fix)
- `warn` - Degraded service (SHOULD investigate)
- `info` - Business events (workflow started, completed)

**Remove**:
- `debug` - Internal state (not supported in production)
- `trace` - Request/response dumps
- Console.logs

#### Implementation
```typescript
// REMOVE
console.log("Processing message...");
logger.debug({ data }, "Raw data");

// KEEP
logStructuredEvent("MESSAGE_RECEIVED", {
  from: maskPhone(from),
  type: message.type,
}, "info");

logStructuredEvent("PROCESSING_ERROR", {
  error: error.message,
  from: maskPhone(from),
}, "error");
```

### Success Criteria
- [ ] 50% reduction in log volume
- [ ] No debug/trace logs in production
- [ ] All console.logs removed
- [ ] Only actionable logs remain

### Estimated Effort
**Time**: 1 day  
**Risk**: Low  
**Impact**: Faster debugging, lower costs

---

## Phase 4: Refactor Index Files (Days 7-10) 🟡 MEDIUM PRIORITY

### Goal
Extract handlers, reduce index.ts complexity

### Current State
- index.ts files are 500-800 lines
- Mixed concerns (routing, auth, business logic)
- Hard to test, hard to maintain

### Tasks

#### Pattern (Already Done for Buy-Sell)
```typescript
// wa-webhook-profile/
├── index.ts (150 lines) - Routing only
├── handlers/
│   ├── interactive-buttons.ts
│   ├── state-machine.ts
│   └── text-messages.ts
└── core/
    └── agent.ts
```

#### Day 7-8: wa-webhook-profile
- Extract button handlers → `handlers/interactive-buttons.ts`
- Extract state machine → `handlers/state-machine.ts`
- Extract text handler → `handlers/text-messages.ts`
- Reduce index.ts to ~150 lines

#### Day 9: wa-webhook-mobility
- Extract workflow handlers → `handlers/workflows.ts`
- Extract location handler → `handlers/location.ts`
- Reduce index.ts to ~150 lines

#### Day 10: wa-webhook-core
- Extract route handlers → `handlers/`
- Standardize structure

### Success Criteria
- [ ] All index.ts files <200 lines
- [ ] Clear separation of concerns
- [ ] Handler functions testable in isolation
- [ ] 40% LOC reduction (like buy-sell)

### Estimated Effort
**Time**: 4 days  
**Risk**: Medium (requires tests)  
**Impact**: Better maintainability

---

## Phase 5: Enable Observability (Days 11-12) 🟢 LOW PRIORITY

### Goal
Add comprehensive metrics and dashboards

### Tasks

#### Day 11: Define Key Metrics
```typescript
// Business metrics
recordMetric("workflow.started", 1, { workflow });
recordMetric("workflow.completed", 1, { workflow, duration });
recordMetric("workflow.failed", 1, { workflow, error });

// Performance metrics
recordMetric("response.time", duration, { endpoint });
recordMetric("db.query.time", queryTime, { table });

// User metrics
recordMetric("user.active", 1, { source });
recordMetric("message.received", 1, { type });
```

#### Day 12: Create Dashboards
- Grafana/DataDog dashboard config
- Key metrics visualization
- Alerting rules

### Success Criteria
- [ ] 20+ key metrics defined
- [ ] Metrics flowing to dashboard
- [ ] Alerts configured
- [ ] Documentation updated

### Estimated Effort
**Time**: 2 days  
**Risk**: Low  
**Impact**: Better visibility

---

## Phase 6: Feature Flags (Day 13) 🟢 LOW PRIORITY

### Goal
Safe rollout mechanism for new features

### Tasks

```typescript
// _shared/feature-flags.ts
export function isFeatureEnabled(
  flag: string,
  userId?: string,
): boolean {
  const config = Deno.env.get(`FEATURE_${flag.toUpperCase()}`);
  
  if (config === "true") return true;
  if (config === "false") return false;
  
  // Percentage rollout
  if (config?.includes("%")) {
    const pct = parseInt(config);
    if (userId) {
      const hash = hashString(userId);
      return (hash % 100) < pct;
    }
  }
  
  return false; // Default off
}

// Usage
if (isFeatureEnabled("MARKETPLACE", userId)) {
  // New marketplace feature
}
```

### Success Criteria
- [ ] Feature flag system implemented
- [ ] Environment variables documented
- [ ] Percentage rollout working

### Estimated Effort
**Time**: 1 day  
**Risk**: Low  
**Impact**: Safer deployments

---

## Execution Timeline

```
Week 1:
  Mon-Tue:  Phase 1 - Deduplicate
  Wed-Fri:  Phase 2 - Consolidate Logging

Week 2:
  Mon:      Phase 3 - Reduce Log Noise
  Tue-Fri:  Phase 4 - Refactor Index (Profile)

Week 3:
  Mon-Wed:  Phase 4 - Refactor Index (Mobility, Core)
  Thu-Fri:  Phase 5 - Observability

Week 4:
  Mon:      Phase 6 - Feature Flags
  Tue-Fri:  Buffer / Testing / Documentation
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking changes | Comprehensive test suite, staging deployment |
| Import errors | TypeScript checking, manual verification |
| Performance regression | Load testing, monitoring |
| Production incidents | Deploy during low traffic, rollback plan |

---

## Success Metrics

### Before
- 35+ duplicate files
- 3 logging systems
- 500-800 line index files
- No unified metrics
- No feature flags

### After
- 0 duplicate files (-40% technical debt)
- 1 unified logging system
- <200 line index files (-60% complexity)
- 20+ tracked metrics
- Safe feature rollout mechanism

---

## Next Steps

1. **Confirm Scope** - Review this plan
2. **Start Phase 1** - Begin deduplication
3. **Daily Standups** - Track progress
4. **Deploy to Staging** - After each phase
5. **Monitor Production** - 24hrs before next phase

---

**Ready to start Phase 1?**
