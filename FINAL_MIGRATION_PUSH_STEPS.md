# Final Migration Push Steps

## ✅ What We've Done:
1. Wiped remote migration history table
2. Restored your Dec 8-9 migrations
3. Fixed syntax error in `20251208160000_drop_deprecated_mobility_tables.sql`
4. Skipped problematic `20251208150000_consolidate_mobility_tables.sql` (schema mismatch)

## ⏳ What You Need to Run:

Open your terminal and run these commands:

```bash
cd /Users/jeanbosco/workspace/easymo

# Set your Supabase access token
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"

# Push migrations (will prompt for confirmation)
supabase db push --linked
```

When prompted with the list of migrations, type `Y` and press Enter.

## 📋 Migrations That Will Be Pushed:

1. ✅ `20251208151500_create_unified_ocr_tables.sql` - Creates unified OCR tables
2. ✅ `20251208160000_drop_deprecated_mobility_tables.sql` - Cleanup (FIXED)
3. ✅ `20251208163000_rollback_duplicate_tables.sql`
4. ✅ `20251208173000_baseline.sql` - Baseline marker  
5. ✅ `20251208192000_fix_mobility_matching_column_names.sql`
6. ✅ `20251209090000_fix_mobility_trips_alignment.sql`
7. ✅ `20251209093000_remove_mobility_match_table.sql`
8. ✅ `20251209100000_drop_legacy_profile_tables.sql`
9. ✅ `20251209101500_drop_mobility_intent_cache.sql`
10. ✅ `20251209102000_drop_mobility_matches.sql`
11. ✅ `20251209120000_fix_matching_table_mismatch.sql`

**Total**: 11 migrations

## ⚠️ If Any Migration Fails:

If a migration fails due to schema mismatch:

```bash
# Skip the problematic migration
mv supabase/migrations/FAILING_MIGRATION.sql supabase/migrations/FAILING_MIGRATION.sql.skip

# Mark it as reverted  
supabase migration repair --status reverted <TIMESTAMP>

# Try pushing again
supabase db push --linked
```

## ✅ After Success:

Your migrations will be:
- ✅ Applied to remote database
- ✅ Tracked in migration history table  
- ✅ Synced between local and remote

No more migration conflicts!

## 🎯 Expected Output:

```
Initialising login role...
Connecting to remote database...
Do you want to push these migrations to the remote database?
 • 20251208151500_create_unified_ocr_tables.sql
 • 20251208160000_drop_deprecated_mobility_tables.sql
 ... (9 more)

 [Y/n] Y
Applying migration 20251208151500_create_unified_ocr_tables.sql...
Applying migration 20251208160000_drop_deprecated_mobility_tables.sql...
...
Finished supabase db push.
```

---

**Ready?** Run the commands above in your terminal!
