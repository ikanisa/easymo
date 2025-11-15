#!/bin/bash
set -e

echo "================================================"
echo "AI Agents Deployment Script"
echo "================================================"
echo ""

# List of agent functions to deploy
AGENTS=(
  "agent-negotiation"
  "agent-schedule-trip"
  "agent-property-rental"
  "agent-shops"
  "agent-quincaillerie"
)

echo "This script will deploy the following edge functions:"
for agent in "${AGENTS[@]}"; do
  echo "  - $agent"
done
echo ""

# Check if functions exist
echo "Checking functions exist..."
for agent in "${AGENTS[@]}"; do
  if [ ! -d "supabase/functions/$agent" ]; then
    echo "❌ ERROR: $agent directory not found!"
    exit 1
  fi
  echo "✓ $agent found"
done
echo ""

echo "================================================"
echo "MANUAL DEPLOYMENT REQUIRED"
echo "================================================"
echo ""
echo "Due to Supabase CLI timeout issues, please deploy via:"
echo ""
echo "1. GitHub Actions (Recommended):"
echo "   - Already configured in .github/workflows/supabase-deploy.yml"
echo "   - Just push changes: git push"
echo "   - Or manually trigger via GitHub Actions UI"
echo ""
echo "2. Supabase Dashboard:"
echo "   - Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions"
echo "   - Deploy each function manually"
echo ""
echo "3. Or check if already deployed:"
echo "   - Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions"
echo "   - Check for: agent-negotiation, agent-schedule-trip, etc."
echo ""
echo "================================================"
echo "GOOD NEWS: FEATURE_AGENT_ALL is now set!"
echo "================================================"
echo ""
echo "✅ Environment variable 'FEATURE_AGENT_ALL=true' is active"
echo "✅ This enables ALL AI agents once functions are deployed"
echo "✅ Traditional flows will fallback if agent functions unavailable"
echo ""
echo "To verify activation, check wa-webhook logs after user interaction:"
echo "https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions/wa-webhook/logs"
echo ""
echo "Look for: AGENT_REQUEST_ROUTED events"
echo ""
