#!/bin/bash
# Week 4: Safe Function Deletions
# Only deletes functions that exist and have no code references

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Week 4: Supabase Functions Safe Deletion ===${NC}"
echo "Date: $(date)"
echo ""

# Check if SUPABASE_PROJECT_REF is set
if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo -e "${RED}ERROR: SUPABASE_PROJECT_REF not set${NC}"
    echo "Export it first: export SUPABASE_PROJECT_REF=your-project-ref"
    exit 1
fi

echo "Project: $SUPABASE_PROJECT_REF"
echo ""

# Functions to delete (only those that actually exist)
BATCH1_ADMIN=(
    "admin-wallet-api"
    "insurance-admin-api"
    "campaign-dispatcher"
)

BATCH2_SERVICES=(
    "reminder-service"
)

BATCH3_ANALYTICS=(
    "session-cleanup"
    "search-alert-notifier"
    "search-indexer"
)

# Total: 7 functions exist and can be deleted

echo -e "${YELLOW}=== Verification Phase ===${NC}"
echo "Checking for code references..."

FOUND_REFS=false
for func in "${BATCH1_ADMIN[@]}" "${BATCH2_SERVICES[@]}" "${BATCH3_ANALYTICS[@]}"; do
    COUNT=$(grep -r "$func" src/ admin-app/src --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | grep -v "node_modules" | wc -l | tr -d ' ')
    if [ "$COUNT" -gt 0 ]; then
        echo -e "${RED}WARNING: Found $COUNT references to $func${NC}"
        FOUND_REFS=true
    else
        echo -e "${GREEN}✓ $func - No references found${NC}"
    fi
done

if [ "$FOUND_REFS" = true ]; then
    echo -e "${RED}Aborting: Code references found. Manual review required.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}=== Deletion Phase ===${NC}"
echo "This will delete 7 functions from Supabase."
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Batch 1: Admin Legacy (3 functions)
echo -e "${YELLOW}Batch 1: Admin Legacy Functions${NC}"
for func in "${BATCH1_ADMIN[@]}"; do
    echo "Deleting $func..."
    if supabase functions delete "$func" --project-ref "$SUPABASE_PROJECT_REF" 2>&1 | tee /tmp/delete-$func.log; then
        echo -e "${GREEN}✓ Deleted $func${NC}"
    else
        echo -e "${RED}✗ Failed to delete $func (may not exist remotely)${NC}"
    fi
    echo ""
done

# Batch 2: Reminder Service (1 function)
echo -e "${YELLOW}Batch 2: Reminder Service${NC}"
for func in "${BATCH2_SERVICES[@]}"; do
    echo "Deleting $func..."
    if supabase functions delete "$func" --project-ref "$SUPABASE_PROJECT_REF" 2>&1 | tee /tmp/delete-$func.log; then
        echo -e "${GREEN}✓ Deleted $func${NC}"
    else
        echo -e "${RED}✗ Failed to delete $func${NC}"
    fi
    echo ""
done

# Batch 3: Analytics (3 functions)
echo -e "${YELLOW}Batch 3: Analytics & Search${NC}"
for func in "${BATCH3_ANALYTICS[@]}"; do
    echo "Deleting $func..."
    if supabase functions delete "$func" --project-ref "$SUPABASE_PROJECT_REF" 2>&1 | tee /tmp/delete-$func.log; then
        echo -e "${GREEN}✓ Deleted $func${NC}"
    else
        echo -e "${RED}✗ Failed to delete $func${NC}"
    fi
    echo ""
done

echo ""
echo -e "${GREEN}=== Week 4 Deletions Complete ===${NC}"
echo "Deleted functions:"
echo "  - Batch 1 (Admin Legacy): ${#BATCH1_ADMIN[@]}"
echo "  - Batch 2 (Services): ${#BATCH2_SERVICES[@]}"
echo "  - Batch 3 (Analytics): ${#BATCH3_ANALYTICS[@]}"
echo "  - Total: 7 functions"
echo ""
echo "Next steps:"
echo "  1. Monitor Supabase logs for 24 hours"
echo "  2. Check admin-app still functional"
echo "  3. Proceed to Week 5 if no errors"
echo ""
echo "Logs saved to: /tmp/delete-*.log"
