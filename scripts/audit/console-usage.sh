#!/bin/bash
set -euo pipefail

echo "🔍 Auditing console.log usage across codebase..."
echo ""

# Directories to scan
DIRS=(
  "services"
  "packages"
  "admin-app/app"
  "admin-app/components"
  "admin-app/lib"
)

TOTAL=0
RESULTS_FILE="console-usage-audit.txt"
> "$RESULTS_FILE"

for dir in "${DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    continue
  fi
  
  echo "📁 Scanning $dir..."
  
  # Find all console.log, console.info, console.debug
  MATCHES=$(grep -rn "console\.\(log\|info\|debug\)" "$dir" \
    --include="*.ts" \
    --include="*.tsx" \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=.next \
    --exclude-dir=coverage \
    2>/dev/null || true)
  
  if [ -n "$MATCHES" ]; then
    COUNT=$(echo "$MATCHES" | wc -l | tr -d ' ')
    TOTAL=$((TOTAL + COUNT))
    echo "   Found $COUNT instances"
    echo "" >> "$RESULTS_FILE"
    echo "=== $dir ($COUNT instances) ===" >> "$RESULTS_FILE"
    echo "$MATCHES" >> "$RESULTS_FILE"
  else
    echo "   ✅ Clean"
  fi
done

echo ""
echo "=========================================="
echo "📊 Total console.* calls found: $TOTAL"
echo "=========================================="
echo ""
echo "Detailed results saved to: $RESULTS_FILE"

if [ $TOTAL -gt 0 ]; then
  echo ""
  echo "🔧 Recommended actions:"
  echo "1. Review $RESULTS_FILE for all instances"
  echo "2. Replace with structured logging:"
  echo "   - Services: import { childLogger } from '@easymo/commons'"
  echo "   - Edge functions: import { logStructuredEvent } from '../_shared/observability.ts'"
  echo "3. Run scripts/codemod/replace-console.sh (when created)"
  exit 1
else
  echo "✅ No console.* calls found!"
  exit 0
fi
