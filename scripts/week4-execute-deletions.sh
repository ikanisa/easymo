#!/bin/bash
# Week 4: Execute Safe Function Deletions
# Based on deep analysis - 5 functions with 0 code references

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Week 4: Supabase Functions Safe Deletion     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo "Date: $(date)"
echo "Analysis: WEEK_4_DEEP_ANALYSIS_REPORT.md"
echo ""

# Deletion targets (verified to exist)
DELETIONS=(
    "session-cleanup"
    "search-alert-notifier"
    "reminder-service"
    "search-indexer"
    "insurance-admin-api"
)

echo -e "${GREEN}📊 Deletion Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Functions to delete: ${#DELETIONS[@]}"
echo "Code references: 0 (verified)"
echo "Risk level: LOW"
echo ""

# Pre-flight verification
echo -e "${YELLOW}🔍 Pre-Flight Verification${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check each function exists
MISSING=0
for func in "${DELETIONS[@]}"; do
    if supabase functions list 2>/dev/null | grep -q "| $func "; then
        echo -e "${GREEN}✓${NC} $func exists"
    else
        echo -e "${RED}✗${NC} $func not found"
        ((MISSING++))
    fi
done

if [ $MISSING -gt 0 ]; then
    echo -e "${YELLOW}Warning: $MISSING functions not found (may already be deleted)${NC}"
fi

echo ""

# Backup current state
echo -e "${YELLOW}💾 Creating Backup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

BACKUP_FILE="/tmp/functions-before-week4-$(date +%Y%m%d-%H%M%S).txt"
supabase functions list > "$BACKUP_FILE" 2>&1
echo "Backup saved: $BACKUP_FILE"

# Count before
BEFORE_COUNT=$(supabase functions list 2>/dev/null | grep -c "ACTIVE" || echo "0")
echo "Functions before: $BEFORE_COUNT"
echo ""

# Confirmation
echo -e "${RED}⚠️  WARNING: This will delete ${#DELETIONS[@]} functions${NC}"
echo ""
echo "Protected functions (will NOT be deleted):"
echo "  🔒 wa-webhook-mobility"
echo "  🔒 wa-webhook-profile"
echo "  🔒 wa-webhook-insurance"
echo ""
echo "Press Enter to continue or Ctrl+C to cancel..."
read

# Execute deletions
echo ""
echo -e "${YELLOW}🗑️  Executing Deletions${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DELETED=0
FAILED=0

for func in "${DELETIONS[@]}"; do
    echo -n "Deleting $func... "
    
    if supabase functions delete "$func" --project-ref "${SUPABASE_PROJECT_REF:-$(supabase projects list 2>/dev/null | grep -oE '[a-z]{20}' | head -1)}" 2>/tmp/delete-$func.log; then
        echo -e "${GREEN}✓ Deleted${NC}"
        ((DELETED++))
    else
        if grep -q "not found" /tmp/delete-$func.log; then
            echo -e "${YELLOW}⊘ Already deleted${NC}"
        else
            echo -e "${RED}✗ Failed${NC}"
            cat /tmp/delete-$func.log
            ((FAILED++))
        fi
    fi
done

# Count after
AFTER_COUNT=$(supabase functions list 2>/dev/null | grep -c "ACTIVE" || echo "0")

echo ""
echo -e "${GREEN}✅ Deletion Complete${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Successfully deleted: $DELETED"
echo "Failed: $FAILED"
echo "Functions before: $BEFORE_COUNT"
echo "Functions after: $AFTER_COUNT"
echo "Reduction: $((BEFORE_COUNT - AFTER_COUNT)) functions"
echo ""

# Verify protected functions
echo -e "${YELLOW}🔒 Verifying Protected Functions${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for func in "wa-webhook-mobility" "wa-webhook-profile" "wa-webhook-insurance"; do
    if supabase functions list 2>/dev/null | grep -q "| $func "; then
        echo -e "${GREEN}✓${NC} $func still active"
    else
        echo -e "${RED}✗ CRITICAL: $func missing!${NC}"
        exit 1
    fi
done

echo ""
echo -e "${GREEN}🎉 Week 4 Execution Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Monitor for 24 hours"
echo "2. Check error rates in Supabase dashboard"
echo "3. Proceed to Week 5 (webhook integration)"
echo ""
echo "Rollback: git checkout week4-pre-deletion"
echo "Logs: /tmp/delete-*.log"

