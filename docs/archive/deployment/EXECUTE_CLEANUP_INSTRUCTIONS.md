# Execute Database Cleanup - Instructions

**Status**: Ready for manual execution via Supabase Dashboard  
**Reason**: Supabase CLI connection issues

---

## ✅ Quick Execution Steps

### Method 1: Via Supabase Dashboard (RECOMMENDED)

1. **Open Supabase Dashboard**:
   - URL: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt
   - Navigate to: **SQL Editor**

2. **Create New Query**

3. **Copy & Paste** the contents of `combined_cleanup_migration.sql`
   - File location: `/Users/jeanbosco/workspace/easymo-/combined_cleanup_migration.sql`
   - Or copy from the sections below

4. **Click RUN**

5. **Verify** results in the output panel

---

## 📋 What Will Execute

### Phase 3: Add Missing Columns (First)
- Adds columns to waiter_conversations, waiter_messages, waiter_orders
- Adds columns to businesses, menu_items, menu_categories
- Creates performance indexes
- **Risk**: VERY LOW (only adds columns)

### Phase 1: Careful Deletion (Second)
- Checks row counts before deleting
- Deletes ONLY empty duplicate tables
- Logs all actions to database_cleanup_audit
- **Risk**: LOW (skips if data exists)

---

## 🔍 Verification Queries

After execution, run these queries to verify:

### Check Audit Log:
```sql
SELECT * FROM database_cleanup_audit 
WHERE phase IN ('Phase 1', 'Phase 3')
ORDER BY executed_at DESC;
```

### Check Table Count:
```sql
-- Before: 191 tables
-- After: 181-188 tables (depends on which were empty)
SELECT COUNT(*) as total_tables
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';
```

### Verify New Columns:
```sql
-- Check waiter_conversations has new columns
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'waiter_conversations'
  AND column_name IN ('language', 'platform', 'metadata', 'wa_thread_id', 'business_id')
ORDER BY column_name;

-- Should show 5 rows
```

### Check Deleted Tables:
```sql
-- These tables should NOT exist if they were empty:
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('legacy_customer_profile', 
                    'bar_number_canonicalization_conflicts',
                    'whatsapp_home_menu_items',
                    'business', 'items', 'payments',
                    'carts', 'cart_items',
                    'ai_conversations', 'ai_messages',
                    'agent_chat_sessions', 'agent_chat_messages');
```

---

## 📊 Expected Results

### Success Indicators:
✅ Phase 3 completes with "COMMIT" message  
✅ Phase 1 shows notices for deleted tables  
✅ Audit log has entries for both phases  
✅ Table count reduced by 3-10 tables  
✅ New columns visible in table schema  

### What You'll See:
```
NOTICE: Dropping legacy_customer_profile (X rows)
NOTICE: ✓ Dropped legacy_customer_profile
NOTICE: Dropping bar_number_canonicalization_conflicts (X rows)
NOTICE: ✓ Dropped bar_number_canonicalization_conflicts
...
COMMIT
```

### If Tables Have Data:
```
WARNING: items table has X rows - SKIPPING! Check if different from menu_items
```
This is SAFE - the script will skip deletion and continue.

---

## 🚨 Troubleshooting

### If Execution Fails:

1. **Check for syntax errors** in SQL Editor output
2. **Run Phase 3 alone first**:
   - Copy only Phase 3 SQL from `20251113171400_phase3_add_missing_columns.sql`
   - Execute
   - Verify success
3. **Then run Phase 1**:
   - Copy only Phase 1 SQL from `20251113173000_careful_deletion_phase1.sql`
   - Execute
   - Verify success

### If You Need to Rollback:

Phase 3 (rarely needed):
```sql
-- Drop added columns if needed
ALTER TABLE waiter_conversations DROP COLUMN IF EXISTS language CASCADE;
ALTER TABLE waiter_conversations DROP COLUMN IF EXISTS platform CASCADE;
-- etc...
```

Phase 1 (cannot undo):
- Tables deleted cannot be restored without backup
- But the script only deletes empty tables, so no data loss

---

## 📁 File Locations

All files are in: `/Users/jeanbosco/workspace/easymo-/`

- `combined_cleanup_migration.sql` - Single file with both phases
- `supabase/migrations/20251113171400_phase3_add_missing_columns.sql` - Phase 3 only
- `supabase/migrations/20251113173000_careful_deletion_phase1.sql` - Phase 1 only

---

## ✅ Final Checklist

Before executing:
- [ ] Opened Supabase Dashboard SQL Editor
- [ ] Ready to paste SQL
- [ ] Understand Phase 3 adds columns (safe)
- [ ] Understand Phase 1 deletes only empty tables (safe)

After executing:
- [ ] Verified audit log has entries
- [ ] Checked table count decreased
- [ ] Verified new columns exist
- [ ] Tested Waiter AI PWA still works

---

## 🎯 Execute Now

1. Open: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql
2. Click "New query"
3. Paste contents of `combined_cleanup_migration.sql`
4. Click "RUN"
5. Wait for completion (~30-60 seconds)
6. Verify results!

**The migrations are safe and ready to execute!**

