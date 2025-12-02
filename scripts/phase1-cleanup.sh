#!/bin/bash
# Phase 1: Critical Cleanup Script
# Run from repository root

set -e  # Exit on error

echo "🧹 Phase 1: Critical Cleanup Starting..."
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track removed files
REMOVED_COUNT=0
MOVED_COUNT=0

# Function to safely remove file
remove_file() {
    local file=$1
    if [ -f "$file" ]; then
        echo -e "${YELLOW}Removing:${NC} $file"
        rm "$file"
        ((REMOVED_COUNT++))
        echo -e "${GREEN}✓ Removed${NC}"
    else
        echo -e "${RED}⚠ Not found:${NC} $file"
    fi
}

# Function to move file
move_file() {
    local source=$1
    local dest=$2
    if [ -f "$source" ]; then
        mkdir -p "$(dirname "$dest")"
        echo -e "${YELLOW}Moving:${NC} $source → $dest"
        mv "$source" "$dest"
        ((MOVED_COUNT++))
        echo -e "${GREEN}✓ Moved${NC}"
    else
        echo -e "${RED}⚠ Not found:${NC} $source"
    fi
}

echo ""
echo "📁 Step 1: Removing backup files from wa-webhook-profile..."
echo "------------------------------------------------------------"
remove_file "supabase/functions/wa-webhook-profile/index.ts.bak"

echo ""
echo "📁 Step 2: Cleaning up wa-webhook-mobility..."
echo "----------------------------------------------"
remove_file "supabase/functions/wa-webhook-mobility/index.ts.bak"
move_file "supabase/functions/wa-webhook-mobility/EXTRACTION_NOTES.md" "docs/archive/mobility-extraction-notes.md"

echo ""
echo "📁 Step 3: Removing backup files from wa-webhook-insurance..."
echo "--------------------------------------------------------------"
remove_file "supabase/functions/wa-webhook-insurance/index.ts.bak"
remove_file "supabase/functions/wa-webhook-insurance/index.ts.bak2"
remove_file "supabase/functions/wa-webhook-insurance/index.ts.bak3"
remove_file "supabase/functions/wa-webhook-insurance/insurance/index.ts.bak"

echo ""
echo "========================================="
echo -e "${GREEN}✅ Cleanup Complete!${NC}"
echo "   Files removed: $REMOVED_COUNT"
echo "   Files moved: $MOVED_COUNT"
echo "========================================="

# Verify no backup files remain in target services
echo ""
echo "🔍 Verifying no backup files remain in target services..."
REMAINING=$(find supabase/functions/wa-webhook-{core,profile,mobility,insurance} -name "*.bak*" -type f 2>/dev/null | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo -e "${RED}⚠ Warning: $REMAINING backup file(s) still found:${NC}"
    find supabase/functions/wa-webhook-{core,profile,mobility,insurance} -name "*.bak*" -type f
    exit 1
else
    echo -e "${GREEN}✓ No backup files remaining in target services${NC}"
fi

echo ""
echo "📝 Next steps:"
echo "   1. Run 'deno check' on all index.ts files"
echo "   2. Deploy all microservices"
echo "   3. Verify health endpoints"
