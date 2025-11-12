#!/bin/bash

# Restore all safe migrations from migrations-broken/
# Skips deprecated features and already-applied migrations

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         RESTORING ALL MIGRATIONS FROM ARCHIVE                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Database connection
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-57322}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

export PGPASSWORD=$DB_PASSWORD

# Directories
BROKEN_DIR="supabase/migrations-broken"
MIGRATIONS_DIR="supabase/migrations"

# Skip these deprecated migrations
SKIP_MIGRATIONS=(
  "20251010101000_phase1_archive_legacy_tables.sql"
  "20251011130000_phase5_drop_archive_tables.sql"
  "20251030100000_campaigns_uuid_rework.sql"
  "20251031134015_momo_inbox_tracking.sql"
  "20251031134020_contribution_cycle_helper.sql"
  "20251031135000_sacco_loan_endorsements.sql"
  "20251031135010_sacco_loan_endorsements_rls.sql"
  "20251130090000_remove_orders_templates_campaigns.sql"
  "20251205100000_admin_marketing_fixture_support.sql"
  "20260304120000_remove_baskets_vouchers.sql"
  "20251003160000_phase_a_legacy.sql"
  "20251101120000_loans_reminders_extension.sql"
)

# Also skip migrations we already have fixed versions of
FIXED_MIGRATIONS=(
  "20251001140000_rls_policies.sql"
  "20251017220824_remote_schema.sql"
  "20251018143000_storage_bucket_setup.sql"
  "20251021033131_brokerai_insurance_and_mobility.sql"
  "20251023160010_agent_management.sql"
  "20251026110000_business_categories.sql"
)

# Counters
SUCCESS=0
SKIPPED=0
FAILED=0
ALREADY_EXISTS=0

echo "Analyzing migrations..."
echo ""

# Get all migrations from broken, sorted chronologically
cd "$BROKEN_DIR"
MIGRATIONS=($(ls -1 *.sql 2>/dev/null | sort))
TOTAL=${#MIGRATIONS[@]}

echo "Found $TOTAL migrations in archive"
echo "Will skip ${#SKIP_MIGRATIONS[@]} deprecated migrations"
echo "Will skip ${#FIXED_MIGRATIONS[@]} already-fixed migrations"
echo ""
echo "Starting restoration..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

cd ../../

for migration in "${MIGRATIONS[@]}"; do
  # Check if should skip (deprecated)
  should_skip=false
  for skip in "${SKIP_MIGRATIONS[@]}"; do
    if [ "$migration" = "$skip" ]; then
      echo "⏭️  SKIP (deprecated): $migration"
      SKIPPED=$((SKIPPED + 1))
      should_skip=true
      break
    fi
  done
  
  # Check if we have a fixed version
  for fixed in "${FIXED_MIGRATIONS[@]}"; do
    if [ "$migration" = "$fixed" ]; then
      echo "⏭️  SKIP (fixed version applied): $migration"
      SKIPPED=$((SKIPPED + 1))
      should_skip=true
      break
    fi
  done
  
  if [ "$should_skip" = true ]; then
    continue
  fi
  
  # Check if already in migrations/ directory
  if [ -f "$MIGRATIONS_DIR/$migration" ]; then
    echo "✓  EXISTS: $migration"
    ALREADY_EXISTS=$((ALREADY_EXISTS + 1))
    continue
  fi
  
  # Try to apply the migration
  echo -n "📝 APPLYING: $migration ... "
  
  if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
    -f "$BROKEN_DIR/$migration" \
    -v ON_ERROR_STOP=0 \
    > /tmp/migration_output.log 2>&1; then
    
    # Check output for errors
    if grep -qi "ERROR" /tmp/migration_output.log; then
      # Has errors but may have partial success
      ERROR_COUNT=$(grep -c "ERROR" /tmp/migration_output.log)
      if [ $ERROR_COUNT -lt 3 ]; then
        echo "⚠️  PARTIAL (${ERROR_COUNT} errors, continuing)"
        FAILED=$((FAILED + 1))
      else
        echo "❌ FAILED (${ERROR_COUNT} errors)"
        FAILED=$((FAILED + 1))
      fi
    else
      echo "✅ SUCCESS"
      SUCCESS=$((SUCCESS + 1))
      # Copy to migrations directory
      cp "$BROKEN_DIR/$migration" "$MIGRATIONS_DIR/"
    fi
  else
    echo "❌ FAILED"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    RESTORATION COMPLETE                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "  Total processed:    $TOTAL"
echo "  ✅ Successful:       $SUCCESS"
echo "  ✓  Already applied:  $ALREADY_EXISTS"
echo "  ⏭️  Skipped:          $SKIPPED"
echo "  ❌ Failed:           $FAILED"
echo ""

# Final database check
echo "📈 Final Database State:"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
  'Tables' as metric,
  COUNT(*)::text as count
FROM information_schema.tables
WHERE table_schema = 'public'
UNION ALL
SELECT 
  'Indexes' as metric,
  COUNT(*)::text as count
FROM pg_indexes
WHERE schemaname = 'public'
UNION ALL
SELECT 
  'RLS Policies' as metric,
  COUNT(*)::text as count
FROM pg_policies
WHERE schemaname = 'public';
"

echo ""
echo "✅ Restoration complete!"
echo ""
echo "Next steps:"
echo "  1. Check Supabase Studio: http://127.0.0.1:55313"
echo "  2. Test your application"
echo "  3. Run validation: psql -f supabase/migrations-fixed/validate_fixes.sql"
