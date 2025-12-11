# Profile Domain Refactoring - Execution Plan

**Date**: 2025-12-11  
**Status**: ✅ READY FOR EXECUTION  
**Priority**: P0 (Critical Technical Debt)

---

## 📊 Current State - VALIDATED

### Confirmed Line Counts

| Component | Location | Lines | Status |
|-----------|----------|-------|--------|
| **wa-webhook-profile/index.ts** | Main handler | **1,434** | 🔴 TOO BIG |
| **wallet/** | 12 files | **2,260** | ⚠️ Extract |
| **business/** | 7 files | **1,548** | ⚠️ Move to buy-sell |
| **bars/** | 4 files | **2,203** | ⚠️ Move to waiter |
| **jobs/** | 4 files | **439** | ⚠️ Move to jobs |
| **properties/** | 4 files | **455** | ⚠️ Move to property |
| **vehicles/** | (not counted) | **526** | ⚠️ Move to mobility |
| **profile/** | 5 files | **1,077** | ✅ Keep |
| **TOTAL** | | **~10,876** | |

### services/profile Node.js Service

**Status**: ⚠️ UNUSED - No external references found  
**Recommendation**: DELETE (only self-references in logger)

---

## 🎯 Refactoring Goals

1. **Break up God Function**: Reduce wa-webhook-profile from 1,434 lines to ~300 lines
2. **Separation of Concerns**: Move domain logic to appropriate webhooks
3. **Create Wallet Webhook**: Extract 2,260 lines of wallet code to dedicated service
4. **Remove Dead Code**: Delete unused services/profile Node.js service
5. **Improve Maintainability**: Clear domain boundaries

---

## 📋 Phase 1: Create wa-webhook-wallet (P0 - IMMEDIATE)

### 1.1 Create Structure

```bash
# Create new wallet webhook
mkdir -p supabase/functions/wa-webhook-wallet/{wallet,__tests__}

# Copy wallet handlers (12 files, 2,260 lines)
cp -r supabase/functions/wa-webhook-profile/wallet/* \
      supabase/functions/wa-webhook-wallet/wallet/
```

### 1.2 Files to Move

From `wa-webhook-profile/wallet/`:
- ✅ **home.ts** - Wallet home/balance display
- ✅ **transfer.ts** - Token transfers
- ✅ **earn.ts** - Earn tokens
- ✅ **redeem.ts** - Redeem rewards
- ✅ **transactions.ts** - Transaction history
- ✅ **referral.ts** - Referral codes
- ✅ **purchase.ts** - Buy tokens
- ✅ **cashout.ts** - Cash out
- ✅ **top.ts** - Leaderboard
- ✅ **notifications.ts** - Wallet notifications
- ✅ **transfer.test.ts** - Tests

### 1.3 Create wa-webhook-wallet/index.ts

```typescript
// wa-webhook-wallet/index.ts - NEW DEDICATED WALLET WEBHOOK
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { logStructuredEvent } from "../_shared/observability.ts";
import { WEBHOOK_CONFIG } from "../_shared/config/webhooks.ts";
import { IDS } from "../_shared/wa-webhook-shared/wa/ids.ts";

const SERVICE_NAME = "wa-webhook-wallet";
const SERVICE_VERSION = "1.0.0";

// Main wallet entry point
// Handles: balance, transfer, earn, redeem, transactions, referral, purchase, cashout
```

### 1.4 Update wa-webhook-profile/index.ts

Remove wallet routes and forward to wa-webhook-wallet:

```typescript
// In wa-webhook-profile/index.ts
// DELETE wallet handlers (lines ~234-500)

// ADD forwarding logic
else if (id === IDS.WALLET_HOME || id === "WALLET_HOME") {
  // Forward to wa-webhook-wallet
  logEvent("WALLET_FORWARDED", { target: "wa-webhook-wallet" });
  // Set state and redirect
  await setState(supabase, ctx.profileId!, "wallet_redirect", { key: "wallet" });
  handled = true;
}
```

### 1.5 Testing

```bash
# Test wallet webhook
cd supabase/functions/wa-webhook-wallet
deno test --allow-all

# Integration test
pnpm test:functions
```

**Expected Impact**:
- wa-webhook-profile: 1,434 → ~1,000 lines (-434 lines, -30%)
- New wa-webhook-wallet: ~2,500 lines (including index.ts)

---

## 📋 Phase 2: Move Business Logic to wa-webhook-buy-sell (P1 - Week 1)

### 2.1 Files to Move

From `wa-webhook-profile/business/` (7 files, 1,548 lines):
- ✅ **list.ts** - List user's businesses
- ✅ **create.ts** - Create new business
- ✅ **update.ts** - Edit business details
- ✅ **delete.ts** - Delete business
- ✅ **search.ts** - Search businesses
- ✅ **add_manual.ts** - Manual business addition
- ✅ **index.ts** - Business router

### 2.2 Destination

```bash
# Move to existing wa-webhook-buy-sell
mkdir -p supabase/functions/wa-webhook-buy-sell/my-business

# Copy files
cp -r supabase/functions/wa-webhook-profile/business/* \
      supabase/functions/wa-webhook-buy-sell/my-business/
```

### 2.3 Update Routes

In `wa-webhook-buy-sell/index.ts`, add:

```typescript
// My Businesses section
else if (id === IDS.MY_BUSINESSES) {
  const { listMyBusinesses } = await import("./my-business/list.ts");
  handled = await listMyBusinesses(ctx);
}
```

**Expected Impact**:
- wa-webhook-profile: ~1,000 → ~700 lines (-300 lines)
- wa-webhook-buy-sell: Enhanced with business management

---

## 📋 Phase 3: Move Bars Logic to wa-webhook-waiter (P1 - Week 1)

### 3.1 Files to Move

From `wa-webhook-profile/bars/` (4 files, 2,203 lines):
- ✅ **index.ts** - Bar management router
- ✅ **menu_upload.ts** - Upload menu
- ✅ **menu_edit.ts** - Edit menu items
- ✅ **orders.ts** - Order management

### 3.2 Destination

```bash
# Move to existing wa-webhook-waiter
mkdir -p supabase/functions/wa-webhook-waiter/my-bars

cp -r supabase/functions/wa-webhook-profile/bars/* \
      supabase/functions/wa-webhook-waiter/my-bars/
```

**Expected Impact**:
- wa-webhook-profile: ~700 → ~500 lines (-200 lines)
- wa-webhook-waiter: Enhanced with bar owner features

---

## 📋 Phase 4: Move Jobs Logic to wa-webhook-jobs (P2 - Week 2)

### 4.1 Files to Move

From `wa-webhook-profile/jobs/` (4 files, 439 lines):
- ✅ **list.ts** - List user's jobs
- ✅ **create.ts** - Post new job
- ✅ **update.ts** - Edit job
- ✅ **delete.ts** - Remove job

### 4.2 Destination

```bash
mkdir -p supabase/functions/wa-webhook-jobs/my-jobs

cp -r supabase/functions/wa-webhook-profile/jobs/* \
      supabase/functions/wa-webhook-jobs/my-jobs/
```

**Expected Impact**:
- wa-webhook-profile: ~500 → ~450 lines (-50 lines)

---

## 📋 Phase 5: Move Properties Logic to wa-webhook-property (P2 - Week 2)

### 5.1 Files to Move

From `wa-webhook-profile/properties/` (4 files, 455 lines):
- ✅ **list.ts** - List user's properties
- ✅ **create.ts** - Add property listing
- ✅ **update.ts** - Edit property
- ✅ **delete.ts** - Remove property

### 5.2 Destination

```bash
mkdir -p supabase/functions/wa-webhook-property/my-properties

cp -r supabase/functions/wa-webhook-profile/properties/* \
      supabase/functions/wa-webhook-property/my-properties/
```

**Expected Impact**:
- wa-webhook-profile: ~450 → ~400 lines (-50 lines)

---

## 📋 Phase 6: Move Vehicles Logic to wa-webhook-mobility (P2 - Week 2)

### 6.1 Files to Move

From `wa-webhook-profile/vehicles/` (526 lines):
- ✅ All vehicle management files

### 6.2 Destination

```bash
mkdir -p supabase/functions/wa-webhook-mobility/my-vehicles

cp -r supabase/functions/wa-webhook-profile/vehicles/* \
      supabase/functions/wa-webhook-mobility/my-vehicles/
```

**Expected Impact**:
- wa-webhook-profile: ~400 → ~350 lines (-50 lines)

---

## 📋 Phase 7: Simplify wa-webhook-profile (P2 - Week 2)

### 7.1 Final wa-webhook-profile Should ONLY Handle

✅ **Profile Core** (~300 lines):
1. Profile home menu
2. Edit profile (name, language)
3. Saved locations (add, edit, delete, list)
4. Route requests to other webhooks

### 7.2 Delete Moved Code

```bash
# Remove moved directories
rm -rf supabase/functions/wa-webhook-profile/wallet
rm -rf supabase/functions/wa-webhook-profile/business
rm -rf supabase/functions/wa-webhook-profile/bars
rm -rf supabase/functions/wa-webhook-profile/jobs
rm -rf supabase/functions/wa-webhook-profile/properties
rm -rf supabase/functions/wa-webhook-profile/vehicles
```

### 7.3 Simplified Structure

```
wa-webhook-profile/
├── index.ts                    # ~300 lines (down from 1,434)
├── profile/
│   ├── home.ts                # Profile home menu
│   ├── edit.ts                # Edit name/language
│   └── locations.ts           # Saved locations
├── __tests__/
│   └── profile.test.ts
└── function.json
```

**Expected Impact**:
- wa-webhook-profile: 1,434 → ~300 lines (**-79% reduction**)

---

## 📋 Phase 8: Delete services/profile Node.js Service (P3 - Week 3)

### 8.1 Verification

✅ **Confirmed**: No external references found  
✅ **Only self-references**: logger.ts, server.ts

### 8.2 Deletion

```bash
# Backup first
mv services/profile services/.profile-backup-$(date +%Y%m%d)

# Or delete directly if confident
rm -rf services/profile
```

### 8.3 Update Workspace

Remove from `pnpm-workspace.yaml`:
```yaml
packages:
  - "services/*"
  # Note: Will no longer include services/profile
```

**Expected Impact**:
- Remove ~500 lines of unused code
- Simplify architecture

---

## 🗺️ Before vs After Architecture

### BEFORE (Current)

```
wa-webhook-profile (1,434 lines) - GOD FUNCTION
├── Profile (1,077 lines)
├── Wallet (2,260 lines) ⚠️ Should be separate
├── Business (1,548 lines) ⚠️ Should be in buy-sell
├── Bars (2,203 lines) ⚠️ Should be in waiter
├── Jobs (439 lines) ⚠️ Should be in jobs
├── Properties (455 lines) ⚠️ Should be in property
└── Vehicles (526 lines) ⚠️ Should be in mobility

services/profile (Node.js) - UNUSED
```

### AFTER (Proposed)

```
wa-webhook-profile (~300 lines) ✅ FOCUSED
├── Profile home
├── Edit profile
└── Saved locations

wa-webhook-wallet (~2,500 lines) ✅ NEW DEDICATED SERVICE
├── Balance/home
├── Transfer
├── Earn/redeem
├── Transactions
├── Referral
└── Purchase/cashout

wa-webhook-buy-sell (existing + 1,548 lines) ✅ ENHANCED
├── Business discovery
└── My businesses (MOVED)

wa-webhook-waiter (existing + 2,203 lines) ✅ ENHANCED
├── Restaurant ordering
└── My bars/restaurants (MOVED)

wa-webhook-jobs (existing + 439 lines) ✅ ENHANCED
├── Job search
└── My jobs (MOVED)

wa-webhook-property (existing + 455 lines) ✅ ENHANCED
├── Property search
└── My properties (MOVED)

wa-webhook-mobility (existing + 526 lines) ✅ ENHANCED
├── Rides
└── My vehicles (MOVED)

services/profile - ❌ DELETED (unused)
```

---

## 📊 Impact Summary

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **wa-webhook-profile lines** | 1,434 | ~300 | **-79%** |
| **Profile responsibilities** | 10+ domains | 3 core | **-70%** |
| **Dedicated wallet webhook** | ❌ None | ✅ Created | **+1 service** |
| **Separation of concerns** | ❌ Poor | ✅ Clear | **Improved** |
| **Total lines removed** | - | ~500 | **services/profile deleted** |
| **Maintainability** | 🔴 Hard | 🟢 Easy | **Significantly improved** |

---

## 🚀 Execution Checklist

### Phase 1: Wallet Extraction (P0 - IMMEDIATE)
- [ ] Create `supabase/functions/wa-webhook-wallet/`
- [ ] Move 12 wallet files (2,260 lines)
- [ ] Create `wa-webhook-wallet/index.ts`
- [ ] Update `wa-webhook-profile/index.ts` (remove wallet routes)
- [ ] Test wallet webhook
- [ ] Update documentation

### Phase 2: Business → buy-sell (P1 - Week 1)
- [ ] Move 7 business files (1,548 lines)
- [ ] Update `wa-webhook-buy-sell/index.ts`
- [ ] Remove business routes from profile
- [ ] Test business flows

### Phase 3: Bars → waiter (P1 - Week 1)
- [ ] Move 4 bar files (2,203 lines)
- [ ] Update `wa-webhook-waiter/index.ts`
- [ ] Remove bar routes from profile
- [ ] Test bar management

### Phase 4: Jobs → jobs (P2 - Week 2)
- [ ] Move 4 job files (439 lines)
- [ ] Update `wa-webhook-jobs/index.ts`
- [ ] Test job flows

### Phase 5: Properties → property (P2 - Week 2)
- [ ] Move 4 property files (455 lines)
- [ ] Update `wa-webhook-property/index.ts`
- [ ] Test property flows

### Phase 6: Vehicles → mobility (P2 - Week 2)
- [ ] Move vehicle files (526 lines)
- [ ] Update `wa-webhook-mobility/index.ts`
- [ ] Test vehicle flows

### Phase 7: Simplify Profile (P2 - Week 2)
- [ ] Remove all moved directories
- [ ] Simplify `wa-webhook-profile/index.ts`
- [ ] Update tests
- [ ] Verify ~300 line target

### Phase 8: Delete services/profile (P3 - Week 3)
- [ ] Final verification (no usage)
- [ ] Backup (optional)
- [ ] Delete `services/profile/`
- [ ] Update workspace config

---

## 🧪 Testing Strategy

### Per-Phase Testing

```bash
# After each phase
cd supabase/functions/wa-webhook-{domain}
deno test --allow-all

# Integration tests
pnpm test:functions

# E2E via WhatsApp simulator
# Test relevant user flows
```

### Critical User Flows to Verify

1. ✅ Profile edit (name, language)
2. ✅ Wallet balance check
3. ✅ Token transfer
4. ✅ Business management
5. ✅ Bar/restaurant menu
6. ✅ Job posting
7. ✅ Property listing
8. ✅ Vehicle management
9. ✅ Saved locations

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Broken imports** | High | Test each phase thoroughly |
| **State management** | Medium | Preserve state keys |
| **Routing logic** | High | Forward correctly to new webhooks |
| **User disruption** | Medium | Deploy during low-traffic hours |
| **Data loss** | Low | No DB changes, only code movement |

---

## 📝 Documentation Updates

After completion, update:
- [ ] `docs/ARCHITECTURE.md` - New webhook structure
- [ ] `docs/GROUND_RULES.md` - If observability changes
- [ ] `README.md` - Updated service list
- [ ] `supabase/functions/README.md` - Webhook routing
- [ ] This plan → `PROFILE_REFACTORING_COMPLETE.md`

---

## 🎯 Success Criteria

✅ **wa-webhook-profile reduced to ~300 lines** (from 1,434)  
✅ **wa-webhook-wallet created** (~2,500 lines)  
✅ **All domain logic moved** to appropriate webhooks  
✅ **services/profile deleted** (unused)  
✅ **All tests passing**  
✅ **No production incidents**  
✅ **User flows working** (verified via simulator)

---

## 🔄 Rollback Plan

If issues arise:

```bash
# Restore from git
git checkout main -- supabase/functions/wa-webhook-profile

# Restore services/profile if needed
mv services/.profile-backup-* services/profile

# Revert function deployments
supabase functions deploy wa-webhook-profile
```

---

## 👥 Team Coordination

- **Backend Team**: Execute phases 1-3
- **DevOps**: Monitor deployments
- **QA Team**: Test each phase
- **Product**: Verify no UX regressions

---

**Next Steps**: Begin Phase 1 - Create wa-webhook-wallet

**Questions?** Review this plan with the team before execution.

---

*Generated: 2025-12-11*  
*Validated: Line counts and structure confirmed*  
*Ready: ✅ All phases planned*
