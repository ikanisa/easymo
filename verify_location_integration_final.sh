#!/bin/bash
set -e

echo "=========================================="
echo "Location Integration Final Verification"
echo "=========================================="
echo ""

echo "1. Checking all webhook functions exist..."
FUNCTIONS=(
  "wa-webhook-jobs"
  "wa-webhook-mobility"
  "wa-webhook-property"
  "wa-webhook-marketplace"
  "wa-webhook-ai-agents"
  "wa-webhook-profile"
  "wa-webhook-unified"
  "wa-webhook-insurance"
)

for func in "${FUNCTIONS[@]}"; do
  if [ -f "supabase/functions/$func/index.ts" ]; then
    echo "  ✅ $func"
  else
    echo "  ❌ $func - MISSING"
  fi
done

echo ""
echo "2. Checking location utilities..."
if [ -f "supabase/functions/_shared/location-resolver.ts" ]; then
  echo "  ✅ location-resolver.ts"
else
  echo "  ❌ location-resolver.ts - MISSING"
fi

if [ -f "supabase/functions/_shared/location-integration.ts" ]; then
  echo "  ✅ location-integration.ts"
else
  echo "  ❌ location-integration.ts - MISSING"
fi

echo ""
echo "3. Checking migrations..."
echo "  Location-related migrations:"
ls -1 supabase/migrations/*location* 2>/dev/null | wc -l | xargs echo "    Found:" || echo "    Found: 0"

echo ""
echo "4. Checking deployed functions..."
supabase functions list 2>&1 | grep "wa-webhook" | awk '{print "  " $4 " - v" $10 " - " $12 " " $13}'

echo ""
echo "5. Checking git status..."
git --no-pager log --oneline -1 | sed 's/^/  Latest commit: /'
git --no-pager status --short | head -10 | sed 's/^/  /'

echo ""
echo "=========================================="
echo "Verification Complete"
echo "=========================================="
