#!/bin/bash
set -euo pipefail

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Fix Observability Compliance${NC}"
echo -e "${BLUE}========================================${NC}\n"

SERVICES=(
  "services/attribution-service"
  "services/broker-orchestrator"
  "services/buyer-service"
  "services/ranking-service"
  "services/vendor-service"
  "services/voice-bridge"
  "services/whatsapp-webhook-worker"
)

FIXED=0
ERRORS=0

for service in "${SERVICES[@]}"; do
  service_name=$(basename "$service")
  echo -e "${YELLOW}Processing${NC} $service_name"
  
  # Find entry point
  entry_point=""
  for entry in "src/main.ts" "src/server.ts" "src/index.ts"; do
    if [ -f "$service/$entry" ]; then
      entry_point="$service/$entry"
      break
    fi
  done
  
  if [ -z "$entry_point" ]; then
    echo -e "  ${YELLOW}⚠${NC} No entry point found, skipping"
    continue
  fi
  
  # Check if already has logger import
  if grep -q "childLogger" "$entry_point" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Already has structured logging"
    continue
  fi
  
  # Add logger import after last import
  # Create temp file with logger import
  awk '
    /^import.*from/ { last_import = NR }
    { lines[NR] = $0 }
    END {
      for (i = 1; i <= NR; i++) {
        print lines[i]
        if (i == last_import) {
          print ""
          print "import { childLogger } from '\''@easymo/commons'\'';"
          print ""
          print "const log = childLogger({ service: '\'''"$service_name"''\'' });"
        }
      }
    }
  ' "$entry_point" > "$entry_point.tmp"
  
  mv "$entry_point.tmp" "$entry_point"
  FIXED=$((FIXED + 1))
  echo -e "  ${GREEN}✓${NC} Added structured logging import"
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Fixed: $FIXED services${NC}"
echo -e "${BLUE}========================================${NC}"

if [ $FIXED -gt 0 ]; then
  echo ""
  echo "Next steps:"
  echo "1. Review changes: git diff"
  echo "2. Run compliance check: node scripts/audit/observability-compliance.mjs"
  echo "3. Update service code to use log.info/warn/error"
  echo "4. Add correlation IDs to request handlers"
fi
