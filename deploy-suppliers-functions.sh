#!/bin/bash
# Preferred Suppliers Edge Functions Deployment Script
# Run this script to deploy all edge functions with the updated tool-executor

set -e  # Exit on error

echo "=================================================="
echo "Preferred Suppliers Edge Functions Deployment"
echo "=================================================="
echo ""
echo "Date: $(date)"
echo "Project: lhbowpbcpwoiparwnwgt"
echo ""

# Set credentials
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
export DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

PROJECT_REF="lhbowpbcpwoiparwnwgt"

echo "✅ Environment configured"
echo ""

# Change to project directory
cd "$(dirname "$0")"
echo "📁 Working directory: $(pwd)"
echo ""

# Verify Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI version: $(supabase --version)"
echo ""

# Functions to deploy (in order of importance)
declare -a FUNCTIONS=(
    "wa-agent-call-center"
    "wa-webhook-core"
    "wa-webhook-buy-sell"
    "wa-webhook-mobility"
    "wa-webhook-property"
    "wa-webhook-jobs"
    "wa-webhook-insurance"
    "wa-agent-waiter"
    "wa-agent-farmer"
    "wa-agent-support"
)

TOTAL=${#FUNCTIONS[@]}
SUCCESS=0
FAILED=0

echo "=================================================="
echo "Starting deployment of $TOTAL functions..."
echo "=================================================="
echo ""

# Deploy each function
for i in "${!FUNCTIONS[@]}"; do
    FUNC="${FUNCTIONS[$i]}"
    NUM=$((i + 1))
    
    echo "[$NUM/$TOTAL] Deploying $FUNC..."
    
    if supabase functions deploy "$FUNC" --project-ref "$PROJECT_REF" --no-verify-jwt; then
        echo "   ✅ $FUNC deployed successfully"
        ((SUCCESS++))
    else
        echo "   ❌ Failed to deploy $FUNC"
        ((FAILED++))
    fi
    
    echo ""
    sleep 2  # Brief pause between deployments
done

# Summary
echo "=================================================="
echo "Deployment Summary"
echo "=================================================="
echo "Total functions: $TOTAL"
echo "✅ Successful: $SUCCESS"
echo "❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 All functions deployed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Test via WhatsApp: 'I need 10kg of potatoes'"
    echo "2. Check function logs:"
    echo "   supabase functions logs wa-agent-call-center --project-ref $PROJECT_REF --tail"
    echo "3. Expected response: Kigali Fresh Market with 10% discount"
    echo ""
else
    echo "⚠️  Some deployments failed. Check errors above."
    echo ""
    echo "To retry individual functions:"
    echo "   supabase functions deploy FUNCTION_NAME --project-ref $PROJECT_REF --no-verify-jwt"
    echo ""
fi

echo "Deployment completed at: $(date)"
echo "=================================================="
