#!/bin/bash
# ============================================================================
# MOBILITY CONSOLIDATION - COMPLETE EXECUTION SCRIPT
# ============================================================================
# This script executes the entire mobility database consolidation
# 
# CRITICAL: Read MOBILITY_DATABASE_CONSOLIDATION_PLAN.md first!
# 
# What this does:
# 1. Runs assessment
# 2. Creates backups
# 3. Applies consolidation migration
# 4. Verifies success
# 5. (Optional) Applies cleanup migration
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================================================"
echo "MOBILITY DATABASE CONSOLIDATION - AUTOMATED EXECUTION"
echo "============================================================================"
echo ""
echo "Date: $(date)"
echo ""

# Check prerequisites
echo "Checking prerequisites..."
echo ""

# 1. Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ DATABASE_URL not set${NC}"
  echo ""
  echo "Please set it first:"
  echo "  export DATABASE_URL='postgresql://postgres:password@host:port/postgres'"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ DATABASE_URL is set${NC}"

# 2. Check required files
REQUIRED_FILES=(
  "scripts/mobility_assessment.sql"
  "scripts/backup_mobility_tables.sh"
  "supabase/migrations/20251208150000_consolidate_mobility_tables.sql"
  "supabase/migrations/20251208160000_drop_deprecated_mobility_tables.sql"
  "scripts/verify_mobility_consolidation.sh"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}❌ Missing required file: $file${NC}"
    exit 1
  fi
done

echo -e "${GREEN}✅ All required files found${NC}"
echo ""

# Confirm execution
echo "============================================================================"
echo -e "${YELLOW}⚠️  WARNING: This will modify your production database${NC}"
echo "============================================================================"
echo ""
echo "This script will:"
echo "  1. Analyze current database state"
echo "  2. Backup all mobility tables"
echo "  3. Migrate data to canonical tables"
echo "  4. Update RPC functions"
echo "  5. Verify consolidation"
echo ""
echo "Estimated time: 1-2 hours"
echo "Estimated downtime: 15-30 minutes"
echo ""
read -p "Do you want to proceed? (type 'yes' to continue): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Execution cancelled"
  exit 0
fi

echo ""
echo "============================================================================"
echo "PHASE 1: ASSESSMENT (5 min)"
echo "============================================================================"
echo ""

psql "$DATABASE_URL" -f scripts/mobility_assessment.sql > mobility_assessment_report_$(date +%Y%m%d_%H%M%S).txt

echo -e "${GREEN}✅ Assessment complete${NC}"
echo "   Report saved to: mobility_assessment_report_$(date +%Y%m%d_%H%M%S).txt"
echo ""

read -p "Review the assessment report. Continue? (yes/no): " CONTINUE
if [ "$CONTINUE" != "yes" ]; then
  echo "Execution paused. Review the report and run this script again."
  exit 0
fi

echo ""
echo "============================================================================"
echo "PHASE 2: BACKUP (2 min)"
echo "============================================================================"
echo ""

./scripts/backup_mobility_tables.sh

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Backup failed!${NC}"
  echo "Cannot proceed without successful backup."
  exit 1
fi

echo -e "${GREEN}✅ Backup complete${NC}"
echo ""

read -p "Backup successful. Continue with migration? (yes/no): " CONTINUE
if [ "$CONTINUE" != "yes" ]; then
  echo "Execution paused. Backup is safe in ./backups/"
  exit 0
fi

echo ""
echo "============================================================================"
echo "PHASE 3: CONSOLIDATION MIGRATION (30-60 min)"
echo "============================================================================"
echo ""
echo "Applying migration: 20251208150000_consolidate_mobility_tables.sql"
echo ""
echo -e "${YELLOW}⚠️  Downtime window starting...${NC}"
echo ""

# Record start time
START_TIME=$(date +%s)

# Apply consolidation migration
psql "$DATABASE_URL" -f supabase/migrations/20251208150000_consolidate_mobility_tables.sql

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Migration failed!${NC}"
  echo ""
  echo "ROLLBACK INSTRUCTIONS:"
  echo "  cd backups/mobility_consolidation_*/"
  echo "  ./RESTORE.sh"
  echo ""
  exit 1
fi

# Record end time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo -e "${GREEN}✅ Consolidation migration complete${NC}"
echo "   Duration: ${DURATION} seconds"
echo ""

echo ""
echo "============================================================================"
echo "PHASE 4: VERIFICATION (15 min)"
echo "============================================================================"
echo ""

./scripts/verify_mobility_consolidation.sh

VERIFY_RESULT=$?

if [ $VERIFY_RESULT -ne 0 ]; then
  echo -e "${RED}❌ Verification failed!${NC}"
  echo ""
  echo "ROLLBACK RECOMMENDED"
  echo "Run the restore script:"
  echo "  cd backups/mobility_consolidation_*/"
  echo "  ./RESTORE.sh"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ Verification passed${NC}"
echo ""

echo ""
echo "============================================================================"
echo "PHASE 5: CLEANUP MIGRATION (Optional)"
echo "============================================================================"
echo ""
echo "The consolidation is complete and verified."
echo "You can now drop the deprecated tables."
echo ""
echo -e "${YELLOW}⚠️  This action cannot be easily undone!${NC}"
echo ""
echo "Recommended: Wait 24-48 hours and monitor production before cleanup."
echo ""
read -p "Do you want to drop deprecated tables NOW? (yes/no): " CLEANUP

if [ "$CLEANUP" = "yes" ]; then
  echo ""
  echo "Applying cleanup migration: 20251208160000_drop_deprecated_mobility_tables.sql"
  echo ""
  
  psql "$DATABASE_URL" -f supabase/migrations/20251208160000_drop_deprecated_mobility_tables.sql
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Cleanup complete${NC}"
  else
    echo -e "${RED}❌ Cleanup failed${NC}"
    echo "Old tables still exist, but consolidation is working."
    echo "You can manually drop them later."
  fi
else
  echo ""
  echo "Cleanup skipped. You can run it later with:"
  echo "  psql \$DATABASE_URL -f supabase/migrations/20251208160000_drop_deprecated_mobility_tables.sql"
fi

echo ""
echo "============================================================================"
echo "CONSOLIDATION COMPLETE ✓"
echo "============================================================================"
echo ""
echo "Summary:"
echo "  - Data migrated to canonical tables"
echo "  - RPC functions updated"
echo "  - Foreign keys fixed"
echo "  - All verification tests passed"
echo ""
echo "Next steps:"
echo "  1. Monitor application for 24-48 hours"
echo "  2. Check trip creation/matching works correctly"
echo "  3. If everything is stable, run cleanup migration (if not done yet)"
echo "  4. Update team documentation"
echo "  5. Archive backups (keep for 30 days)"
echo ""
echo "Backups location: ./backups/mobility_consolidation_*/"
echo ""
echo "============================================================================"
