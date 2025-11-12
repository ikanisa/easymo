# Migration Cleanup & Fix Plan

**Date:** 2025-11-12  
**Status:** Ready for execution

---

## Current Situation

- **Local migrations:** 133 remaining (after deleting 11 deprecated)
- **Remote migrations:** 138 successfully applied
- **Deleted:** 11 migrations for deprecated features (baskets, saccos, campaigns, momo_sms_inbox)
- **Location:** Broken migrations in `supabase/migrations-broken/`
- **Deleted migrations:** `supabase/migrations-deleted/` (11 files)

---

## What Was Deleted (Step 1 Completed ✅)

### Basket-related (3 migrations):
- ✅ `20251010101000_phase1_archive_legacy_tables.sql`
- ✅ `20251011130000_phase5_drop_archive_tables.sql`
- ✅ `20260304120000_remove_baskets_vouchers.sql`

### SACCO-related (3 migrations):
- ✅ `20251031134020_contribution_cycle_helper.sql`
- ✅ `20251031135000_sacco_loan_endorsements.sql`
- ✅ `20251031135010_sacco_loan_endorsements_rls.sql`

### Campaign-related (3 migrations):
- ✅ `20251030100000_campaigns_uuid_rework.sql`
- ✅ `20251130090000_remove_orders_templates_campaigns.sql`
- ✅ `20251205100000_admin_marketing_fixture_support.sql`

### Other deprecated (2 migrations):
- ✅ `20251031134015_momo_inbox_tracking.sql` (momo_sms_inbox)
- ✅ `20250215093000_add_business_tags.sql` (references non-existent businesses table)

---

## Remaining Issues

### Still Need Attention:

1. **Mixed migrations with basket/sacco/campaign references**
   - `20251003160000_phase_a_legacy.sql` (666 lines, has baskets + valid tables)
   - `20251017220824_remote_schema.sql` (has DROP statements for baskets_reminders)
   - `20251030140000_enable_rls_lockdown.sql` (has RLS for saccos/campaigns)
   - `20251101120000_loans_reminders_extension.sql` (has sacco + basket refs)

2. **SQL syntax errors**
   - `20251001140000_rls_policies.sql` - auth.role() syntax error
   - `20251018143000_storage_bucket_setup.sql` - storage.create_bucket() syntax
   - `20251021033131_brokerai_insurance_and_mobility.sql` - loc column issue
   - `20251023160010_agent_management.sql` - agent_id column issue
   - `20251026110000_business_categories.sql` - duplicate trigger

3. **Remote has additional migrations** (not in local)
   Migrations that exist on remote but not locally - these may fix the issues above.

---

## Recommended Solution: Pull from Remote

### Why Pull from Remote?

1. ✅ **Remote is working** - 138 migrations successfully applied
2. ✅ **Remote has more migrations** - May contain fixes for local issues
3. ✅ **Fastest path** - Avoids manually fixing 133+ migrations
4. ✅ **Source of truth** - Remote is production database
5. ✅ **Already linked** - Project lhbowpbcpwoiparwnwgt connected

### Why NOT to manually fix?

1. ❌ **Time-consuming** - Would need to manually clean basket/sacco/campaign code from dozens of migrations
2. ❌ **Error-prone** - Easy to miss references, break dependencies
3. ❌ **Divergence risk** - Local and remote would continue to differ
4. ❌ **Unknown unknowns** - Remote may have migrations with critical fixes

---

## Execution Plan (RECOMMENDED)

### Option A: Clean Pull from Remote ⭐ RECOMMENDED

```bash
cd /Users/jeanbosco/workspace/easymo-

# 1. Backup all broken migrations (already done, but confirm)
ls -la supabase/migrations-broken/ | head -10
ls -la supabase/migrations-deleted/ | head -10

# 2. Ensure migrations directory is empty
rm -rf supabase/migrations/*.sql 2>/dev/null
ls supabase/migrations/

# 3. Pull schema from remote (this will regenerate migrations from remote DB)
supabase db pull

# 4. Verify migrations pulled
ls -la supabase/migrations/

# 5. Start Supabase
supabase start

# 6. Verify it's working
supabase status
```

**Expected outcome:** 
- Fresh migration files generated from working remote schema
- No basket/sacco/campaign references (since they're not in remote DB)
- All tables properly created in correct order
- Supabase starts successfully

---

### Option B: Manual Migration Repair (NOT RECOMMENDED)

If you insist on keeping local migrations, you would need to:

1. ✅ **Done:** Delete 11 pure deprecated migrations
2. ⏳ **TODO:** Clean basket/sacco/campaign code from 20+ mixed migrations
3. ⏳ **TODO:** Fix 6+ SQL syntax errors
4. ⏳ **TODO:** Resolve table dependency issues
5. ⏳ **TODO:** Test each migration individually
6. ⏳ **TODO:** Handle remote-local divergence

**Estimated time:** 6-8 hours  
**Risk:** High - May discover more issues

---

## Post-Cleanup Steps (After Option A)

### 1. Verify Clean State
```bash
# Check no basket/sacco/campaign tables exist
supabase db diff

# Check tables that SHOULD exist
psql $DATABASE_URL -c "\dt public.*" | grep -E "profiles|businesses|wallet|shops|orders|trips|drivers|passengers"
```

### 2. Verify Missing Tables Are Created
Based on earlier analysis, ensure these exist:
- ✅ `profiles`
- ✅ `businesses` (with tags column)
- ✅ `wallet_accounts`, `wallet_transactions`, `wallet_earn_actions`, `wallet_redeem_options`
- ✅ `shops`, `shop_products`
- ✅ `trips`, `drivers_available`, `passengers_requests`
- ✅ `orders`, `menus`, `menu_items`
- ✅ `notifications`, `admin_audit_log`
- ✅ `insurance_media_queue`, `insurance_leads`

### 3. Create New Migration for Any Missing Features
If you need new tables/columns that remote doesn't have:
```bash
supabase migration new add_missing_features
# Edit the new migration file
supabase db push
```

---

## Cleanup Summary

### What Happens to Deleted Files?

- **migrations-broken/**: 133 files - Archive these (DO NOT DELETE)
- **migrations-deleted/**: 11 files - Can be permanently deleted
- **migrations/**: Will be repopulated by `supabase db pull`

### Archive Command
```bash
# Create timestamped archive
tar -czf supabase-migrations-archive-20251112.tar.gz \
  supabase/migrations-broken/ \
  supabase/migrations-deleted/ \
  MIGRATION_STATUS_REPORT.md \
  MIGRATION_FIX_PLAN.md

# Move archive to safe location
mv supabase-migrations-archive-20251112.tar.gz ~/backups/

# Can now delete the folders (after confirming remote works)
# rm -rf supabase/migrations-broken/
# rm -rf supabase/migrations-deleted/
```

---

## Decision Required

**Choose one:**

- [ ] **Option A:** Pull from remote (RECOMMENDED - 10 minutes)
- [ ] **Option B:** Manual repair (NOT RECOMMENDED - 6-8 hours)

**If Option A, execute:**
```bash
cd /Users/jeanbosco/workspace/easymo-
supabase db pull
supabase start
supabase status
```

**If Option B, next steps:**
1. Manually clean 20251003160000_phase_a_legacy.sql (remove all basket code)
2. Clean 20251017220824_remote_schema.sql (remove basket/sacco DROPs)
3. Fix 20251001140000_rls_policies.sql (auth.role() syntax)
4. Fix 20251018143000_storage_bucket_setup.sql (storage API)
5. Continue for 20+ more migrations...

---

## Questions to Consider

1. **Do you have any local-only changes** that haven't been pushed to remote?
   - If YES → Need to identify and re-create them after pulling
   - If NO → Safe to pull from remote

2. **Is the remote database up-to-date** with latest schema?
   - Check last migration date: 2026-03-04
   - If recent → Remote is current

3. **Do you need to preserve migration history** for audit purposes?
   - Archive already created: `migrations-broken/` and `migrations-deleted/`
   - Can restore if needed

---

## Next Steps

**Awaiting your decision on Option A vs Option B.**

Once decided, I'll execute the chosen approach and verify Supabase starts successfully.

---

**Files:**
- This plan: `/Users/jeanbosco/workspace/easymo-/MIGRATION_FIX_PLAN.md`
- Status report: `/Users/jeanbosco/workspace/easymo-/MIGRATION_STATUS_REPORT.md`
- Broken migrations: `/Users/jeanbosco/workspace/easymo-/supabase/migrations-broken/` (133 files)
- Deleted migrations: `/Users/jeanbosco/workspace/easymo-/supabase/migrations-deleted/` (11 files)
