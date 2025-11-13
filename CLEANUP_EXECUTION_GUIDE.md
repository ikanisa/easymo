# Database Cleanup - Execution Guide

**Date**: November 13, 2025  
**Database**: lhbowpbcpwoiparwnwgt  
**Status**: Ready to Execute

---

## Quick Start

### Recommended Execution Order

```bash
# 1. PHASE 3: Add Missing Columns (SAFEST - Run First)
./execute_phase3.sh

# 2. Verify Phase 3
psql "postgresql://postgres:sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  -c "SELECT * FROM database_cleanup_audit ORDER BY executed_at DESC LIMIT 5;"

# 3. PHASE 1: Delete Duplicates (After verifying Phase 3)
# Manual execution recommended - review each table first

# 4. PHASE 2: Merge Tables (Most complex - do last)
# Manual execution recommended - requires data migration
```

---

## Phase 3: Add Missing Columns (✅ READY)

**Status**: ✅ Safe to execute  
**Risk**: Very Low (only adds columns)  
**Execution Time**: ~30 seconds  
**Script**: `execute_phase3.sh`

### What It Does:
- Adds missing columns to `waiter_*` tables
- Adds business_id references
- Adds WhatsApp integration columns
- Creates indexes for performance
- NO DATA LOSS RISK

### Execute:
```bash
./execute_phase3.sh
```

### Verification:
```bash
# Check if columns were added
psql "postgresql://postgres:sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" << SQL
\d waiter_conversations
\d waiter_messages
\d waiter_orders
\d businesses
\d menu_items
SQL
```

---

## Phase 1: Delete Duplicates (⚠️ MANUAL REVIEW)

**Status**: ⚠️ Requires manual review before execution  
**Risk**: Medium (deletes tables)  
**Execution Time**: ~2 minutes  
**Script**: `supabase/migrations/cleanup_phase1_delete_duplicates.sql`

### Before Executing:
1. Review which tables have data:
```bash
psql "postgresql://postgres:sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" << SQL
SELECT 
  tablename,
  (SELECT COUNT(*) FROM table_name) as row_count
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('business', 'carts', 'cart_items', 'items', 'payments',
                    'ai_conversations', 'ai_messages', 'agent_chat_sessions',
                    'legacy_customer_profile');
SQL
```

2. Backup database first:
```bash
pg_dump "postgresql://postgres:sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  > backup_before_phase1_$(date +%Y%m%d_%H%M%S).sql
```

3. Execute with caution:
```bash
psql "postgresql://postgres:sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  -f supabase/migrations/cleanup_phase1_delete_duplicates.sql
```

### Tables to Delete:
- `business` (if duplicate of `businesses`)
- `carts` (use `draft_orders` instead)
- `cart_items` (use `draft_order_items`)
- `items` (use `menu_items`)
- `payments` (use `transactions`)
- `ai_conversations` → merge to `agent_conversations`
- `ai_messages` → merge to `agent_messages`
- `agent_chat_sessions` → merge to `agent_sessions`
- `legacy_customer_profile` (marked as legacy)

---

## Phase 2: Merge Tables (⚠️ COMPLEX)

**Status**: ⚠️ Most complex - requires careful execution  
**Risk**: High (data migration)  
**Execution Time**: ~5-10 minutes  
**Script**: `supabase/migrations/cleanup_phase2_merge_tables.sql`

### Merges:
1. **shops → businesses** (with type='shop')
2. **bars → businesses** (with type='bar')
3. **carts → draft_orders**
4. **ai_* → agent_* tables**
5. **config tables → configurations**

### Before Executing:
1. **BACKUP CRITICAL**:
```bash
pg_dump "postgresql://postgres:sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  > backup_before_phase2_$(date +%Y%m%d_%H%M%S).sql
```

2. Test on staging first (recommended)

3. Review data counts:
```sql
SELECT 'shops' as table_name, COUNT(*) as rows FROM shops
UNION ALL
SELECT 'bars', COUNT(*) FROM bars
UNION ALL
SELECT 'carts', COUNT(*) FROM carts
UNION ALL
SELECT 'businesses', COUNT(*) FROM businesses;
```

4. Execute:
```bash
psql "postgresql://postgres:sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  -f supabase/migrations/cleanup_phase2_merge_tables.sql
```

---

## Post-Execution Verification

### Check Audit Log:
```sql
SELECT * FROM database_cleanup_audit 
ORDER BY executed_at DESC;
```

### Count Tables Before/After:
```sql
-- Before: 191 tables
-- After: Should be ~130-140 tables

SELECT COUNT(*) as total_tables
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';
```

### Verify Waiter AI Tables:
```sql
-- Check waiter_conversations has new columns
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'waiter_conversations'
ORDER BY ordinal_position;

-- Check indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename LIKE 'waiter_%';
```

### Test Admin Panel:
1. Open admin panel
2. Check businesses list
3. Check orders list
4. Check Waiter AI monitoring

### Test WhatsApp Flow:
1. Send WhatsApp message
2. Verify conversation created
3. Check wa_thread_id populated

---

## Rollback Procedures

### If Phase 3 Has Issues:
```sql
-- Drop added columns (rarely needed)
ALTER TABLE waiter_conversations DROP COLUMN IF EXISTS language;
ALTER TABLE waiter_conversations DROP COLUMN IF EXISTS platform;
-- etc...
```

### If Phase 1 Deletes Wrong Tables:
```bash
# Restore from backup
psql "postgresql://postgres:sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  < backup_before_phase1_YYYYMMDD_HHMMSS.sql
```

### If Phase 2 Data Migration Fails:
```bash
# Restore from backup
psql "postgresql://postgres:sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  < backup_before_phase2_YYYYMMDD_HHMMSS.sql
```

---

## Files Created

1. `execute_phase3.sh` - Quick execution script for Phase 3
2. `supabase/migrations/20251113171400_phase3_add_missing_columns.sql` - Phase 3 migration
3. `supabase/migrations/cleanup_phase1_delete_duplicates.sql` - Phase 1 script
4. `supabase/migrations/cleanup_phase2_merge_tables.sql` - Phase 2 script
5. `SUPABASE_DATABASE_DEEP_REVIEW.md` - Complete analysis document

---

## Recommended Approach

### Conservative (Safest):
1. ✅ Run Phase 3 only
2. Test for 1-2 days
3. Then consider Phase 1
4. Test again
5. Finally Phase 2 (if needed)

### Aggressive (Faster):
1. Backup database
2. Run Phase 3
3. Run Phase 1
4. Test thoroughly
5. Run Phase 2 if no issues

### My Recommendation:
**Start with Phase 3 only.** It's safe, adds needed functionality, and has zero risk.

---

## Current Status

- ✅ Phase 3 migration created and ready
- ✅ Execution script created
- ⏳ Waiting for Phase 3 execution
- ⏳ Phase 1 pending review
- ⏳ Phase 2 pending Phase 1 completion

---

## Support

If you encounter issues:
1. Check `database_cleanup_audit` table for logs
2. Review Supabase logs in dashboard
3. Check error messages in terminal
4. Restore from backup if needed

---

**Ready to execute Phase 3!**

Run: `./execute_phase3.sh`
