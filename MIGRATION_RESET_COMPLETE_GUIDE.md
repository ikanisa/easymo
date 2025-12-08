# Supabase Migration Reset - Complete Guide

## 🎯 What We Did

### 1. **Archived Old Migrations**
- Moved **136 old migration files** to `supabase/migrations/.archive/`
- Backed up your **10 new Dec 8-9 migrations** to `/tmp/`

### 2. **Created Baseline Migration**  
- Created `supabase/migrations/20251208173000_baseline.sql`
- This marks "everything before this point is already applied"

### 3. **Cleaned Local State**
- Only 1 migration file remains locally (the baseline)
- Your 10 new migrations are safely backed up in `/tmp/`

---

## ⚠️ CRITICAL NEXT STEP (You Must Do This)

The remote database still has 120+ migrations in its history table. You need to **wipe that history** so we can start fresh.

### **Option A: Use Supabase Dashboard (Easiest)**

1. **Go to**: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt
2. **Click**: SQL Editor (left sidebar)
3. **Paste and Run** this SQL:

```sql
TRUNCATE TABLE supabase_migrations.schema_migrations;
```

4. **Come back here** and run:
```bash
bash /tmp/restore_after_wipe.sh
```

---

### **Option B: Use psql (If You Have It)**

```bash
# Get your database password from Supabase dashboard
# Then run:
PGPASSWORD='your-db-password' psql \
  -h aws-0-us-east-1.pooler.supabase.com \
  -p 6543 \
  -d postgres \
  -U postgres.lhbowpbcpwoiparwnwgt \
  -c "TRUNCATE TABLE supabase_migrations.schema_migrations;"

# Then restore:
bash /tmp/restore_after_wipe.sh
```

---

## 📦 What Gets Restored

After you run the wipe + restoration script:

### **Migrations That Will Be Pushed:**
1. `20251208173000_baseline.sql` - Empty baseline (marks current state)
2. `20251208150000_consolidate_mobility_tables.sql` - Your new work
3. `20251208151500_create_unified_ocr_tables.sql` - Your new OCR tables
4. `20251208160000_drop_deprecated_mobility_tables.sql` - Cleanup
5. `20251208163000_rollback_duplicate_tables.sql`
6. `20251209090000_fix_mobility_trips_alignment.sql`
7. `20251209093000_remove_mobility_match_table.sql`
8. `20251209100000_drop_legacy_profile_tables.sql`
9. `20251209101500_drop_mobility_intent_cache.sql`
10. `20251209102000_drop_mobility_matches.sql`
11. `20251209120000_fix_matching_table_mismatch.sql`

**Total: 11 migrations** (1 baseline + 10 new)

---

## 🗂️ File Locations

| Item | Location | Count |
|------|----------|-------|
| **Archived old migrations** | `supabase/migrations/.archive/` | 136 files |
| **Current baseline** | `supabase/migrations/20251208173000_baseline.sql` | 1 file |
| **Backed up new migrations** | `/tmp/20251208*.sql`, `/tmp/20251209*.sql` | 10 files |
| **Restoration script** | `/tmp/restore_after_wipe.sh` | Ready to run |

---

## ✅ After Restoration, You'll Have

- **Clean migration history** matching local and remote
- **Your 10 new migrations** successfully deployed
- **Old migrations** safely archived for reference
- **No more sync errors** when running `supabase db push`

---

## 🚨 Troubleshooting

### If `restore_after_wipe.sh` fails:

Run steps manually:
```bash
cd /Users/jeanbosco/workspace/easymo

# Restore your new migrations
cp /tmp/20251208*.sql /tmp/20251209*.sql supabase/migrations/

# Push to remote
supabase db push
```

### If you need to rollback:

Your old migrations are in `.archive/`, just move them back:
```bash
mv supabase/migrations/.archive/*.sql supabase/migrations/
```

---

## 📝 Summary

**Before**: 136 local migrations + 120 remote migrations = chaos  
**After**: 11 local migrations = 11 remote migrations = ✨ harmony ✨

Your database schema is **unchanged** - we only cleaned up the migration tracking system.

---

**Ready?** Run the SQL in Supabase Dashboard, then execute `/tmp/restore_after_wipe.sh`
