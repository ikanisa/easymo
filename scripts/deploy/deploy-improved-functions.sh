#!/bin/bash
# Deploy Improved Edge Functions
# Deploys the new buyer-alert-scheduler and updated functions

set -e

PROJECT_REF="${SUPABASE_PROJECT_REF:-lhbowpbcpwoiparwnwgt}"

echo "🚀 Deploying Improved Edge Functions"
echo "====================================="
echo "Project: $PROJECT_REF"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Functions to deploy in order
FUNCTIONS=(
  "buyer-alert-scheduler"  # New function
  "notify-buyers"          # Updated (split from dual-purpose)
  "wa-webhook-mobility"    # Updated (structured logging)
  "wa-webhook-profile"     # Updated (cache management)
  "wa-webhook-insurance"   # Updated (phone validation)
)

SUCCESS=0
FAILED=0

for func in "${FUNCTIONS[@]}"; do
  echo -n "📦 Deploying $func... "
  
  if supabase functions deploy "$func" --project-ref "$PROJECT_REF" --no-verify-jwt 2>&1; then
    echo -e "${GREEN}✅${NC}"
    SUCCESS=$((SUCCESS + 1))
  else
    echo -e "${RED}❌${NC}"
    FAILED=$((FAILED + 1))
  fi
  echo ""
done

echo "====================================="
echo "Deployment Summary"
echo "====================================="
echo -e "${GREEN}✅ Successful: $SUCCESS${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ Failed: $FAILED${NC}"
fi
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 All functions deployed successfully!"
  echo ""
  echo "Next steps:"
  echo "1. Test buyer-alert-scheduler: curl https://$PROJECT_REF.supabase.co/functions/v1/buyer-alert-scheduler/health"
  echo "2. Test notify-buyers: curl https://$PROJECT_REF.supabase.co/functions/v1/notify-buyers/health"
  echo "3. Monitor logs: supabase functions logs --project-ref $PROJECT_REF"
else
  echo "⚠️  Some deployments failed. Check the output above for details."
  exit 1
fi

