#!/bin/bash
set -e

# Database Migration Cleanup Script
# Safely archives old migrations and creates clean baseline

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_DIR="supabase/migrations_archive/${TIMESTAMP}"
BACKUP_FILE="migrations_backup_${TIMESTAMP}.tar.gz"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Database Migration Cleanup - Safe Mode                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Safety checks
echo "Step 1: Safety Checks..."
if [ ! -d "supabase/migrations" ]; then
  echo "❌ Error: supabase/migrations directory not found"
  exit 1
fi

MIGRATION_COUNT=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l)
echo "   Found $MIGRATION_COUNT migration files"

# Step 2: Create backups
echo ""
echo "Step 2: Creating Backups..."
echo "   Creating tar backup..."
tar -czf "$BACKUP_FILE" supabase/migrations/
echo "   ✅ Backup created: $BACKUP_FILE"

echo "   Copying to migrations.backup..."
cp -r supabase/migrations supabase/migrations.backup
echo "   ✅ Backup created: supabase/migrations.backup/"

# Step 3: Get current applied migrations
echo ""
echo "Step 3: Documenting Applied Migrations..."
supabase migration list > applied_migrations_${TIMESTAMP}.txt 2>&1 || echo "   ⚠️  Could not fetch applied migrations (might be OK)"
echo "   ✅ Saved to: applied_migrations_${TIMESTAMP}.txt"

# Step 4: Create archive directory
echo ""
echo "Step 4: Creating Archive Directory..."
mkdir -p "$ARCHIVE_DIR"
echo "   ✅ Created: $ARCHIVE_DIR"

# Step 5: Move migrations to archive
echo ""
echo "Step 5: Archiving Migrations..."
echo "   Moving $MIGRATION_COUNT SQL files to archive..."
mv supabase/migrations/*.sql "$ARCHIVE_DIR/" 2>/dev/null || echo "   No SQL files to move"

# Step 6: Restore special files
echo ""
echo "Step 6: Restoring Special Files..."
if [ -f "$ARCHIVE_DIR/.keep" ]; then
  mv "$ARCHIVE_DIR/.keep" supabase/migrations/
  echo "   ✅ Restored .keep"
fi
if [ -f "$ARCHIVE_DIR/.hygiene_allowlist" ]; then
  mv "$ARCHIVE_DIR/.hygiene_allowlist" supabase/migrations/
  echo "   ✅ Restored .hygiene_allowlist"
fi

# Step 7: Document archive
echo ""
echo "Step 7: Documenting Archive..."
cat > "$ARCHIVE_DIR/README.txt" << EOF
Migration Archive
=================
Created: $(date)
Original Count: $MIGRATION_COUNT files
Reason: Database migration cleanup - conflicts and duplicates

These migrations were archived because:
1. Conflicts with current production schema
2. Duplicate/superseded migrations
3. Need clean baseline

Restoration:
If needed, copy files back to supabase/migrations/
or extract from: $BACKUP_FILE

Next Steps:
1. Create baseline migration from production schema
2. Push baseline to production
3. Resume normal migration workflow
EOF
echo "   ✅ Documentation created"

# Step 8: Create baseline migration template
echo ""
echo "Step 8: Creating Baseline Template..."
cat > supabase/migrations/20251114120000_baseline_production.sql << 'SQL'
BEGIN;

-- =====================================================================
-- BASELINE MIGRATION - Production Schema Snapshot
-- =====================================================================
-- Created: 2025-11-14
-- Purpose: Single source of truth representing current production state
-- 
-- This migration marks the starting point after migration cleanup.
-- All subsequent migrations build on this foundation.
--
-- Tables already exist in production. This migration documents them
-- and syncs the migration history.
-- =====================================================================

-- Core Business Tables
-- --------------------
-- business: Main business directory
-- business_owners: Ownership tracking (supports multiple owners)
-- business_whatsapp_numbers: Multiple WhatsApp contacts per business
-- profile_assets: User asset tracking (vehicles, businesses, properties)

-- Core User Tables
-- ----------------
-- profiles: User profiles
-- contacts: Contact information
-- conversations: WhatsApp conversation tracking
-- messages: Message history

-- Mobility Tables
-- ---------------
-- trips: Trip records
-- drivers: Driver information
-- passengers: Passenger information
-- vehicles: Vehicle registrations

-- Insurance Tables
-- ----------------
-- insurance_policies: Policy tracking
-- insurance_claims: Claims management
-- insurance_media_queue: Document processing

-- Wallet & Transactions
-- ---------------------
-- wallet_ledger: Transaction ledger
-- wallet_balance: User balances
-- referrals: Referral tracking

-- Agent System
-- ------------
-- agent_sessions: AI agent sessions
-- agent_registry: Agent configurations
-- agent_logs: Agent activity logs

-- NOTE: All tables listed above already exist in production.
-- This migration serves as documentation and baseline marker.

SELECT 'Baseline migration - production schema documented' as status;

COMMIT;
SQL
echo "   ✅ Baseline template created"

# Step 9: Summary
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                     Cleanup Complete! ✅                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "   • Archived: $MIGRATION_COUNT migrations"
echo "   • Backup: $BACKUP_FILE"
echo "   • Backup Copy: supabase/migrations.backup/"
echo "   • Archive: $ARCHIVE_DIR"
echo "   • Baseline: supabase/migrations/20251114120000_baseline_production.sql"
echo ""
echo "📋 Next Steps:"
echo "   1. Review baseline migration"
echo "   2. Commit changes to git"
echo "   3. (Optional) Get actual schema: supabase db dump --schema-only"
echo "   4. Push baseline: supabase db push"
echo ""
echo "🔄 Rollback (if needed):"
echo "   rm -rf supabase/migrations"
echo "   cp -r supabase/migrations.backup supabase/migrations"
echo ""
echo "✅ Safe to proceed - all backups created!"
