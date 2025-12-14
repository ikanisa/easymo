# Phase 4: Buy-Sell Functions Deep Analysis & Refactoring Plan

**Generated**: 2025-12-14  
**Scope**: `agent-buy-sell`, `notify-buyers`, `wa-webhook-buy-sell`  
**Status**: Analysis Complete - Awaiting Implementation Approval

---

## Executive Summary

Analysis of three buy-sell related Edge Functions reveals **significant architectural issues**:

1. **`agent-buy-sell`** (89 lines) - BROKEN: References non-existent `_shared/agents/buy-and-sell.ts`
2. **`notify-buyers`** (244 lines) - ORPHANED: No integration with main webhook flow
3. **`wa-webhook-buy-sell`** (557 lines + 23 support files) - BLOATED: Duplicate agent logic, unnecessary complexity

**Key Finding**: The `agent-buy-sell` function is attempting to use a shared agent that **was deleted or never created**, causing the entire function to be non-functional.

---

## Function Analysis

### 1. `agent-buy-sell` - API Wrapper (BROKEN)

**Location**: `supabase/functions/agent-buy-sell/index.ts`  
**Lines**: 89  
**Purpose**: REST API wrapper for buy-sell agent  
**Status**: ❌ **NON-FUNCTIONAL**

#### Current Implementation
```typescript
// Lines 8-14: BROKEN IMPORTS
import { 
  BuyAndSellAgent,  // ❌ Does not exist
  type BuyAndSellContext,  // ❌ Does not exist
  loadContext,  // ❌ Does not exist
  saveContext,  // ❌ Does not exist
  resetContext  // ❌ Does not exist
} from "../_shared/agents/buy-and-sell.ts";  // ❌ File does not exist
```

#### Issues
- Imports from `_shared/agents/buy-and-sell.ts` which **does not exist**
- Only has `_shared/agents/common/` directory (index.ts, types.ts)
- Function will throw runtime error on any request
- No tests, no error monitoring for this breakage
- Last deployed 3 days ago with 106 invocations - **all likely failed**

#### Why It's Broken
- Appears to be part of an incomplete refactoring
- Comment in `wa-webhook-buy-sell/core/agent.ts:16` says:
  ```typescript
  // For API endpoints, use: supabase/functions/_shared/agents/buy-and-sell.ts (delegates here)
  ```
- But this shared file was never created or was deleted

---

### 2. `notify-buyers` - Market Alert System (ORPHANED)

**Location**: `supabase/functions/notify-buyers/index.ts`  
**Lines**: 244  
**Purpose**: Schedule market day alerts for buyers  
**Status**: ⚠️ **ORPHANED** (works but unused)

#### What It Does
- Schedules WhatsApp alerts for produce market days
- Uses `config/farmer-agent/markets/index.ts` (farmer market configs)
- Inserts into `buyer_market_alerts` table
- Supports:
  - Market-specific commodities/varieties/grades
  - Multiple alert windows (e.g., 36h and 24h before market)
  - COD payment fallback
  - Price hints from produce catalog

#### Issues
1. **No Integration**: Not called by any webhook or workflow
2. **Farmer-Focused**: Uses farmer-agent configs but placed in buy-sell context
3. **Manual Invocation**: Requires external system to POST with buyers array
4. **Database Dependency**: Requires `buyer_market_alerts` table (may not exist)
5. **No Observability**: Missing structured logging, correlation IDs

#### Example Usage (hypothetical)
```json
POST /notify-buyers
{
  "marketCode": "kimironko",
  "commodity": "tomato",
  "variety": "roma",
  "buyers": [
    { "phone": "250788123456", "name": "Jean", "locale": "rw" }
  ]
}
```

#### Verdict
- **Functional** but **not integrated**
- Belongs with farmer-agent ecosystem, not buy-sell
- Should be moved to `wa-webhook-farmers` or farmer-specific functions
- Or deleted if feature was abandoned

---

### 3. `wa-webhook-buy-sell` - Main Webhook Handler (BLOATED)

**Location**: `supabase/functions/wa-webhook-buy-sell/`  
**Lines**: 557 (index.ts) + **23 TypeScript files** (~2,500 total lines)  
**Purpose**: WhatsApp webhook for marketplace conversations  
**Status**: ✅ **FUNCTIONAL** but ⚠️ **NEEDS REFACTORING**

#### Structure
```
wa-webhook-buy-sell/
├── index.ts (557 lines) - Main webhook handler
├── core/
│   └── agent.ts (1,200+ lines) - MarketplaceAgent class
├── my-business/
│   ├── list.ts - Business listing UI
│   ├── create.ts - Business creation flow
│   ├── update.ts - Business editing
│   ├── delete.ts - Business deletion
│   ├── search.ts - Business search
│   └── add_manual.ts - Manual business entry
├── services/
│   ├── vendor-outreach.ts - Broadcast to vendors
│   └── user-memory.ts - Conversation context
├── handlers/
│   ├── state-machine.ts - Flow state management
│   ├── interactive-buttons.ts - Button handlers
│   └── vendor-response-handler.ts - Vendor reply processing
├── flows/
│   └── proactive-outreach-workflow.ts - Vendor messaging workflow
├── db/
│   └── index.ts - Database helpers
├── utils/
│   └── index.ts - Message extraction
├── media.ts - Media handling
├── show_ai_welcome.ts - Welcome messages
└── __tests__/ (3 test files)
```

#### Key Features
1. **AI Agent ("Kwizera")**: Natural language sourcing assistant
   - Intent: selling, buying, inquiry, vendor_outreach
   - Entity extraction: product, price, location, attributes
   - Conversation state management
   - Multi-language (EN, FR, RW, SW)

2. **Business Management**:
   - "My Businesses" flow for users to create/edit/delete listings
   - Category selection (pharmacy, salon, restaurant, etc.)
   - Location sharing support

3. **Vendor Outreach**:
   - Proactive messaging to vendors on behalf of buyers
   - Consent-based (user must approve)
   - Broadcast to multiple vendors
   - Response aggregation

4. **Security**:
   - WhatsApp signature verification
   - Rate limiting (100 req/min)
   - Message deduplication (prevents duplicate processing)
   - Correlation IDs for tracing

#### Issues

##### 1. Duplicate Agent Logic
- `agent.ts` defines **MarketplaceAgent** class (1,200+ lines)
- Same logic should be in `_shared/agents/` for reuse
- `agent-buy-sell` tries to import shared agent but it doesn't exist
- **Result**: Code duplication, inconsistent behavior

##### 2. Missing Shared Agent File
- Comment in `agent.ts:16`:
  ```typescript
  // For API endpoints, use: supabase/functions/_shared/agents/buy-and-sell.ts (delegates here)
  ```
- File **does not exist** in `_shared/agents/`
- Only `_shared/agents/common/` exists

##### 3. Broken TODO in Code
```typescript
// Line 28-29 in agent.ts
// TODO Phase 2: Fix DualAIProvider import - path broken
type DualAIProvider = any; // Temporary workaround
```
- AI provider is hardcoded as `any` type
- Breaks type safety
- May cause runtime errors

##### 4. Overly Complex Structure
- 23 TypeScript files for a single webhook
- Many modules only used once
- `my-business/` has 6 separate files (list, create, update, delete, search, add_manual)
- Could be consolidated into 2-3 files

##### 5. Inconsistent Naming
- Function: `wa-webhook-buy-sell`
- Agent class: `MarketplaceAgent` (not BuyAndSellAgent)
- Context type: `BuyAndSellContext` (alias for MarketplaceContext)
- **Result**: Confusion in codebase

##### 6. Original Backup Directory
- `original-backup-for-ref/` directory still present
- Contains old implementation (function.json, .env, index.ts)
- Should be deleted (use git history instead)

---

## Redundancies & Overlaps

### 1. Agent Implementation Duplication
```
wa-webhook-buy-sell/core/agent.ts         ← 1,200+ lines (ACTIVE)
_shared/agents/buy-and-sell.ts            ← MISSING (referenced but doesn't exist)
agent-buy-sell/index.ts                   ← 89 lines (BROKEN - imports missing file)
```

**Problem**: 
- Webhook has its own agent implementation
- API wrapper expects shared agent (doesn't exist)
- No code reuse between functions

**Solution**:
- Extract `MarketplaceAgent` to `_shared/agents/marketplace.ts`
- Make webhook use shared agent
- Fix `agent-buy-sell` to use shared agent
- Keep webhook-specific logic (button handlers, flows) in webhook

### 2. Context Management Duplication
```typescript
// wa-webhook-buy-sell/core/agent.ts defines:
export interface MarketplaceContext { ... }
export type BuyAndSellContext = MarketplaceContext;  // Alias

// agent-buy-sell/index.ts imports (non-existent):
import { type BuyAndSellContext } from "../_shared/agents/buy-and-sell.ts";
```

**Problem**:
- Type defined in webhook-specific file
- API wrapper can't import it (file doesn't exist)
- No single source of truth

**Solution**:
- Move types to `_shared/agents/common/types.ts`
- Both functions import from shared location

### 3. Farmer vs. Buy-Sell Confusion
```
notify-buyers/index.ts uses:
  - config/farmer-agent/markets/index.ts
  - buyer_market_alerts table
  - Produce catalog
```

**Problem**:
- `notify-buyers` is in buy-sell context but uses farmer configs
- Buy-sell is for marketplace (any product/service)
- Farmer markets are specific to agricultural produce
- Mixing concerns

**Solution**:
- Move `notify-buyers` to farmer-agent functions
- Or create separate `wa-webhook-farmers-market` function
- Or delete if feature is abandoned

---

## Database Schema Issues

### Missing Tables (Potential)
1. **`buyer_market_alerts`** - Used by `notify-buyers`
   - May not exist in current schema
   - No migration found creating this table
   - Function will fail if table missing

2. **`produce_catalog`** - Used by `notify-buyers`
   - References in code but no schema verification
   - Contains: price_floor, price_ceiling, synonyms, localized_names

3. **`vendor_inquiries`** - Referenced in agent.ts
   - Used for vendor outreach tracking
   - Need to verify existence

### Action Required
- Run schema check:
  ```bash
  psql $DATABASE_URL -c "\dt buyer_market_alerts"
  psql $DATABASE_URL -c "\dt produce_catalog"
  psql $DATABASE_URL -c "\dt vendor_inquiries"
  ```

---

## Log Analysis Findings

### `agent-buy-sell` (106 invocations, 3 days ago)
**Expected Errors** (function is broken):
- ❌ Import errors: "Cannot resolve module"
- ❌ Runtime errors: "BuyAndSellAgent is not defined"
- ❌ 500 responses on all requests

**Action**: Check logs for error patterns
```bash
# Check Supabase logs for agent-buy-sell
supabase functions logs agent-buy-sell --limit 50
```

### `notify-buyers` (105 invocations, 2 days ago)
**Unexpected**: Who is calling this?
- No webhook integration found
- No scheduled job found
- Possible manual testing or external system

**Action**: Investigate callers
```bash
# Check logs for notify-buyers
supabase functions logs notify-buyers --limit 50
# Look for x-forwarded-for, referer headers
```

### `wa-webhook-buy-sell` (423 invocations, 2 days ago)
**Active and functional** but check for:
- Duplicate message processing (should be blocked)
- TODO errors from broken DualAIProvider import
- Long processing times (>2s warning, >5s critical)

**Action**: Analyze performance
```bash
supabase functions logs wa-webhook-buy-sell --limit 100 | grep -E "(duration|error|TODO)"
```

---

## Proposed Refactoring Plan

### Phase 4.1: Fix Broken Function (CRITICAL - 2 hours)

#### Step 1: Create Shared Agent Module
**File**: `supabase/functions/_shared/agents/marketplace.ts`

```typescript
/**
 * Marketplace Agent - Shared Implementation
 * 
 * Extracted from wa-webhook-buy-sell/core/agent.ts
 * Used by:
 * - agent-buy-sell (API wrapper)
 * - wa-webhook-buy-sell (WhatsApp webhook)
 * - Future: Admin panel, analytics
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { logStructuredEvent, recordMetric } from "../observability.ts";

export interface MarketplaceContext {
  phone: string;
  flowType?: "selling" | "buying" | "inquiry" | "category_selection" | null;
  flowStep?: string | null;
  collectedData?: Record<string, unknown>;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  location?: { lat: number; lng: number };
  currentListingId?: string | null;
  selectedCategory?: string;
}

export class MarketplaceAgent {
  constructor(
    private supabase: SupabaseClient,
    private correlationId?: string
  ) {}

  async process(message: string, context: MarketplaceContext): Promise<AgentResponse> {
    // Core agent logic (extracted from wa-webhook-buy-sell/core/agent.ts)
  }

  static async loadContext(phone: string, supabase: SupabaseClient): Promise<MarketplaceContext> {
    // Load from conversation_contexts table
  }

  static async saveContext(context: MarketplaceContext, supabase: SupabaseClient): Promise<void> {
    // Save to conversation_contexts table
  }

  static async resetContext(phone: string, supabase: SupabaseClient): Promise<void> {
    // Clear context
  }
}
```

#### Step 2: Update `agent-buy-sell`
**File**: `supabase/functions/agent-buy-sell/index.ts`

```typescript
// Fix imports - use new shared location
import { 
  MarketplaceAgent,
  type MarketplaceContext as BuyAndSellContext,
} from "../_shared/agents/marketplace.ts";

// Rest of file stays the same
```

#### Step 3: Update `wa-webhook-buy-sell`
**File**: `supabase/functions/wa-webhook-buy-sell/index.ts`

```typescript
// Use shared agent instead of local
import { MarketplaceAgent, WELCOME_MESSAGE } from "../_shared/agents/marketplace.ts";
// Keep webhook-specific imports (button handlers, flows)
import { handleMyBusinessButton } from "./my-business/index.ts";
```

#### Step 4: Delete Duplicate Code
- Move `core/agent.ts` logic to `_shared/agents/marketplace.ts`
- Keep only webhook-specific code in `wa-webhook-buy-sell/core/`
- Delete `original-backup-for-ref/` directory

#### Step 5: Deploy & Test
```bash
# Deploy fixed functions
supabase functions deploy agent-buy-sell
supabase functions deploy wa-webhook-buy-sell

# Test API wrapper
curl -X POST https://PROJECT.supabase.co/functions/v1/agent-buy-sell \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userPhone":"250788123456","message":"I need brake pads"}'

# Test webhook (use internal forward to bypass signature)
curl -X POST https://PROJECT.supabase.co/functions/v1/wa-webhook-buy-sell \
  -H "x-wa-internal-forward: true" \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

---

### Phase 4.2: Decide on `notify-buyers` (1 hour)

#### Option A: Move to Farmer Ecosystem
- Rename to `wa-webhook-farmers-market-alerts`
- Move to farmer-agent directory structure
- Integrate with farmer workflows
- **Pros**: Clear separation of concerns
- **Cons**: Requires farmer-agent refactoring (may not exist yet)

#### Option B: Delete
- Feature appears unused (105 invocations with no integration)
- May be abandoned/experimental code
- Can recover from git if needed later
- **Pros**: Reduces codebase complexity
- **Cons**: Lose potentially useful feature

#### Option C: Keep & Document
- Add README explaining purpose
- Add integration examples
- Add tests
- **Pros**: Preserve functionality
- **Cons**: Maintenance burden for unused feature

**Recommendation**: **Option B (Delete)** - No evidence of usage, can recover if needed

---

### Phase 4.3: Consolidate `wa-webhook-buy-sell` (4 hours)

#### 1. Reduce File Count
**Before**: 23 files  
**After**: ~10 files

**Consolidations**:
```
my-business/
  ├── list.ts         ┐
  ├── create.ts       ├─> my-business.ts (all CRUD ops)
  ├── update.ts       │
  ├── delete.ts       │
  ├── search.ts       │
  └── add_manual.ts   ┘

handlers/
  ├── state-machine.ts         ┐
  ├── interactive-buttons.ts   ├─> handlers.ts
  └── vendor-response-handler.ts┘

services/
  ├── vendor-outreach.ts  ┐
  └── user-memory.ts      ├─> services.ts
                          ┘
```

**Keep Separate**:
- `core/agent.ts` → Will use `_shared/agents/marketplace.ts`
- `flows/proactive-outreach-workflow.ts` → Complex workflow
- `db/index.ts` → Database layer
- `utils/index.ts` → Utilities
- `__tests__/` → Tests

#### 2. Fix TODO Items
```typescript
// Before (agent.ts:28-29)
// TODO Phase 2: Fix DualAIProvider import - path broken
type DualAIProvider = any;

// After
import { DualAIProvider } from "../../wa-agent-waiter/core/providers/dual-ai-provider.ts";
// Or use direct import from _shared if available
```

#### 3. Delete Backup Directory
```bash
rm -rf supabase/functions/wa-webhook-buy-sell/original-backup-for-ref/
```

#### 4. Add Documentation
**File**: `supabase/functions/wa-webhook-buy-sell/README.md`

```markdown
# wa-webhook-buy-sell

WhatsApp webhook for marketplace conversations (buy, sell, inquire).

## Features
- AI agent ("Kwizera") for natural language sourcing
- Business listing management (My Businesses)
- Vendor outreach system (proactive messaging)
- Multi-language support (EN, FR, RW, SW)

## Architecture
- Uses shared MarketplaceAgent from `_shared/agents/marketplace.ts`
- Webhook-specific code: button handlers, flows, UI
- State management via `conversation_contexts` table

## Dependencies
- `_shared/agents/marketplace.ts` - Core agent logic
- `_shared/wa-webhook-shared/` - Common webhook utilities
- Database tables: profiles, businesses, vendor_inquiries, conversation_contexts

## Testing
```bash
deno test --allow-all
```

## Deployment
```bash
supabase functions deploy wa-webhook-buy-sell
```
```

---

### Phase 4.4: Add Observability (2 hours)

#### 1. Add Missing Metrics
```typescript
// In all three functions
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";

// agent-buy-sell
recordMetric("agent_buy_sell.api.request", 1, { method: req.method });
recordMetric("agent_buy_sell.api.latency_ms", duration);
recordMetric("agent_buy_sell.api.error", 1, { error_type: "import_error" });

// notify-buyers
recordMetric("notify_buyers.scheduled", alerts.length, { market_code: payload.marketCode });
recordMetric("notify_buyers.latency_ms", duration);

// wa-webhook-buy-sell (already has some, add missing)
recordMetric("buy_sell.button.clicked", 1, { button_id: buttonId });
recordMetric("buy_sell.location.shared", 1);
recordMetric("buy_sell.business.created", 1);
```

#### 2. Add Correlation IDs
```typescript
// Ensure all functions propagate correlation ID
const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

// Pass to all log events
logStructuredEvent("EVENT_NAME", { ...data, correlationId });

// Include in responses
headers.set("X-Correlation-ID", correlationId);
```

#### 3. Structured Error Logging
```typescript
// Standardize error format
try {
  // ... operation
} catch (error) {
  const errorDetails = {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    function: "agent-buy-sell",
    operation: "process_message",
    correlationId,
    duration_ms: Date.now() - startTime,
  };
  
  logStructuredEvent("AGENT_BUY_SELL_ERROR", errorDetails, "error");
  recordMetric("agent_buy_sell.error", 1, { type: errorDetails.error });
  
  return respond({ error: "internal_error" }, { status: 500 });
}
```

---

### Phase 4.5: Testing & Validation (2 hours)

#### 1. Unit Tests
```typescript
// __tests__/agent-buy-sell.test.ts
Deno.test("agent-buy-sell - process buy intent", async () => {
  const response = await POST("/agent-buy-sell", {
    userPhone: "250788123456",
    message: "I need brake pads for RAV4 2010",
  });
  
  assertEquals(response.status, 200);
  assertExists(response.body.action);
});

Deno.test("agent-buy-sell - handles missing shared agent gracefully", async () => {
  // Should NOT throw import error after fix
});
```

#### 2. Integration Tests
```bash
# Test full webhook flow
./test-buy-sell-webhook.sh

# Verify shared agent works from both functions
./test-shared-agent.sh
```

#### 3. Performance Tests
```typescript
// Measure latency
Deno.test("wa-webhook-buy-sell - responds within 2s", async () => {
  const start = Date.now();
  await POST("/wa-webhook-buy-sell", mockWhatsAppPayload);
  const duration = Date.now() - start;
  
  assert(duration < 2000, `Too slow: ${duration}ms`);
});
```

---

## Implementation Timeline

| Phase | Task | Duration | Priority |
|-------|------|----------|----------|
| 4.1 | Fix broken `agent-buy-sell` | 2 hours | 🔴 CRITICAL |
| 4.2 | Decide on `notify-buyers` | 1 hour | 🟡 MEDIUM |
| 4.3 | Consolidate `wa-webhook-buy-sell` | 4 hours | 🟡 MEDIUM |
| 4.4 | Add observability | 2 hours | 🟢 LOW |
| 4.5 | Testing & validation | 2 hours | 🟡 MEDIUM |
| **TOTAL** | | **11 hours** | |

---

## Risks & Mitigation

### Risk 1: Breaking Active Webhook
**Impact**: HIGH - 423 invocations in last 2 days  
**Mitigation**:
- Deploy to staging first
- Use feature flag for shared agent
- Keep rollback plan ready
- Monitor error rates post-deployment

### Risk 2: Database Schema Mismatch
**Impact**: MEDIUM - Functions may query non-existent tables  
**Mitigation**:
- Run schema validation before deployment
- Add table existence checks in code
- Create migrations if tables missing

### Risk 3: Performance Regression
**Impact**: MEDIUM - Shared agent may be slower  
**Mitigation**:
- Benchmark before/after
- Add performance monitoring
- Optimize shared agent if needed

### Risk 4: Lost Functionality
**Impact**: LOW - Consolidation may remove features  
**Mitigation**:
- Document all features before refactor
- Test all button handlers
- Keep backup of original code (git)

---

## Success Criteria

### Phase 4.1 (Fix Broken Function)
- ✅ `agent-buy-sell` returns 200 on valid requests
- ✅ No import errors in logs
- ✅ Shared agent file exists and is tested
- ✅ Both functions use same agent logic

### Phase 4.2 (Decide on notify-buyers)
- ✅ Decision documented
- ✅ If kept: README + tests added
- ✅ If moved: New location deployed
- ✅ If deleted: Committed with clear message

### Phase 4.3 (Consolidate wa-webhook-buy-sell)
- ✅ File count reduced from 23 to ~10
- ✅ All TODOs resolved
- ✅ README added
- ✅ Backup directory deleted
- ✅ All tests passing

### Phase 4.4 (Observability)
- ✅ All functions emit structured logs
- ✅ Correlation IDs in all requests
- ✅ Metrics for key operations
- ✅ Error tracking standardized

### Phase 4.5 (Testing)
- ✅ Unit tests: 90%+ coverage
- ✅ Integration tests pass
- ✅ Performance: <2s response time
- ✅ No errors in production logs for 24h

---

## Rollout Plan

### Stage 1: Staging Deployment
1. Create `_shared/agents/marketplace.ts`
2. Deploy to staging
3. Run automated tests
4. Manual testing with test WhatsApp number

### Stage 2: Canary Deployment
1. Deploy to production with feature flag OFF
2. Enable for 10% of traffic
3. Monitor for 2 hours
4. If no errors, increase to 50%

### Stage 3: Full Rollout
1. Enable for 100% of traffic
2. Monitor for 24 hours
3. Document changes
4. Close Phase 4 tickets

### Stage 4: Cleanup
1. Delete old code
2. Update documentation
3. Notify team of changes
4. Archive this analysis document

---

## Next Steps

1. **IMMEDIATE (Today)**:
   - Check `agent-buy-sell` error logs
   - Verify database schema (buyer_market_alerts, produce_catalog)
   - Get approval for Phase 4.1 (critical fix)

2. **Week 1**:
   - Implement Phase 4.1 (fix broken function)
   - Decide on `notify-buyers` fate (Phase 4.2)
   - Start Phase 4.3 (consolidation)

3. **Week 2**:
   - Complete Phase 4.3
   - Implement Phase 4.4 (observability)
   - Run Phase 4.5 (testing)

4. **Week 3**:
   - Staging deployment
   - Canary rollout
   - Full production deployment
   - Post-deployment monitoring

---

## Appendix

### A. File Inventory

#### `agent-buy-sell/`
- `index.ts` (89 lines) - Main function ❌ BROKEN
- `function.json` - Deployment config

#### `notify-buyers/`
- `index.ts` (244 lines) - Main function ⚠️ ORPHANED
- `deno.json` - Deno config

#### `wa-webhook-buy-sell/`
- `index.ts` (557 lines) - Main webhook handler ✅ FUNCTIONAL
- `function.json` - Deployment config
- `core/agent.ts` (1,200+ lines) - MarketplaceAgent ⚠️ SHOULD BE SHARED
- `my-business/` (6 files) - Business CRUD
- `services/` (2 files) - Vendor outreach, memory
- `handlers/` (3 files) - State machine, buttons, vendor responses
- `flows/` (1 file) - Proactive outreach workflow
- `db/` (1 file) - Database helpers
- `utils/` (1 file) - Message extraction
- `media.ts` - Media handling
- `show_ai_welcome.ts` - Welcome messages
- `__tests__/` (3 files) - Tests
- `original-backup-for-ref/` (3 files) ❌ DELETE

### B. Database Tables Used

| Table | Used By | Status |
|-------|---------|--------|
| `profiles` | All 3 | ✅ Verified |
| `businesses` | wa-webhook-buy-sell | ✅ Verified |
| `conversation_contexts` | agent-buy-sell, wa-webhook-buy-sell | ✅ Verified |
| `vendor_inquiries` | wa-webhook-buy-sell | ⚠️ Check |
| `buyer_market_alerts` | notify-buyers | ❌ Likely missing |
| `produce_catalog` | notify-buyers | ❌ Likely missing |

### C. External Dependencies

| Dependency | Used By | Location |
|------------|---------|----------|
| `_shared/observability.ts` | All 3 | ✅ Exists |
| `_shared/webhook-utils.ts` | wa-webhook-buy-sell | ✅ Exists |
| `_shared/rate-limit/` | wa-webhook-buy-sell | ✅ Exists |
| `_shared/wa-webhook-shared/` | wa-webhook-buy-sell | ✅ Exists |
| `_shared/agents/buy-and-sell.ts` | agent-buy-sell | ❌ MISSING |
| `config/farmer-agent/markets/` | notify-buyers | ⚠️ Check |
| `wa-agent-waiter/core/providers/dual-ai-provider.ts` | wa-webhook-buy-sell | ⚠️ Check |

---

**End of Analysis**  
**Author**: GitHub Copilot CLI  
**Date**: 2025-12-14  
**Review Status**: Pending approval for Phase 4.1 implementation
