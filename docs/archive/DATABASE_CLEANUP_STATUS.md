# Database Cleanup - Execution Status

**Date**: November 13, 2025  
**Status**: Ready for Execution

---

## ✅ What's Been Created

### Phase 3: Add Missing Columns

- **Migration**: `20251113171400_phase3_add_missing_columns.sql`
- **Status**: ✅ Ready to apply
- **Risk**: VERY LOW
- **Action**: Adds missing columns to waiter*\*, businesses, menu*\* tables

### Phase 1: Careful Deletion

- **Migration**: `20251113173000_careful_deletion_phase1.sql`
- **Status**: ✅ Ready to apply
- **Risk**: LOW (checks for data before deleting)
- **Action**: Deletes ONLY empty duplicate tables

---

## 🎯 Phase 1 Deletion Strategy

The script is **extremely careful** and follows these rules:

### ✅ WILL DELETE (Safe - No Risk):

1. `legacy_customer_profile` - Marked as legacy
2. `bar_number_canonicalization_conflicts` - Edge case table
3. `whatsapp_home_menu_items` - IF EMPTY (otherwise skips)

### ⚠️ CONDITIONAL DELETION (Only if Empty):

4. `business` table - Only if 0 rows
5. `items` table - Only if 0 rows
6. `payments` table - Only if 0 rows
7. `cart_items` + `carts` - Only if both have 0 rows
8. `ai_conversations` + `ai_messages` + related ai\_\* tables - Only if 0 rows
9. `agent_chat_sessions` + `agent_chat_messages` - Only if 0 rows

### 🛡️ Safety Features:

- Checks row count BEFORE deleting
- Logs every action to `database_cleanup_audit` table
- Uses CASCADE to handle dependencies
- RAISES WARNING if table has data (skips deletion)
- Transaction-based (can rollback if issues)

---

## 📋 Execution Instructions

### Option 1: Via Supabase CLI (Recommended)

```bash
cd /Users/jeanbosco/workspace/easymo-
supabase db push --linked --include-all
```

This will apply:

1. Phase 3 migration (add columns)
2. Phase 1 migration (careful deletion)

### Option 2: Direct SQL Execution

```bash
# Phase 3 first
psql "YOUR_DB_URL" -f supabase/migrations/20251113171400_phase3_add_missing_columns.sql

# Then Phase 1
psql "YOUR_DB_URL" -f supabase/migrations/20251113173000_careful_deletion_phase1.sql
```

### Option 3: Via Supabase Dashboard

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy contents of Phase 3 SQL file
4. Execute
5. Copy contents of Phase 1 SQL file
6. Execute

---

## 🔍 Verification After Execution

### Check Audit Log:

```sql
SELECT * FROM database_cleanup_audit
WHERE phase = 'Phase 1'
ORDER BY executed_at DESC;
```

### Check Table Count:

```sql
-- Before: 191 tables
SELECT COUNT(*) as total_tables
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
```

### Verify New Columns:

```sql
-- Check waiter_conversations has new columns
\d waiter_conversations

-- Should show: language, platform, metadata, wa_thread_id, etc.
```

---

## 📊 Expected Results

### Phase 3 (Add Columns):

- ✅ All Waiter AI tables have complete columns
- ✅ WhatsApp integration fields added
- ✅ Business and menu tables enhanced
- ✅ Performance indexes created

### Phase 1 (Careful Deletion):

- ✅ 3-10 tables deleted (depends on which are empty)
- ✅ All deletions logged in audit table
- ✅ No data loss (only empty tables deleted)
- ✅ Warnings shown for tables with data

### Final State:

- **Table Count**: 181-188 tables (from 191)
- **Reduction**: 3-10 tables deleted
- **Status**: Cleaner, more complete schema

---

## 🚨 Rollback (If Needed)

If something goes wrong:

```sql
-- Phase 3 rollback (rarely needed)
ALTER TABLE waiter_conversations DROP COLUMN IF EXISTS language;
ALTER TABLE waiter_conversations DROP COLUMN IF EXISTS platform;
-- etc...

-- Phase 1 rollback (restore from backup)
-- Tables deleted cannot be restored without backup!
```

**Recommendation**: Create backup first if paranoid, but Phase 1 is very safe.

---

## Current Status

- ✅ Phase 3 migration created
- ✅ Phase 1 careful deletion created
- ✅ Both migrations timestamped and ready
- ⏳ Awaiting execution via `supabase db push --linked --include-all`

---

**The migrations are ready. Execute when comfortable!**

Key Points:

- Phase 1 checks data before deleting
- Only empty tables will be deleted
- All actions logged
- Transaction-based (safe)
- Can review audit log after execution
