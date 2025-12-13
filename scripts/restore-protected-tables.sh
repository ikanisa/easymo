#!/bin/bash
set -e

# ============================================================================
# RESTORE PROTECTED TABLES SCRIPT
# ============================================================================
# Use this to restore the protected tables from backup if needed
# ============================================================================

echo "🔄 RESTORE PROTECTED TABLES"
echo "============================"
echo ""

# Find most recent backup
LATEST_BACKUP=$(ls -td backups/critical-tables-* 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ No backups found!"
    exit 1
fi

echo "Found backup: $LATEST_BACKUP"
echo ""
echo "This will restore:"
echo "  → businesses table"
echo "  → mv_category_business_counts table"
echo ""
echo "Press Enter to continue or Ctrl+C to cancel..."
read

# Restore businesses
if [ -f "$LATEST_BACKUP/businesses.sql" ]; then
    echo "Restoring businesses table..."
    psql "$DATABASE_URL" < "$LATEST_BACKUP/businesses.sql"
    echo "✓ businesses restored"
fi

# Restore mv_category_business_counts
if [ -f "$LATEST_BACKUP/mv_category_business_counts.sql" ]; then
    echo "Restoring mv_category_business_counts..."
    psql "$DATABASE_URL" < "$LATEST_BACKUP/mv_category_business_counts.sql"
    echo "✓ mv_category_business_counts restored"
fi

echo ""
echo "✅ Restore completed!"
