# MOBILITY CONSOLIDATION - QUICK START GUIDE

**Read this FIRST before running anything!**

---

## TL;DR - What's Wrong?

You have **3 different trip table schemas** running simultaneously:
- `rides_trips` (legacy - referenced in code but maybe doesn't exist)
- `mobility_trips` (V2 - created Dec 4)
- `trips` (canonical - created Dec 8)

Plus **2 duplicate match tables**:
- `mobility_matches` (references `trips`)
- `mobility_trip_matches` (references `mobility_trips`)

**Result**: Trips get inserted into wrong tables, queries read from empty tables, data lost.

---

## Solution: 3-Step Process

### Step 1: Assessment (RUN THIS FIRST)

```bash
# Check what actually exists
psql $DATABASE_URL -f scripts/mobility_assessment.sql > mobility_assessment_report.txt

# Review the report
cat mobility_assessment_report.txt
```

This will tell you:
- Which tables exist
- How much data is in each
- Which foreign keys need updating
- Which functions need fixing

### Step 2: Migrate & Fix (ONLY AFTER REVIEWING REPORT)

```bash
# Backup first (CRITICAL)
./scripts/backup_mobility_tables.sh

# Run consolidation
supabase db push  # Apply new migration
supabase db reset --db-url $DATABASE_URL  # If needed

# OR manually:
psql $DATABASE_URL -f supabase/migrations/20251208150000_consolidate_mobility_tables.sql
```

### Step 3: Verify & Cleanup

```bash
# Test that everything works
./scripts/verify_mobility_consolidation.sh

# If all tests pass, drop old tables
psql $DATABASE_URL -f supabase/migrations/20251208160000_drop_deprecated_mobility_tables.sql
```

---

## Files Created

I've created these files for you:

### Documentation
- `MOBILITY_DATABASE_CONSOLIDATION_PLAN.md` - Full detailed plan
- `MOBILITY_CONSOLIDATION_QUICK_START.md` - This file

### Scripts (will create next)
- `scripts/mobility_assessment.sql` - Assessment queries
- `scripts/backup_mobility_tables.sh` - Backup script
- `scripts/verify_mobility_consolidation.sh` - Test script

### Migrations (will create next)
- `supabase/migrations/20251208150000_consolidate_mobility_tables.sql` - Main consolidation
- `supabase/migrations/20251208160000_drop_deprecated_mobility_tables.sql` - Cleanup

---

## Decision Points

Based on assessment report, you'll need to decide:

1. **Does `rides_trips` exist?**
   - YES → Migrate data to `trips`
   - NO → Skip that migration

2. **Does `mobility_trips` have data?**
   - YES → Migrate to `trips`
   - NO → Just drop it

3. **Which match table is used?**
   - `mobility_matches` → Keep it
   - `mobility_trip_matches` → Migrate & drop

---

## Safety Checks

Before running migrations:

✅ **Backup created**  
✅ **Assessment report reviewed**  
✅ **Tested in dev/staging first**  
✅ **Team notified of downtime window**  
✅ **Rollback plan ready**  

---

## Expected Results

**Before**: 15+ tables, fragmented data, trips lost  
**After**: 10 tables, single source of truth, 100% capture rate

**Deployment time**: 2-4 hours  
**Risk level**: Medium (with proper backups: Low)

---

## Next Steps

1. Read full plan: `MOBILITY_DATABASE_CONSOLIDATION_PLAN.md`
2. Run assessment: `psql $DATABASE_URL -f scripts/mobility_assessment.sql`
3. Review results with team
4. Execute consolidation (backup first!)
5. Monitor for 24 hours

---

## Questions?

Check the detailed plan or:
- Search for "CRITICAL" in the plan for must-do items
- Search for "DUPLICATE" for redundancy issues
- Search for "RECOMMENDATION" for specific actions

