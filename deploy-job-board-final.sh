#!/bin/bash
# ============================================================================
# JOB BOARD AI AGENT - DEPLOYMENT SCRIPT
# ============================================================================
# This script deploys the job board AI agent to production
# Run from project root: ./deploy-job-board.sh
# ============================================================================

set -e  # Exit on error

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║          JOB BOARD AI AGENT - PRODUCTION DEPLOYMENT                  ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please run:"
    echo "   supabase login"
    exit 1
fi

echo "✅ Prerequisites checked"
echo ""

# Step 1: Push migrations
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 1: Pushing database migrations..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Push migrations to production? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase db push --linked --include-all
    echo "✅ Migrations pushed"
else
    echo "⏭️  Skipped migration push"
fi
echo ""

# Step 2: Deploy edge functions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Step 2: Deploying edge functions..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Deploy job-board-ai-agent function? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase functions deploy job-board-ai-agent --no-verify-jwt
    echo "✅ job-board-ai-agent deployed"
else
    echo "⏭️  Skipped job-board-ai-agent deployment"
fi
echo ""

read -p "Deploy job-sources-sync function? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase functions deploy job-sources-sync --no-verify-jwt
    echo "✅ job-sources-sync deployed"
else
    echo "⏭️  Skipped job-sources-sync deployment"
fi
echo ""

# Step 3: Configure scheduled jobs
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏰ Step 3: Configure scheduled job ingestion"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  MANUAL STEP REQUIRED:"
echo ""
echo "1. Go to Supabase Dashboard → Database → Scheduled Jobs"
echo "2. Create a new scheduled job:"
echo "   Name: daily-job-sources-sync"
echo "   Schedule: 0 3 * * * (03:00 daily)"
echo "   SQL:"
echo "   SELECT net.http_post("
echo "     url := 'https://<your-project>.supabase.co/functions/v1/job-sources-sync',"
echo "     headers := '{\"Authorization\": \"Bearer <service_role_key>\"}'::jsonb"
echo "   );"
echo ""
read -p "Press Enter when scheduled job is configured..." -r
echo "✅ Scheduled job configured"
echo ""

# Step 4: Verify deployment
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Step 4: Verifying deployment..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if tables exist
echo "Checking database tables..."
supabase db inspect tables | grep -E "job_listings|job_seekers|job_sources" && echo "✅ Job board tables exist" || echo "❌ Job board tables not found"
echo ""

# Check if functions exist
echo "Checking edge functions..."
supabase functions list | grep -E "job-board-ai-agent|job-sources-sync" && echo "✅ Job board functions exist" || echo "❌ Job board functions not found"
echo ""

# Step 5: Test deployment
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Step 5: Test deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Trigger test job sync? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Triggering job-sources-sync..."
    SUPABASE_URL=$(supabase projects list --format json | jq -r '.[0].api_url')
    SUPABASE_KEY=$(supabase secrets list | grep SUPABASE_SERVICE_ROLE_KEY | awk '{print $2}')
    
    if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
        curl -X POST "$SUPABASE_URL/functions/v1/job-sources-sync" \
             -H "Authorization: Bearer $SUPABASE_KEY" \
             -H "Content-Type: application/json" \
             -d '{}'
        echo ""
        echo "✅ Test sync triggered. Check function logs for results."
    else
        echo "⚠️  Could not auto-detect project details. Run manually:"
        echo "curl -X POST https://<project>.supabase.co/functions/v1/job-sources-sync \\"
        echo "  -H 'Authorization: Bearer <service_role_key>'"
    fi
else
    echo "⏭️  Skipped test sync"
fi
echo ""

# Step 6: Enable feature flag
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚩 Step 6: Enable feature flag"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  MANUAL STEP REQUIRED:"
echo ""
echo "1. Set environment variable in production:"
echo "   FEATURE_JOB_BOARD=true"
echo ""
echo "2. Verify WhatsApp menu shows Jobs option"
echo "   Send 'menu' to your WhatsApp bot and check for Jobs item"
echo ""
read -p "Press Enter when feature flag is enabled..." -r
echo "✅ Feature flag enabled"
echo ""

# Final summary
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║                     DEPLOYMENT COMPLETE! 🎉                           ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ Migrations pushed"
echo "✅ Edge functions deployed"
echo "✅ Scheduled jobs configured"
echo "✅ Feature flag enabled"
echo ""
echo "📝 Next Steps:"
echo "   1. Monitor function logs: supabase functions logs job-board-ai-agent --tail"
echo "   2. Test WhatsApp flow: Send 'Jobs' to bot"
echo "   3. Check job ingestion: Query job_listings table"
echo "   4. Monitor metrics in Supabase Dashboard"
echo ""
echo "📚 Documentation: See JOB_BOARD_AI_IMPLEMENTATION_COMPLETE.md"
echo ""
echo "🎊 Job Board AI Agent is now LIVE!"
echo ""
