#!/bin/bash
# =====================================================================
# AI Agent Ecosystem - Manual Deployment Script
# =====================================================================
# Use this when connection pool is overloaded
# =====================================================================

set -e

echo "🚀 AI Agent Ecosystem Deployment Script"
echo "========================================"
echo ""

# Check if we should wait for pool to recover
if [ "$1" == "--wait" ]; then
  echo "⏳ Waiting 15 minutes for connection pool to recover..."
  sleep 900
fi

echo "📊 Step 1: Push database migrations..."
echo "--------------------------------------"
supabase db push --include-all

if [ $? -eq 0 ]; then
  echo "✅ Database migrations pushed successfully!"
else
  echo "❌ Database push failed. You can:"
  echo "   Option 1: Wait and retry with: ./deploy-ai-agents.sh --wait"
  echo "   Option 2: Manually execute SQL via Supabase Dashboard:"
  echo "             https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql"
  echo ""
  echo "   Files to execute manually:"
  echo "   - supabase/migrations/20251122073000_ai_agent_ecosystem_schema.sql"
  echo "   - supabase/migrations/20251122073100_seed_ai_agents_complete.sql"
  exit 1
fi

echo ""
echo "🔍 Step 2: Verify agent data..."
echo "--------------------------------------"
supabase db query "SELECT slug, name, is_active FROM ai_agents ORDER BY slug;"

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Implement agent personas & system instructions"
echo "2. Register agent tools"
echo "3. Define agent tasks"
echo "4. Create intent processor"
echo "5. Update wa-webhook router"
echo ""
echo "See: AI_AGENT_ECOSYSTEM_IMPLEMENTATION_COMPLETE.md for details"
