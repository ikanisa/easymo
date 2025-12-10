#!/bin/bash
set -e

echo "🚀 EasyMO Unified Agent System - Production Enablement"
echo "======================================================"
echo ""
echo "This script will:"
echo "  1. Deploy the updated router with feature flag support"
echo "  2. Enable the unified agent system (agent.unified_system=true)"
echo "  3. Route ALL WhatsApp traffic to wa-webhook-ai-agents"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "📋 Step 1: Verify Prerequisites"
echo "--------------------------------"

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI not found. Please install it first."
  exit 1
fi

echo "✅ Supabase CLI found"

# Check if logged in
if ! supabase projects list &> /dev/null; then
  echo "❌ Not logged into Supabase. Run: supabase login"
  exit 1
fi

echo "✅ Supabase authenticated"

echo ""
echo "📦 Step 2: Deploy Updated Edge Functions"
echo "----------------------------------------"

# Deploy the updated router
echo "Deploying wa-webhook..."
supabase functions deploy wa-webhook --no-verify-jwt

# Deploy the ai-agents webhook
echo "Deploying wa-webhook-ai-agents..."
supabase functions deploy wa-webhook-ai-agents --no-verify-jwt

echo "✅ Edge functions deployed"

echo ""
echo "🔧 Step 3: Enable Feature Flag"
echo "-------------------------------"

# Get project ref
PROJECT_REF=$(supabase projects list | grep "│" | grep -v "ID" | head -1 | awk '{print $2}')

if [ -z "$PROJECT_REF" ]; then
  echo "❌ Could not determine project ref"
  exit 1
fi

echo "Project: $PROJECT_REF"

# Set the feature flag via Supabase CLI
echo "Setting FEATURE_AGENT_UNIFIED_SYSTEM=true..."

supabase secrets set FEATURE_AGENT_UNIFIED_SYSTEM=true

echo "✅ Feature flag enabled"

echo ""
echo "🧪 Step 4: Verify Deployment"
echo "---------------------------"

# Check health endpoint
SUPABASE_URL=$(supabase status | grep "API URL" | awk '{print $3}')
if [ -z "$SUPABASE_URL" ]; then
  echo "⚠️  Could not verify deployment (URL not found)"
else
  echo "Checking wa-webhook-ai-agents health..."
  curl -s "${SUPABASE_URL}/functions/v1/wa-webhook-ai-agents/health" | jq . || echo "Health check endpoint not responding"
fi

echo ""
echo "✅ Deployment Complete!"
echo "======================="
echo ""
echo "The unified agent system is now ENABLED in production."
echo ""
echo "📊 Monitoring:"
echo "  - All WhatsApp messages will route to wa-webhook-ai-agents"
echo "  - Check logs: supabase functions logs wa-webhook-ai-agents"
echo "  - Check metrics in Supabase dashboard"
echo ""
echo "🔄 To rollback:"
echo "  supabase secrets set FEATURE_AGENT_UNIFIED_SYSTEM=false"
echo ""
echo "📝 Next steps:"
echo "  1. Monitor logs for 15-30 minutes"
echo "  2. Verify all 8 agents are working correctly"
echo "  3. Check user satisfaction metrics"
echo ""
