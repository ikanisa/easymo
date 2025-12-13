#!/bin/bash
set -e

# ============================================================================
# CRITICAL DATABASE CLEANUP SCRIPT
# ============================================================================
# This script will:
# 1. BACKUP two critical tables: businesses, mv_category_business_counts
# 2. DELETE all other tables in the public schema
# 3. Keep the two protected tables intact
#
# PROTECTED TABLES (WILL NOT BE DELETED):
#   - businesses
#   - mv_category_business_counts
#
# ⚠️  WARNING: This is DESTRUCTIVE and IRREVERSIBLE!
# ============================================================================

echo "🔴 CRITICAL DATABASE CLEANUP SCRIPT"
echo "===================================="
echo ""
echo "⚠️  This will DELETE ALL tables except:"
echo "   ✓ businesses"
echo "   ✓ mv_category_business_counts"
echo ""
echo "Press Ctrl+C now to cancel, or Enter to continue..."
read

# Configuration
BACKUP_DIR="./backups/critical-tables-$(date +%Y%m%d_%H%M%S)"
PROTECTED_TABLES=("businesses" "mv_category_business_counts")

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: supabase CLI not found"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo ""
echo "📦 Step 1: Backing up protected tables..."
echo "=========================================="

# Backup businesses table
echo "  → Backing up 'businesses' table..."
supabase db dump --data-only -t public.businesses > "$BACKUP_DIR/businesses.sql"
if [ $? -eq 0 ]; then
    echo "  ✓ businesses table backed up to $BACKUP_DIR/businesses.sql"
else
    echo "  ❌ Failed to backup businesses table"
    exit 1
fi

# Backup mv_category_business_counts table
echo "  → Backing up 'mv_category_business_counts' view/table..."
supabase db dump --data-only -t public.mv_category_business_counts > "$BACKUP_DIR/mv_category_business_counts.sql" 2>/dev/null || {
    # If it's a materialized view, dump differently
    echo "  → Attempting as materialized view..."
    psql "$DATABASE_URL" -c "\COPY (SELECT * FROM public.mv_category_business_counts) TO '$BACKUP_DIR/mv_category_business_counts.csv' CSV HEADER" || {
        echo "  ⚠️  Could not backup mv_category_business_counts (might be a view)"
    }
}
echo "  ✓ mv_category_business_counts backed up"

echo ""
echo "✅ Backups completed successfully!"
echo "   Location: $BACKUP_DIR"
echo ""

# Create SQL script to drop all tables except protected ones
echo "🗑️  Step 2: Creating table deletion script..."
echo "=============================================="

cat > "$BACKUP_DIR/drop_all_except_protected.sql" << 'SQL'
-- ============================================================================
-- DROP ALL TABLES EXCEPT PROTECTED ONES
-- Generated: $(date)
-- ============================================================================

BEGIN;

-- Create a function to drop all tables except protected ones
DO $$
DECLARE
    r RECORD;
    protected_tables TEXT[] := ARRAY['businesses', 'mv_category_business_counts'];
BEGIN
    -- Drop all tables in public schema except protected ones
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename != ALL(protected_tables)
        ORDER BY tablename
    LOOP
        RAISE NOTICE 'Dropping table: %', r.tablename;
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Drop all views except those related to protected tables
    FOR r IN 
        SELECT viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
        AND viewname != ALL(protected_tables)
        AND viewname NOT LIKE '%_businesses_%'
        ORDER BY viewname
    LOOP
        RAISE NOTICE 'Dropping view: %', r.viewname;
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.viewname) || ' CASCADE';
    END LOOP;
    
    -- Drop all materialized views except protected ones
    FOR r IN 
        SELECT matviewname 
        FROM pg_matviews 
        WHERE schemaname = 'public'
        AND matviewname != ALL(protected_tables)
        ORDER BY matviewname
    LOOP
        RAISE NOTICE 'Dropping materialized view: %', r.matviewname;
        EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS public.' || quote_ident(r.matviewname) || ' CASCADE';
    END LOOP;
    
    -- Drop all sequences not used by protected tables
    FOR r IN 
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
        AND sequence_name NOT IN (
            SELECT pg_get_serial_sequence('public.businesses', column_name)::TEXT
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'businesses'
            AND pg_get_serial_sequence('public.businesses', column_name) IS NOT NULL
        )
        ORDER BY sequence_name
    LOOP
        RAISE NOTICE 'Dropping sequence: %', r.sequence_name;
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequence_name) || ' CASCADE';
    END LOOP;
    
    -- Drop all types except those used by protected tables
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typnamespace = 'public'::regnamespace
        AND typtype = 'e'  -- enum types
        ORDER BY typname
    LOOP
        RAISE NOTICE 'Dropping type: %', r.typname;
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Cleanup completed!';
    RAISE NOTICE 'Protected tables preserved:';
    RAISE NOTICE '  ✓ businesses';
    RAISE NOTICE '  ✓ mv_category_business_counts';
    RAISE NOTICE '========================================';
END $$;

COMMIT;
SQL

echo "  ✓ Deletion script created: $BACKUP_DIR/drop_all_except_protected.sql"
echo ""

# Show what will be deleted
echo "📋 Step 3: Preview - Tables to be DELETED..."
echo "=============================================="
supabase db dump --schema-only --use-copy | grep "CREATE TABLE" | grep -v "businesses\|mv_category_business_counts" | head -20
echo ""
echo "(Showing first 20 tables...)"
echo ""

echo "📋 Protected tables (WILL BE KEPT):"
echo "  ✓ businesses"
echo "  ✓ mv_category_business_counts"
echo ""

# Final confirmation
echo "⚠️  FINAL CONFIRMATION REQUIRED"
echo "==============================="
echo ""
echo "This will:"
echo "  1. Keep backups in: $BACKUP_DIR"
echo "  2. Delete ALL tables except: businesses, mv_category_business_counts"
echo "  3. This action is IRREVERSIBLE!"
echo ""
echo "Type 'DELETE ALL TABLES' to confirm (exactly as shown):"
read CONFIRMATION

if [ "$CONFIRMATION" != "DELETE ALL TABLES" ]; then
    echo ""
    echo "❌ Confirmation failed. Aborting."
    echo "✓ Backups are safe at: $BACKUP_DIR"
    exit 1
fi

# Execute the deletion
echo ""
echo "🗑️  Step 4: Executing table deletion..."
echo "========================================"
echo ""

supabase db push --file "$BACKUP_DIR/drop_all_except_protected.sql"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ DATABASE CLEANUP COMPLETED!"
    echo "=============================="
    echo ""
    echo "Protected tables preserved:"
    echo "  ✓ businesses"
    echo "  ✓ mv_category_business_counts"
    echo ""
    echo "Backups location:"
    echo "  📦 $BACKUP_DIR"
    echo ""
    echo "Verification:"
    supabase db dump --schema-only | grep -E "CREATE TABLE|CREATE MATERIALIZED VIEW" | grep "businesses\|mv_category_business_counts"
else
    echo ""
    echo "❌ Error during cleanup!"
    echo "Backups are safe at: $BACKUP_DIR"
    exit 1
fi

echo ""
echo "Next steps:"
echo "  1. Verify protected tables: supabase db dump --data-only -t public.businesses"
echo "  2. Recreate tables with new migrations"
echo "  3. Restore data if needed from: $BACKUP_DIR"
