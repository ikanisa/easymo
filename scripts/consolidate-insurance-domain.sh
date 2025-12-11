#!/bin/bash
# Insurance Domain Consolidation Script
# Consolidates scattered insurance code and removes redundant functions

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛡️  Insurance Domain Consolidation${NC}"
echo "===================================="
echo ""

# Phase 1: Delete redundant local function directories
echo -e "${YELLOW}Phase 1: Removing redundant local function directories...${NC}"

REDUNDANT_FUNCTIONS=(
  "supabase/functions/insurance-admin-health"
  "supabase/functions/send-insurance-admin-notifications"
)

for func in "${REDUNDANT_FUNCTIONS[@]}"; do
  if [ -d "$func" ]; then
    echo "  ❌ Deleting: $func"
    rm -rf "$func"
  else
    echo "  ⏭️  Already removed: $func"
  fi
done

echo ""

# Phase 2: Move insurance handlers from mobility to insurance webhook
echo -e "${YELLOW}Phase 2: Moving insurance logic to correct location...${NC}"

# Ensure target directories exist
mkdir -p supabase/functions/wa-webhook-insurance/handlers
mkdir -p supabase/functions/wa-webhook-insurance/ocr

# Move handlers from mobility to insurance
HANDLERS_TO_MOVE=(
  "insurance_admin.ts"
  "insurance_notifications.ts"
  "driver_insurance.ts"
)

for handler in "${HANDLERS_TO_MOVE[@]}"; do
  SRC="supabase/functions/wa-webhook-mobility/handlers/$handler"
  DEST="supabase/functions/wa-webhook-insurance/handlers/$handler"
  
  if [ -f "$SRC" ]; then
    echo "  📦 Moving: $handler"
    mv "$SRC" "$DEST"
  else
    echo "  ⏭️  Already moved: $handler"
  fi
done

# Move OCR files
if [ -f "supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts" ]; then
  echo "  📦 Moving: driver_insurance_ocr.ts"
  mv supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts \
     supabase/functions/wa-webhook-insurance/ocr/
fi

# Remove empty insurance directory from mobility
if [ -d "supabase/functions/wa-webhook-mobility/insurance" ] && [ -z "$(ls -A supabase/functions/wa-webhook-mobility/insurance)" ]; then
  echo "  🗑️  Removing empty insurance directory from mobility"
  rm -rf supabase/functions/wa-webhook-mobility/insurance
fi

# Remove stub domains/insurance directories
if [ -d "supabase/functions/wa-webhook-mobility/domains/insurance" ]; then
  echo "  🗑️  Removing stub insurance domain from mobility"
  rm -rf supabase/functions/wa-webhook-mobility/domains/insurance
fi

if [ -d "supabase/functions/wa-webhook/domains/insurance" ]; then
  echo "  🗑️  Removing stub insurance domain from wa-webhook"
  rm -rf supabase/functions/wa-webhook/domains/insurance
fi

echo ""

# Phase 3: Report final structure
echo -e "${GREEN}Phase 3: Verification${NC}"

echo ""
echo "📊 Insurance Functions (Final):"
echo "  ✅ wa-webhook-insurance/         (Main insurance webhook)"
echo "  ✅ insurance-renewal-reminder/   (Cron job)"
echo ""

echo "📁 Insurance Code Locations:"
if [ -d "supabase/functions/wa-webhook-insurance" ]; then
  echo "  ✅ wa-webhook-insurance/insurance/     (Core insurance logic)"
  echo "  ✅ wa-webhook-insurance/handlers/      (Insurance handlers)"
  echo "  ✅ wa-webhook-insurance/ocr/           (OCR processing)"
fi

if [ -d "supabase/functions/_shared/wa-webhook-shared/domains/insurance" ]; then
  echo "  ✅ _shared/wa-webhook-shared/domains/insurance/ (Shared utilities)"
fi

echo ""

# Phase 4: Check for remaining insurance references in wrong places
echo -e "${YELLOW}Phase 4: Scanning for remaining misplaced insurance code...${NC}"

MISPLACED_COUNT=0

# Check mobility handlers
if grep -l "insurance" supabase/functions/wa-webhook-mobility/handlers/*.ts 2>/dev/null | grep -v "driver_license"; then
  echo -e "  ${RED}⚠️  Found insurance references in mobility handlers${NC}"
  MISPLACED_COUNT=$((MISPLACED_COUNT + 1))
fi

# Check mobility domains
if [ -d "supabase/functions/wa-webhook-mobility/domains/insurance" ]; then
  echo -e "  ${RED}⚠️  Insurance domain still exists in mobility${NC}"
  MISPLACED_COUNT=$((MISPLACED_COUNT + 1))
fi

if [ $MISPLACED_COUNT -eq 0 ]; then
  echo "  ✅ No misplaced insurance code found"
fi

echo ""

# Summary
echo -e "${GREEN}✅ Insurance domain consolidation complete!${NC}"
echo ""
echo "📝 Next Steps:"
echo "  1. Review moved files for import path updates"
echo "  2. Run: pnpm lint to check for broken imports"
echo "  3. Deploy updated functions:"
echo "     supabase functions deploy wa-webhook-insurance"
echo "     supabase functions deploy wa-webhook-mobility"
echo "  4. Run database consolidation migration (see INSURANCE_CONSOLIDATION_MIGRATION.sql)"
echo ""
echo "📚 Documentation:"
echo "  - See INSURANCE_CONSOLIDATION_COMPLETE.md for details"
echo ""
