# Buy & Sell Agent Migration - Deployment Guide

**Migration**: `20251210185001_consolidate_buy_sell_agent.sql`  
**Purpose**: Clean up duplicate agent slugs and menu items

---

## 🚀 How to Apply This Migration

### Option 1: Using Supabase CLI (Recommended)

```bash
# Apply to local database
supabase db push

# OR apply to remote database
supabase db push --linked

# Verify migration was applied
supabase db migrate list
```

### Option 2: Using psql

```bash
# Connect to database
psql $DATABASE_URL

# Run migration
\i supabase/migrations/20251210185001_consolidate_buy_sell_agent.sql

# Verify
SELECT slug, name, is_active FROM ai_agents WHERE slug = 'buy_sell';
```

### Option 3: Via Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `20251210185001_consolidate_buy_sell_agent.sql`
3. Paste and run
4. Check for success messages in output

---

## ✅ Post-Migration Verification

Run these queries to verify the migration succeeded:

```sql
-- 1. Check agent count (should be 1)
SELECT COUNT(*) as active_buy_sell_agents
FROM ai_agents
WHERE slug IN ('buy_sell', 'buy_and_sell', 'business_broker', 'marketplace')
  AND is_active = true;
-- Expected: 1

-- 2. Verify the agent details
SELECT slug, name, is_active, description
FROM ai_agents
WHERE slug = 'buy_sell';
-- Expected: 1 row with is_active = true

-- 3. Check menu items (should be 2)
SELECT key, name, is_active
FROM whatsapp_home_menu_items
WHERE key IN ('buy_sell_categories', 'business_broker_agent')
  AND is_active = true
ORDER BY key;
-- Expected: 2 rows

-- 4. Verify no old menu items remain
SELECT COUNT(*) as old_menu_items
FROM whatsapp_home_menu_items
WHERE key IN (
  'buy_and_sell_agent',
  'buy_sell_agent',
  'marketplace_agent',
  'broker_agent',
  'general_broker'
);
-- Expected: 0

-- 5. Check for any errors
SELECT * FROM ai_agents WHERE slug LIKE '%buy%' OR slug LIKE '%market%';
-- Expected: Only 'buy_sell' with is_active = true
```

---

## 🔍 Expected Migration Output

The migration will output several NOTICE messages:

```
NOTICE:  Found N agent(s) to clean up
NOTICE:  Menu items found: buy_sell_categories=1, business_broker_agent=1
NOTICE:  Final state: 1 active agent(s), 2 active menu item(s)
```

If you see WARNING messages:
- **"Some menu items are missing"** - The required menu items don't exist (needs manual fix)
- **"Expected exactly 1 active Buy & Sell agent"** - Multiple agents still active (investigate)
- **"Expected exactly 2 active menu items"** - Menu items count is wrong (investigate)

---

## ⚠️ Troubleshooting

### Issue: Migration fails with "relation does not exist"

**Solution**: Ensure you're connected to the correct database and that previous migrations have run.

```bash
# Check migration status
supabase db migrate list

# Apply pending migrations
supabase db push
```

### Issue: "Expected 1 agent but found 0"

**Solution**: The buy_sell agent was never created. The migration will create it automatically via `INSERT ... ON CONFLICT`.

### Issue: "Expected 2 menu items but found 0 or 1"

**Solution**: Menu items are missing. Check if migration `20251210085100_split_buy_sell_and_chat_agent.sql` was applied:

```sql
-- Check menu items
SELECT * FROM whatsapp_home_menu_items 
WHERE key IN ('buy_sell_categories', 'business_broker_agent');

-- If missing, they should be created by that migration
```

---

## 🔄 Rollback (If Needed)

This migration deletes data, so rollback requires restore from backup.

**Before running in production**:
1. Take a database snapshot/backup
2. Test on staging first
3. Verify all tests pass

**If you need to rollback**:
```bash
# Restore from backup
pg_restore -d $DATABASE_URL backup_file.dump

# OR manually recreate agents (not recommended)
```

---

## 📊 What Gets Changed

### Tables Modified
- `ai_agents` - Deletes 3-4 rows, ensures 1 active
- `whatsapp_home_menu_items` - Deletes 5+ old entries

### Data Deleted
- Agent slugs: `buy_and_sell`, `business_broker`, `marketplace`, `broker`
- Menu keys: `buy_and_sell_agent`, `marketplace_agent`, `broker_agent`, etc.

### Data Preserved
- Agent slug: `buy_sell` (kept and activated)
- Menu keys: `buy_sell_categories`, `business_broker_agent` (kept)

---

## 🎯 Success Criteria

After migration succeeds:
- ✅ Exactly 1 active Buy & Sell agent (slug: `buy_sell`)
- ✅ Exactly 2 active menu items
- ✅ No old agent slugs remain
- ✅ No old menu items remain
- ✅ Database comment added to `ai_agents` table

---

## 📞 Support

If you encounter issues:
1. Check the migration output for NOTICE/WARNING messages
2. Run verification queries (see above)
3. Check application logs for agent lookup errors
4. Refer to: `docs/features/BUY_SELL_CONSOLIDATION_ANALYSIS.md`

---

**Created**: 2025-12-10  
**Status**: Ready to apply  
**Risk Level**: Low (only affects inactive agents + duplicate menu items)
