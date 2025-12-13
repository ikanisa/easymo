# Database Cleanup Guide - Protected Tables

## ⚠️ CRITICAL OPERATION

This guide describes how to safely delete all Supabase tables except two protected tables:
- `businesses`
- `mv_category_business_counts`

## 🛡️ Protected Tables

These two tables will **NEVER BE DELETED**:
1. **businesses** - Core business data
2. **mv_category_business_counts** - Business category statistics

## 📋 Prerequisites

1. Supabase CLI installed: `npm install -g supabase`
2. Database connection configured (DATABASE_URL or supabase link)
3. Admin access to the database
4. Sufficient disk space for backups

## �� Step-by-Step Process

### Step 1: Verify Protected Tables

First, check that your protected tables exist and have data:

```bash
./scripts/verify-protected-tables.sh
```

**Expected Output:**
```
✓ businesses table exists with X rows
✓ mv_category_business_counts exists with Y rows
```

### Step 2: Run Backup and Cleanup Script

⚠️ **WARNING**: This will delete ALL tables except the protected ones!

```bash
./scripts/backup-and-cleanup-db.sh
```

**The script will:**
1. ✅ Backup `businesses` table to `./backups/critical-tables-TIMESTAMP/businesses.sql`
2. ✅ Backup `mv_category_business_counts` to `./backups/critical-tables-TIMESTAMP/mv_category_business_counts.sql`
3. ✅ Show preview of tables to be deleted
4. ⚠️  Ask for confirmation (type exactly: `DELETE ALL TABLES`)
5. 🗑️  Delete all tables except protected ones
6. ✅ Verify protected tables still exist

### Step 3: Verify After Cleanup

After cleanup, verify the protected tables are intact:

```bash
./scripts/verify-protected-tables.sh
```

### Step 4: Recreate Schema

Now you can recreate your database schema with migrations:

```bash
# Apply new migrations
supabase db push

# Or reset and apply all migrations
supabase db reset
```

## 🔄 Recovery (If Needed)

If something goes wrong, restore the protected tables:

```bash
./scripts/restore-protected-tables.sh
```

This will restore from the most recent backup in `./backups/critical-tables-*/`

## 📁 Backup Location

Backups are stored in:
```
./backups/critical-tables-YYYYMMDD_HHMMSS/
├── businesses.sql                      # Full backup of businesses table
├── mv_category_business_counts.sql     # Full backup of category counts
└── drop_all_except_protected.sql       # SQL script used for deletion
```

## 🔍 Manual Verification

You can manually verify the protected tables:

```bash
# Count rows in businesses
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM public.businesses"

# Count rows in mv_category_business_counts
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM public.mv_category_business_counts"

# List all remaining tables
psql "$DATABASE_URL" -c "\dt public.*"
```

## ⚡ Quick Reference

```bash
# 1. Verify before cleanup
./scripts/verify-protected-tables.sh

# 2. Backup and delete all except protected
./scripts/backup-and-cleanup-db.sh

# 3. Verify after cleanup
./scripts/verify-protected-tables.sh

# 4. Restore if needed
./scripts/restore-protected-tables.sh
```

## 🚨 Safety Features

The script includes multiple safety checks:

1. ✅ **Backup First**: Always backs up protected tables before deletion
2. ✅ **Preview**: Shows what will be deleted before execution
3. ✅ **Double Confirmation**: Requires typing exact phrase to proceed
4. ✅ **Protected List**: Hardcoded list of tables to preserve
5. ✅ **Transaction**: Uses BEGIN/COMMIT to ensure atomic operation
6. ✅ **Verification**: Confirms protected tables exist after cleanup
7. ✅ **Restore Script**: Provides easy recovery if needed

## 📊 What Gets Deleted

The script will delete:
- ❌ All tables except `businesses` and `mv_category_business_counts`
- ❌ All views (except those related to businesses)
- ❌ All materialized views except `mv_category_business_counts`
- ❌ All sequences not used by protected tables
- ❌ All enum types
- ❌ All functions and triggers

## 🛡️ What's Protected

The script will keep:
- ✅ `businesses` table (schema + data)
- ✅ `mv_category_business_counts` (schema + data)
- ✅ Any sequences used by these tables
- ✅ Any foreign key relationships to these tables

## 🔐 Database Connection

Set your database connection:

```bash
# Option 1: Use environment variable
export DATABASE_URL="postgresql://postgres:password@db.project.supabase.co:5432/postgres"

# Option 2: Use supabase link
supabase link --project-ref your-project-ref

# Option 3: Script will auto-detect from supabase status
```

## ⏱️ Estimated Time

- Backup: 1-5 minutes (depends on table size)
- Deletion: 2-10 minutes (depends on number of tables)
- Total: ~5-15 minutes

## 📞 Support

If you encounter issues:
1. Check backup files exist in `./backups/`
2. Verify DATABASE_URL is set correctly
3. Check you have admin permissions
4. Review script output for error messages
5. Use restore script to recover if needed

---

**Last Updated**: 2025-12-13  
**Version**: 1.0  
**Status**: Ready for production use with caution
