#!/bin/bash
set -euo pipefail

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔄 Replacing console.log with structured logging${NC}\n"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo -e "${YELLOW}⚠️  DRY RUN MODE - No files will be modified${NC}\n"
fi

# Find all webhook functions
WEBHOOK_FUNCTIONS=$(find supabase/functions -name "index.ts" -not -path "*/_shared/*" -not -path "*/node_modules/*")

COUNT=0

for file in $WEBHOOK_FUNCTIONS; do
  # Check if file has console.log
  if grep -q "console\." "$file" 2>/dev/null; then
    echo -e "${BLUE}📝 Processing: $file${NC}"
    
    # Count occurrences
    OCCURRENCES=$(grep -c "console\." "$file" || true)
    echo "   Found $OCCURRENCES console statements"
    
    if [ "$DRY_RUN" = false ]; then
      # Create backup
      cp "$file" "${file}.bak"
      
      # Check if file already imports logStructuredEvent
      if ! grep -q "logStructuredEvent" "$file"; then
        # Add import after other imports
        sed -i '' '/^import.*from.*observability/!{/^import/a\
import { logStructuredEvent } from "../_shared/observability.ts";
}' "$file" 2>/dev/null || true
      fi
      
      # Replace common console patterns with structured logging
      # This is a simple replacement - manual review still needed
      sed -i '' 's/console\.log(\(.*\))/await logStructuredEvent("LOG", { data: \1 })/g' "$file" 2>/dev/null || true
      sed -i '' 's/console\.info(\(.*\))/await logStructuredEvent("INFO", { data: \1 })/g' "$file" 2>/dev/null || true
      sed -i '' 's/console\.warn(\(.*\))/await logStructuredEvent("WARNING", { data: \1 })/g' "$file" 2>/dev/null || true
      sed -i '' 's/console\.error(\(.*\))/await logStructuredEvent("ERROR", { data: \1 })/g' "$file" 2>/dev/null || true
      
      echo "   ✅ Replaced with structured logging"
      COUNT=$((COUNT + 1))
    else
      echo "   → Would replace console statements"
    fi
    echo ""
  fi
done

if [ "$DRY_RUN" = false ]; then
  echo -e "${GREEN}✅ Processed $COUNT files${NC}"
  echo ""
  echo "⚠️  IMPORTANT: Review changes manually!"
  echo "   - Check that event names are meaningful"
  echo "   - Verify data structures are correct"
  echo "   - Add correlation IDs where needed"
  echo ""
  echo "To restore backups: find supabase/functions -name '*.bak' -exec bash -c 'mv \"\$0\" \"\${0%.bak}\"' {} \;"
else
  echo -e "${YELLOW}Run without --dry-run to apply changes${NC}"
fi
