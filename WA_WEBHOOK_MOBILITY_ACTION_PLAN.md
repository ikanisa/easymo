# wa-webhook-mobility: Critical Action Plan

**Created**: 2025-11-25  
**Status**: READY TO EXECUTE  
**Priority**: P0 - Critical Blockers  
**Related**: WA_WEBHOOK_MOBILITY_DEEP_ANALYSIS.md

---

## 🎯 Quick Summary

The wa-webhook-mobility function has **3 critical blockers** that must be resolved before production deployment:

1. ❌ Missing RPC functions (causes runtime failures)
2. ❌ Code duplication with divergence (maintenance risk)
3. ❌ Massive file size (schedule.ts: 1,273 LOC)

**Estimated Time**: 3-5 days with dedicated developer

---

## ✅ PHASE 1: Critical Fixes (DO THIS FIRST)

### Task 1: Deploy Missing RPC Functions ⚡ URGENT

**Status**: ✅ Migration created, ready to apply

**Files Created**:
- ✅ `supabase/migrations/20251125072800_create_mobility_rpc_functions.sql`
- ✅ `scripts/verify-mobility-schema.sh`

**Action Steps**:

```bash
# Step 1: Verify current state
cd /Users/jeanbosco/workspace/easymo-
./scripts/verify-mobility-schema.sh

# Step 2: Apply migration
supabase db push

# OR manually:
# psql $DATABASE_URL -f supabase/migrations/20251125072800_create_mobility_rpc_functions.sql

# Step 3: Verify again
./scripts/verify-mobility-schema.sh

# Expected: All checks pass ✅
```

**Functions Created**:
1. ✅ `rides_update_driver_location` - Updates driver location
2. ✅ `is_driver_insurance_valid` - Checks insurance validity
3. ✅ `get_driver_active_insurance` - Gets active insurance details
4. ✅ `find_online_drivers_near_trip` - Finds nearby online drivers

**Impact**: Eliminates all silent failures in:
- `handlers/go_online.ts`
- `handlers/driver_insurance.ts`
- `notifications/drivers.ts`

**Time**: 30 minutes

---

### Task 2: Resolve Code Duplication ⚡ URGENT

**Status**: ⚠️ Analysis complete, awaiting execution

**Problem**: 
```
handlers/schedule.ts (1,273 LOC) ← Currently imported ✅
mobility/schedule.ts (1,421 LOC) ← UNUSED, DELETE ❌

handlers/nearby.ts (872 LOC) ← Currently imported ✅
mobility/nearby.ts (871 LOC) ← UNUSED, DELETE ❌
```

**Action Steps**:

```bash
cd /Users/jeanbosco/workspace/easymo-/supabase/functions/wa-webhook-mobility

# Step 1: Verify index.ts imports from handlers/
grep "from.*handlers/schedule\|from.*handlers/nearby" index.ts
# Expected: Should show imports from handlers/ not mobility/

# Step 2: Check for any imports from mobility/schedule or mobility/nearby
grep -rn "from.*mobility/schedule\|from.*mobility/nearby" . --include="*.ts"
# Expected: No results (if empty, safe to delete)

# Step 3: Compare files one more time to ensure no critical differences
diff handlers/schedule.ts mobility/schedule.ts > /tmp/schedule-diff.txt
diff handlers/nearby.ts mobility/nearby.ts > /tmp/nearby-diff.txt
cat /tmp/schedule-diff.txt
cat /tmp/nearby-diff.txt

# Step 4: If only minor differences, DELETE mobility versions
# IMPORTANT: Review diff output first!
# rm mobility/schedule.ts
# rm mobility/nearby.ts

# Step 5: Run tests to ensure nothing breaks
cd /Users/jeanbosco/workspace/easymo-/supabase/functions/wa-webhook-mobility
deno test --allow-all

# Step 6: Test edge function locally
supabase functions serve wa-webhook-mobility
```

**⚠️ CAUTION**: 
- Review diff output carefully before deleting
- Files have diverged (148 lines difference in schedule.ts)
- May need to merge critical fixes before deletion

**Time**: 2-3 hours (includes review and testing)

---

### Task 3: Remove Silent Failures ⚡ URGENT

**Status**: ⚠️ Can be done after Task 1 completes

**Problem**: Multiple handlers have try/catch blocks that silently fail

**Locations**:
```typescript
// handlers/go_online.ts:86-95
} catch (error) {
  console.warn("rides_update_driver_location not available...");
  // ❌ User gets no feedback
}

// handlers/driver_insurance.ts:36, :62
// Similar silent failures
```

**Action Steps**:

1. After RPC functions are deployed (Task 1)
2. Remove "ignore if doesn't exist" comments
3. Replace silent failures with proper error handling:

```typescript
// BEFORE (BAD)
try {
  await ctx.supabase.rpc("rides_update_driver_location", {...});
} catch (error) {
  console.warn("Function not available");
  // Silent failure ❌
}

// AFTER (GOOD)
try {
  await ctx.supabase.rpc("rides_update_driver_location", {...});
} catch (error) {
  await logStructuredEvent("LOCATION_UPDATE_FAILED", {
    driverId: ctx.profileId,
    error: String(error),
  }, "error");
  
  return ctx.reply.text(
    "Unable to update your location. Please try again."
  );
}
```

**Files to Update**:
- `handlers/go_online.ts`
- `handlers/driver_insurance.ts`

**Time**: 1 hour

---

## 📊 PHASE 2: Refactoring (Next Week)

### Task 4: Split schedule.ts

**Status**: ⚠️ Planned, not started

**Goal**: Reduce file size from 1,273 LOC to <500 LOC per file

**Approach**:
```
handlers/schedule.ts (1,273 LOC)
  ↓ SPLIT INTO ↓
├── handlers/schedule-handler.ts (~400 LOC)
│   ├── Main routing logic
│   └── Handler registration
│
├── handlers/schedule-booking.ts (~500 LOC)
│   ├── startScheduleTrip
│   ├── handleScheduleRole
│   ├── handleScheduleVehicle
│   ├── handleScheduleLocation
│   ├── handleScheduleDropoff
│   └── handleScheduleTimeSelection
│
└── handlers/schedule-management.ts (~400 LOC)
    ├── handleScheduleRefresh
    ├── View bookings
    ├── Edit bookings
    └── Cancel bookings
```

**Time**: 1-2 days

---

### Task 5: Add Test Coverage

**Status**: ⚠️ Planned, not started

**Current Coverage**: ~30%  
**Target Coverage**: 80%

**Priority Files** (in order):
1. `handlers/schedule.test.ts` - Largest file
2. `handlers/nearby.test.ts` - Second largest
3. `handlers/driver_insurance.test.ts` - Complex OCR logic
4. `handlers/driver_response.test.ts` - Critical path
5. Integration tests

**Time**: 2-3 days

---

## 🚀 Deployment Checklist

### Before Deploying to Production

**Phase 1 (MUST COMPLETE)** ✅ Ready to start:
- [ ] RPC functions deployed and verified
- [ ] Code duplication removed
- [ ] Silent failures fixed
- [ ] Schema verification script passes
- [ ] Basic smoke tests pass

**Phase 2 (SHOULD COMPLETE)**:
- [ ] schedule.ts refactored
- [ ] Test coverage >80%
- [ ] Integration tests pass
- [ ] Feature flags implemented

**Phase 3 (NICE TO HAVE)**:
- [ ] Load testing complete
- [ ] Monitoring dashboard configured
- [ ] Runbook updated

---

## 🔥 Execute Now (Steps for Immediate Action)

**If you want to fix critical blockers RIGHT NOW**:

```bash
# 1. Navigate to project
cd /Users/jeanbosco/workspace/easymo-

# 2. Verify schema (will show failures)
./scripts/verify-mobility-schema.sh

# 3. Apply RPC functions migration
supabase db push
# OR: psql $DATABASE_URL -f supabase/migrations/20251125072800_create_mobility_rpc_functions.sql

# 4. Verify again (should pass)
./scripts/verify-mobility-schema.sh

# 5. Review code duplication
cd supabase/functions/wa-webhook-mobility
diff handlers/schedule.ts mobility/schedule.ts | head -50
diff handlers/nearby.ts mobility/nearby.ts | head -50

# 6. If safe, remove duplicates
# (After reviewing diffs!)
# rm mobility/schedule.ts mobility/nearby.ts

# 7. Test edge function
supabase functions serve wa-webhook-mobility
# In another terminal:
# curl http://localhost:54321/functions/v1/wa-webhook-mobility/health

# 8. Deploy to staging
supabase functions deploy wa-webhook-mobility

# 9. Monitor logs
supabase functions logs wa-webhook-mobility --follow
```

**Total Time for Critical Fixes**: 4-6 hours

---

## 📞 Support

**Questions? Check these files**:
- Full analysis: `WA_WEBHOOK_MOBILITY_DEEP_ANALYSIS.md`
- Function README: `supabase/functions/wa-webhook-mobility/README.md`
- Extraction notes: `supabase/functions/wa-webhook-mobility/EXTRACTION_NOTES.md`

**Testing**:
```bash
# Run all tests
cd supabase/functions/wa-webhook-mobility
deno test --allow-all

# Run specific test
deno test handlers/driver_onboarding.test.ts --allow-all
```

---

## 🎯 Success Criteria

**Phase 1 Complete When**:
- ✅ All RPC functions exist and callable
- ✅ No duplicate files in codebase
- ✅ No silent failures (all errors handled)
- ✅ Schema verification script passes
- ✅ Function deploys without errors

**Ready for Production When**:
- ✅ Phase 1 complete
- ✅ Test coverage >80%
- ✅ Integration tests passing
- ✅ Monitoring configured
- ✅ Rollback plan documented

---

*Created: 2025-11-25*  
*Last Updated: 2025-11-25*  
*Next Review: After Phase 1 completion*
