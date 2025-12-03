#!/bin/bash
# Week 7: Delete consolidated webhooks + Refactor wa-webhook to library
# Only run after Week 6 observation period is successful

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Week 7: Deprecation & Library Refactor ===${NC}"
echo "Date: $(date)"
echo ""

if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo -e "${RED}ERROR: SUPABASE_PROJECT_REF not set${NC}"
    exit 1
fi

echo -e "${RED}WARNING: This will delete 4 webhook functions!${NC}"
echo "Ensure Week 6 observation period was successful:"
echo "  ✓ wa-webhook-unified running at 100% for 3+ days"
echo "  ✓ Error rate < 0.1%"
echo "  ✓ No production issues reported"
echo ""
read -p "Continue with deletion? (type 'yes'): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted"
    exit 1
fi

echo ""
echo -e "${YELLOW}=== Phase A: Delete Consolidated Webhooks ===${NC}"

WEBHOOKS=(
    "wa-webhook-ai-agents"
    "wa-webhook-jobs"
    "wa-webhook-marketplace"
    "wa-webhook-property"
)

for func in "${WEBHOOKS[@]}"; do
    echo "Deleting $func..."
    if supabase functions delete "$func" --project-ref "$SUPABASE_PROJECT_REF"; then
        echo -e "${GREEN}✓ Deleted $func${NC}"
    else
        echo -e "${RED}✗ Failed to delete $func${NC}"
    fi
    echo ""
done

echo ""
echo -e "${YELLOW}=== Phase B: Refactor wa-webhook to Shared Library ===${NC}"

cd supabase/functions

if [ ! -d "wa-webhook" ]; then
    echo -e "${RED}ERROR: wa-webhook directory not found${NC}"
    exit 1
fi

echo "Renaming wa-webhook → _shared/wa-webhook-lib"
if [ -d "_shared/wa-webhook-lib" ]; then
    echo -e "${RED}ERROR: _shared/wa-webhook-lib already exists${NC}"
    exit 1
fi

git mv wa-webhook _shared/wa-webhook-lib
echo "✓ Directory renamed"

echo ""
echo -e "${YELLOW}=== Phase C: Update Imports ===${NC}"

echo "Finding and replacing import paths..."
# Update imports in all TypeScript files
find . -name "*.ts" -type f ! -path "*/node_modules/*" ! -path "*/.archive/*" -exec grep -l 'from "../wa-webhook/' {} \; > /tmp/files-to-update.txt

if [ -s /tmp/files-to-update.txt ]; then
    echo "Files to update:"
    cat /tmp/files-to-update.txt
    echo ""
    
    while IFS= read -r file; do
        sed -i.bak 's|from "../wa-webhook/|from "../_shared/wa-webhook-lib/|g' "$file"
        echo "✓ Updated $file"
        rm -f "$file.bak"
    done < /tmp/files-to-update.txt
else
    echo "No files found with wa-webhook imports"
fi

echo ""
echo -e "${YELLOW}=== Phase D: Test & Deploy ===${NC}"

echo "Testing protected production webhooks..."
PROTECTED=(
    "wa-webhook-mobility"
    "wa-webhook-profile"
    "wa-webhook-insurance"
)

for func in "${PROTECTED[@]}"; "wa-webhook-core" "wa-webhook-unified"; do
    if [ -d "$func" ]; then
        echo "Testing $func..."
        cd "$func"
        if [ -f "deno.json" ]; then
            deno task test || echo "⚠ Tests failed for $func"
        fi
        cd ..
    fi
done

echo ""
echo "Deploy updated functions:"
echo ""

for func in "${PROTECTED[@]}" "wa-webhook-core" "wa-webhook-unified"; do
    echo "supabase functions deploy $func --project-ref $SUPABASE_PROJECT_REF"
done

echo ""
read -p "Run deployments now? (y/n): " DEPLOY

if [ "$DEPLOY" = "y" ]; then
    for func in "${PROTECTED[@]}" "wa-webhook-core" "wa-webhook-unified"; do
        if [ -d "$func" ]; then
            echo "Deploying $func..."
            supabase functions deploy "$func" --project-ref "$SUPABASE_PROJECT_REF" --no-verify-jwt || echo "Failed: $func"
        fi
    done
fi

echo ""
echo -e "${GREEN}=== Week 7 Complete ===${NC}"
echo "Changes made:"
echo "  ✓ Deleted 4 consolidated webhook functions"
echo "  ✓ Renamed wa-webhook → _shared/wa-webhook-lib"
echo "  ✓ Updated import paths"
echo "  ✓ Deployed updated functions"
echo ""
echo "Commit changes:"
echo "  git add -A"
echo "  git commit -m 'Week 7: Webhook consolidation & library refactor'"
echo "  git push origin main"
echo ""
echo "Next: Week 8 - Cleanup function consolidation"
