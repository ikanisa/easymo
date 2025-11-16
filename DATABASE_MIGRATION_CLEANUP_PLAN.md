# Database Migration Cleanup Plan

**Date:** 2025-11-14  
**Status:** 🔴 CRITICAL - 254 migration files, conflicts detected

## 🚨 Current Situation

### Problem:
- **254 migration files** in supabase/migrations/
- **115+ migrations** pending but conflict with current schema
- Many duplicate/superseded migrations from development
- Tables already exist causing conflicts
- Column mismatches in RLS policies

### Impact:
- ❌ Cannot push new migrations
- ⚠️ Database schema drift from migration history
- ✅ Current system works (but fragile)

## 🎯 Cleanup Strategy

### Phase 1: Capture Current State (SAFE)
**Goal:** Create snapshot of working production schema

```bash
# 1. Export current schema (structure only, no data)
supabase db dump --schema-only > current_production_schema.sql

# 2. Document applied migrations
supabase migration list > applied_migrations.txt

# 3. Backup migration folder
cp -r supabase/migrations supabase/migrations.backup
```

### Phase 2: Archive Old Migrations
**Goal:** Clean up migration folder while preserving history

```bash
# Create archive directory
mkdir -p supabase/migrations_archive/

# Move all old migrations to archive
mv supabase/migrations/*.sql supabase/migrations_archive/

# Keep special files
mv supabase/migrations_archive/.keep supabase/migrations/
mv supabase/migrations_archive/.hygiene_allowlist supabase/migrations/
```

### Phase 3: Create Clean Baseline Migration
**Goal:** Single migration that represents current production state

```sql
-- supabase/migrations/20251114120000_baseline_production_schema.sql
BEGIN;

-- This migration represents the current production state
-- All tables, functions, policies as they exist in production

-- Core Tables (already exist, this is documentation)
-- business, business_owners, business_whatsapp_numbers
-- profiles, contacts, trips, etc.

-- Mark as baseline - no actual changes
SELECT 'Baseline migration - schema already applied' as note;

COMMIT;
```

### Phase 4: Reset Migration History
**Goal:** Align migration history with actual database state

```bash
# Option A: Repair migration history (RECOMMENDED)
supabase db push --repair

# Option B: Manual sync
# 1. Mark baseline as applied in remote
# 2. Start fresh from clean slate
```

### Phase 5: Going Forward
**Goal:** Clean migration practices

```bash
# New migrations follow pattern:
# YYYYMMDDHHMMSS_descriptive_name.sql

# Each migration:
# 1. Wrapped in BEGIN/COMMIT
# 2. Idempotent (IF NOT EXISTS)
# 3. Single purpose
# 4. Tested locally first
```

## 📋 Detailed Cleanup Steps

### Step 1: Backup Everything
```bash
cd /Users/jeanbosco/workspace/easymo-

# Backup migrations
tar -czf migrations_backup_$(date +%Y%m%d).tar.gz supabase/migrations/

# Backup database (structure)
supabase db dump --schema-only > schema_backup_$(date +%Y%m%d).sql

# Commit backup
git add migrations_backup*.tar.gz schema_backup*.sql
git commit -m "backup: Database migrations and schema before cleanup"
git push
```

### Step 2: Analyze Current Schema
```bash
# Get list of applied migrations in production
supabase migration list > applied_migrations.txt

# Get current table list
psql $DATABASE_URL -c "\dt public.*" > current_tables.txt

# Compare with migration files
ls -1 supabase/migrations/*.sql | wc -l  # 254 files
cat applied_migrations.txt | wc -l       # ??? applied
```

### Step 3: Archive Old Migrations
```bash
# Create archive
mkdir -p supabase/migrations_archive/$(date +%Y%m%d)

# Move all migrations to archive
mv supabase/migrations/*.sql supabase/migrations_archive/$(date +%Y%m%d)/

# Restore essential files
mv supabase/migrations_archive/$(date +%Y%m%d)/.keep supabase/migrations/
mv supabase/migrations_archive/$(date +%Y%m%d)/.hygiene_allowlist supabase/migrations/

# Document archive
echo "Archived 254 migrations on $(date)" > supabase/migrations_archive/$(date +%Y%m%d)/README.txt
```

### Step 4: Create Fresh Baseline
```bash
# Generate baseline from current production
supabase db dump --schema-only > /tmp/baseline.sql

# Create clean migration
cat > supabase/migrations/20251114120000_baseline_production.sql << 'SQL'
BEGIN;

-- BASELINE MIGRATION
-- This represents the current production state
-- All subsequent migrations build on this foundation

-- Import current production schema
\i /tmp/baseline.sql

COMMIT;
SQL
```

### Step 5: Reset and Sync
```bash
# Push baseline to mark as applied
supabase db push --include-all

# Verify sync
supabase migration list
```

## 🔒 Safety Measures

### Before Cleanup:
- [ ] Full database backup
- [ ] Migration files backup
- [ ] Schema export
- [ ] Document applied migrations
- [ ] Test environment verified
- [ ] Rollback plan ready

### During Cleanup:
- [ ] Work on test environment first
- [ ] Verify each step
- [ ] Keep production untouched
- [ ] Document all changes
- [ ] Git commit each phase

### After Cleanup:
- [ ] Verify schema integrity
- [ ] Test all features
- [ ] Confirm migrations sync
- [ ] Update documentation
- [ ] Deploy to production

## 🎯 Expected Outcome

### Before:
```
supabase/migrations/
  ├── 254 SQL files (many conflicts)
  ├── Duplicate migrations
  ├── Superseded migrations
  └── Cannot push new changes
```

### After:
```
supabase/migrations/
  ├── .keep
  ├── .hygiene_allowlist
  └── 20251114120000_baseline_production.sql (single clean baseline)

supabase/migrations_archive/
  └── 20251114/
      └── [254 old migration files]
```

## 🚀 Quick Start Commands

```bash
# 1. Backup
cd /Users/jeanbosco/workspace/easymo-
./scripts/backup-migrations.sh  # We'll create this

# 2. Archive
./scripts/archive-migrations.sh  # We'll create this

# 3. Baseline
./scripts/create-baseline.sh  # We'll create this

# 4. Sync
supabase db push --repair
```

## 📊 Migration Conflict Analysis

### Common Issues Found:
1. **Duplicate Table Creations**
   - Multiple migrations trying to create same tables
   - Example: 20+ migrations for "bars" table

2. **Column Mismatches**
   - RLS policies reference columns that don't exist
   - Example: conversations.user_id vs conversations.profile_id

3. **Function Overwrites**
   - Multiple definitions of same function
   - Latest version may not be latest migration

4. **Timestamp Conflicts**
   - Many migrations with future timestamps (2026)
   - Should use current date

### Resolution:
Create single source of truth (baseline) that matches production exactly.

## ⚠️ Risks & Mitigation

### Risk 1: Data Loss
**Mitigation:** Schema-only operations, no data touched

### Risk 2: Service Disruption
**Mitigation:** Test on staging first, production last

### Risk 3: Lost Migration History
**Mitigation:** Archive all old migrations, don't delete

### Risk 4: Schema Drift
**Mitigation:** Baseline from actual production, not migrations

## 📞 Rollback Plan

If anything goes wrong:

```bash
# 1. Restore migration files
cd /Users/jeanbosco/workspace/easymo-
rm -rf supabase/migrations
cp -r supabase/migrations.backup supabase/migrations

# 2. Restore from git
git checkout HEAD~1 -- supabase/migrations/

# 3. Database is unchanged (we didn't push)
# No database rollback needed
```

## ✅ Success Criteria

- [ ] Single baseline migration in place
- [ ] Old migrations archived (not deleted)
- [ ] `supabase db push` works without errors
- [ ] All features still functional
- [ ] Clean migration history
- [ ] Documentation updated

---

## 🎯 Recommendation

**START WITH:** Create backup and baseline migration (safe, non-destructive)  
**THEN:** Archive old migrations (reversible)  
**FINALLY:** Push baseline when verified

This approach is:
- ✅ Safe (no data loss)
- ✅ Reversible (backups + git)
- ✅ Clean (single source of truth)
- ✅ Documented (clear history)

Ready to proceed? I can create the automation scripts.
