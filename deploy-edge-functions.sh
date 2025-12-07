#!/bin/bash

# Deploy Supabase Edge Functions with Preferred Suppliers Support
# Date: 2025-12-07

set -e

export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
PROJECT_REF="lhbowpbcpwoiparwnwgt"

echo "🚀 Deploying Supabase Edge Functions..."
echo "Project: $PROJECT_REF"
echo ""

# Functions that use the tool executor (via _shared)
FUNCTIONS_TO_DEPLOY=(
  "wa-webhook-core"
  "wa-webhook-buy-sell"
  "wa-webhook-mobility"
  "wa-webhook-property"
  "wa-webhook-jobs"
  "wa-webhook-insurance"
  "wa-agent-call-center"
  "wa-agent-waiter"
  "wa-agent-farmer"
  "wa-agent-support"
)

# Deploy each function
for func in "${FUNCTIONS_TO_DEPLOY[@]}"; do
  echo "📦 Deploying $func..."
  supabase functions deploy "$func" --project-ref "$PROJECT_REF" --no-verify-jwt
  
  if [ $? -eq 0 ]; then
    echo "✅ $func deployed successfully"
  else
    echo "❌ Failed to deploy $func"
  fi
  echo ""
done

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "To test the search_suppliers tool:"
echo "1. Call or message the Call Center AGI via WhatsApp"
echo "2. Say: 'I need 10kg of potatoes'"
echo "3. The AI should return Kigali Fresh Market with benefits"
echo ""
echo "Admin panel needs separate deployment:"
echo "  cd admin-app && npm run build"
