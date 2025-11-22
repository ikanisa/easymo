#!/bin/bash
# =====================================================================
# DEPLOY COMPLETE AGENT SYSTEM - Phase 2 (90%)
# =====================================================================
# Deploys: Agent framework + Consolidated webhook + Test function
# Run from project root: ./deploy-complete-system.sh
# =====================================================================

set -e

echo "🚀 EasyMO Complete Agent System Deployment"
echo "==========================================="
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: supabase CLI not found"
    echo "Install it: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Step 1: Deploy database migrations
echo "📋 Step 1: Deploy Database Migrations"
echo "--------------------------------------"
read -p "Deploy migrations (seed agents + apply_intent_waiter)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Applying migrations..."
    supabase db push
    echo "✅ Migrations applied"
    echo ""
    echo "Verifying agents seeded..."
    supabase db query "SELECT slug, name, is_active FROM ai_agents ORDER BY slug;"
    echo ""
else
    echo "⏭️  Skipped migrations"
fi

# Step 2: Deploy functions
echo ""
echo "🧪 Step 2: Deploy Functions"
echo "---------------------------"
read -p "Deploy agent-framework-test function? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase functions deploy agent-framework-test
    echo "✅ Test function deployed"
else
    echo "⏭️  Skipped test function"
fi

echo ""
read -p "Deploy wa-webhook-consolidated function? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase functions deploy wa-webhook-consolidated
    echo "✅ Webhook deployed"
else
    echo "⏭️  Skipped webhook"
fi

# Step 3: Set environment variables
echo ""
echo "🔧 Step 3: Set Environment Variables"
echo "------------------------------------"
read -p "Set WhatsApp environment variables? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Enter WhatsApp Verify Token (or press Enter to skip):"
    read VERIFY_TOKEN
    if [ ! -z "$VERIFY_TOKEN" ]; then
        supabase secrets set WHATSAPP_VERIFY_TOKEN="$VERIFY_TOKEN"
    fi
    
    echo "Enter WhatsApp Phone Number ID (or press Enter to skip):"
    read PHONE_NUMBER_ID
    if [ ! -z "$PHONE_NUMBER_ID" ]; then
        supabase secrets set WHATSAPP_PHONE_NUMBER_ID="$PHONE_NUMBER_ID"
    fi
    
    echo "Enter WhatsApp Access Token (or press Enter to skip):"
    read ACCESS_TOKEN
    if [ ! -z "$ACCESS_TOKEN" ]; then
        supabase secrets set WHATSAPP_ACCESS_TOKEN="$ACCESS_TOKEN"
    fi
else
    echo "⏭️  Skipped environment variables"
fi

# Step 4: Feature flag
echo ""
echo "🚦 Step 4: Feature Flag"
echo "----------------------"
echo "USE_NEW_AGENT_FRAMEWORK controls whether new webhook processes messages"
echo "  false (default) = Safe, webhook deployed but inactive"
echo "  true = Active, webhook processes all messages"
echo ""
read -p "Enable feature flag (USE_NEW_AGENT_FRAMEWORK=true)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase secrets set USE_NEW_AGENT_FRAMEWORK=true
    echo "✅ Feature flag ENABLED - webhook is now ACTIVE"
else
    supabase secrets set USE_NEW_AGENT_FRAMEWORK=false
    echo "✅ Feature flag DISABLED - webhook deployed but inactive (safe)"
fi

# Step 5: Verify deployment
echo ""
echo "📊 Step 5: Verify Deployment"
echo "----------------------------"
echo "Checking agents in database..."
supabase db query "SELECT * FROM ai_agents_seeded_v;" || echo "⚠️  View not found (run migration first)"

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TESTING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Get your Supabase project URL:"
echo "   supabase status | grep 'API URL'"
echo ""
echo "2. Test the framework:"
echo '   curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/agent-framework-test" \'
echo '     -H "Content-Type: application/json" \'
echo '     -H "Authorization: Bearer YOUR_ANON_KEY" \'
echo '     -d '"'"'{"agentSlug": "waiter", "userPhone": "+250788000001", "message": "Show me bars"}'"'"
echo ""
echo "3. Monitor webhook logs:"
echo "   supabase functions logs wa-webhook-consolidated --tail"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 DOCUMENTATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "- Architecture map:          docs/architecture/agents-map.md"
echo "- Framework guide:           docs/architecture/AGENT_FRAMEWORK_PHASE2_COMPLETE.md"
echo "- Progress tracker:          docs/architecture/PROGRESS.md"
echo "- Webhook documentation:     supabase/functions/wa-webhook-consolidated/README.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 YOU'RE READY TO GO!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
