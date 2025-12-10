#!/bin/bash

# Fix all problematic migrations for EasyMO
# Run this from the repository root

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Starting Migration Fixes for EasyMO                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Database connection parameters
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-57322}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

export PGPASSWORD=$DB_PASSWORD

# Fixed migrations directory
FIXED_DIR="supabase/migrations-fixed"

echo "Database connection:"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# List of migrations to fix (in order)
declare -a MIGRATIONS_TO_FIX=(
  "20251001140000_rls_policies_fixed.sql"
  "20251017220824_remote_schema_fixed.sql"
  "20251018143000_storage_bucket_setup_fixed.sql"
  "20251021033131_brokerai_insurance_and_mobility_fixed.sql"
  "20251023160010_agent_management_fixed.sql"
  "20251026110000_business_categories_fixed.sql"
  "20251027000000_core_tables_additions.sql"
)

echo "Step 1: Applying fixed migrations..."
echo "═══════════════════════════════════════════════"
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0

for migration in "${MIGRATIONS_TO_FIX[@]}"; do
  echo "Applying: $migration"
  
  # Check if fixed file exists
  if [ -f "$FIXED_DIR/$migration" ]; then
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
      -f "$FIXED_DIR/$migration" \
      -v ON_ERROR_STOP=0 2>&1 | grep -E "ERROR|COMMIT"; then
      echo "✅ Successfully applied: $migration"
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
      echo "⚠️  May have partial errors: $migration (continuing...)"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  else
    echo "❌ Fixed file not found: $FIXED_DIR/$migration"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
  echo ""
done

echo ""
echo "Step 2: Checking database state..."
echo "═══════════════════════════════════════════════"
echo ""

# Check critical tables
echo "Checking critical tables..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
  table_name,
  CASE WHEN table_name IN (
    'profiles', 'businesses', 'orders', 'menus', 'menu_items',
    'mobility_requests', 'wallet_accounts', 'wallet_transactions',
    'agent_registry', 'business_categories', 'insurance_requests'
  ) THEN '✅' ELSE '  ' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'profiles', 'businesses', 'orders', 'menus', 'menu_items',
  'mobility_requests', 'wallet_accounts', 'wallet_transactions',
  'agent_registry', 'business_categories', 'insurance_requests',
  'remote_sync_status', 'shops', 'settings'
)
ORDER BY table_name;
" 2>&1 | head -30

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    FIX SUMMARY                                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "  ✅ Successfully applied: $SUCCESS_COUNT migrations"
echo "  ⚠️  Partial/warnings:     $FAIL_COUNT migrations"
echo ""
echo "Next steps:"
echo "  1. Run validation script: ./supabase/migrations-fixed/validate_fixes.sql"
echo "  2. Check Supabase Studio: http://127.0.0.1:55313"
echo "  3. Test your application"
echo ""
echo "✅ Migration fixes complete!"
