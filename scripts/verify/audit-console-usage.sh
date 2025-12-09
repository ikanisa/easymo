#!/bin/bash
set -euo pipefail

echo "🔍 Auditing console.log usage..."

# Find all console.log/debug/info (excluding console.warn/error which are allowed)
RESULTS=$(grep -rn "console\.\(log\|debug\|info\)" \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=.archive \
  --exclude-dir=.next \
  services/ packages/ admin-app/ 2>/dev/null || true)

if [ -z "$RESULTS" ]; then
  echo "✅ No console.log usage found!"
  exit 0
fi

COUNT=$(echo "$RESULTS" | wc -l | xargs)
echo "❌ Found $COUNT instances of console.log/debug/info:"
echo ""
echo "$RESULTS" | head -20

if [ $COUNT -gt 20 ]; then
  echo ""
  echo "... and $((COUNT - 20)) more"
fi

echo ""
echo "📝 Fix by replacing with structured logging:"
echo "  import { childLogger } from '@easymo/commons';"
echo "  const log = childLogger({ service: 'your-service' });"
echo "  log.info({ data }, 'message');"

exit 1
