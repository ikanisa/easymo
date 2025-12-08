# Mobility Tables Consolidation - Quick Reference

## 🎯 Goal
Eliminate "ride" naming, consolidate into canonical "trips" table architecture.

---

## 📊 Current State (BEFORE)

**9 Tables/Views:**
- trips (22 rows) ✅ KEEP
- ride_requests (0 rows) ❌ DELETE
- rides_driver_status (1 row) ❌ REPLACE
- ride_notifications (0 rows) 🔄 RENAME
- recurring_trips (0 rows) ✅ KEEP
- trip_payment_requests (0 rows) ✅ KEEP
- trip_status_audit (0 rows) ✅ KEEP
- mobility_trips_compat (view) ❌ DELETE
- pending_ride_requests_with_trips (view) ❌ DELETE

**10 Functions with "ride" naming** ❌ CONSOLIDATE

---

## 🎨 Proposed State (AFTER)

**5 Clean Tables:**
```
trips (canonical)
├── driver_status (new, replaces rides_driver_status)
├── trip_notifications (renamed from ride_notifications)
├── recurring_trips
├── trip_payment_requests
└── trip_status_audit
```

**3 Functions with "trip" naming:**
- match_drivers_for_trip_v2 ✅
- match_passengers_for_trip_v2 ✅
- update_driver_status (new)

---

## 🔄 Changes Summary

### DELETE (7 items)
- `ride_requests` table
- `rides_driver_status` table
- `mobility_trips_compat` view
- `pending_ride_requests_with_trips` view
- `apply_intent_rides*` functions (2)
- `rides_find_*` functions (2)
- `rides_search_*` functions (2)
- `ride_requests_set_updated_at` function

### RENAME (2 items)
- `ride_notifications` → `trip_notifications`
- `driver_id` column → `recipient_id`

### CREATE (1 item)
- `driver_status` table (migrates data from `rides_driver_status`)

---

## 📋 Migration Checklist

### Pre-Migration
- [ ] Review consolidation plan
- [ ] Backup database
- [ ] Check no active trips/drivers
- [ ] Test migration on staging

### Migration Steps
```bash
# 1. Create migration file
cat > supabase/migrations/20251209030000_consolidate_mobility_tables.sql

# 2. Push migration
cd supabase
supabase db push --linked

# 3. Verify tables
psql $DATABASE_URL -c "\dt *trip* *driver_status*"

# 4. Verify no "ride" tables remain
psql $DATABASE_URL -c "\dt *ride*"
```

### Post-Migration
- [ ] Update Edge Functions (13 files)
- [ ] Update TypeScript types
- [ ] Run tests
- [ ] Deploy edge functions
- [ ] Monitor logs for 24 hours

---

## 🚀 Deployment Order

1. **Database Migration** (10 min)
   - Create `driver_status` table
   - Migrate data from `rides_driver_status`
   - Rename `ride_notifications` → `trip_notifications`
   - Drop legacy tables/views
   - Drop deprecated functions

2. **Edge Function Updates** (30 min)
   - Update 13 TypeScript files
   - Replace table references
   - Replace function calls
   - Update types

3. **Deploy Edge Functions** (15 min)
   ```bash
   supabase functions deploy wa-webhook-mobility
   supabase functions deploy activate-recurring-trips
   supabase functions deploy recurring-trips-scheduler
   ```

4. **Verification** (15 min)
   - Test driver go online/offline
   - Test nearby search
   - Test notifications
   - Check logs

**Total Time:** ~70 minutes

---

## 🔍 Search & Replace Patterns

### In TypeScript Files
```typescript
// Old → New
ride_requests → trips
rides_driver_status → driver_status
ride_notifications → trip_notifications

// In notification context
driver_id → recipient_id

// Function calls
.from('rides_driver_status').upsert() → .rpc('update_driver_status')
.from('ride_notifications').insert() → .from('trip_notifications').insert()
```

### In SQL Files
```sql
-- Old → New
ride_requests → trips
rides_driver_status → driver_status
ride_notifications → trip_notifications
driver_id → recipient_id (in notifications context)
```

---

## ⚠️ Breaking Changes

**NONE** - All changes are backward compatible:
- Renaming maintains FK constraints
- Data migrated before deletion
- No API changes (edge functions updated together)

---

## 📈 Impact

**Before:**
- ❌ 9 tables (4 unused)
- ❌ Mixed "ride"/"trip" naming
- ❌ 10 functions (7 deprecated)
- ❌ Confusing architecture

**After:**
- ✅ 5 clean tables (all used)
- ✅ Consistent "trip" naming
- ✅ 3 modern functions
- ✅ Clear canonical architecture

**Performance:**
- ✅ Simpler queries (fewer joins)
- ✅ Better indexes (focused on active tables)
- ✅ Smaller database size

---

## 📚 Files to Update

### Edge Functions (13 files)
```
supabase/functions/wa-webhook-mobility/handlers/go_online.ts
supabase/functions/wa-webhook-mobility/handlers/nearby.ts
supabase/functions/wa-webhook-mobility/handlers/driver_response.ts
supabase/functions/wa-webhook-mobility/notifications/drivers.ts
supabase/functions/wa-webhook-mobility/handlers/schedule/booking.ts
supabase/functions/_shared/tool-executor.ts
supabase/functions/_shared/agent-orchestrator.ts
supabase/functions/_shared/agents/rides-insurance-logic.ts
supabase/functions/_shared/wa-webhook-shared/tools/rides-matcher.ts
supabase/functions/wa-webhook/domains/mobility/schedule.ts
supabase/functions/wa-webhook/domains/ai-agents/rides_agent.ts
supabase/functions/recurring-trips-scheduler/index.ts
supabase/functions/activate-recurring-trips/index.ts
```

### TypeScript Types
```
admin-app/src/v2/lib/supabase/database.types.ts
packages/shared/src/types/mobility.ts (if exists)
```

---

## ✅ Success Criteria

- [ ] No tables with "ride" in name
- [ ] No functions with "ride" in name  
- [ ] No columns with "driver_id" in trip_notifications
- [ ] All data migrated successfully
- [ ] All tests passing
- [ ] WhatsApp mobility flows working
- [ ] No errors in production logs

---

## 🆘 Rollback Plan

If issues occur:

```sql
-- Restore from backup
psql $DATABASE_URL < backup_before_consolidation.sql

-- Or revert migration
supabase migration repair --status reverted 20251209030000
```

**Better:** Fix forward - consolidation improves architecture.

---

## 📞 Support

**Full Documentation:** `MOBILITY_TABLES_CONSOLIDATION_PLAN.md`

**Migration File:** `supabase/migrations/20251209030000_consolidate_mobility_tables.sql`

**Status:** ⏳ Awaiting approval

---

**Last Updated:** 2025-12-09  
**Author:** GitHub Copilot CLI  
**Status:** Ready for review ✅
