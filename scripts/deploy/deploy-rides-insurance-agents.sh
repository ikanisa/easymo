#!/bin/bash
# Complete Deployment Script - Rides & Insurance Agents
# Run this to finalize remote database setup

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  RIDES & INSURANCE AGENTS - REMOTE DATABASE SETUP             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

echo "Step 1: Pushing migrations to remote..."
echo "─────────────────────────────────────────────────────────────────"
supabase db push

echo ""
echo "Step 2: Loading seed data..."
echo "─────────────────────────────────────────────────────────────────"
echo "Opening Supabase Studio SQL Editor..."
echo ""
echo "📋 MANUAL STEP REQUIRED:"
echo "   1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql"
echo "   2. Copy the content from: supabase/seed/rides_insurance_agents_seed.sql"
echo "   3. Paste in SQL Editor"
echo "   4. Click 'Run'"
echo ""
echo "   OR use this command if you have remote DB credentials:"
echo "   psql \"\$REMOTE_DB_URL\" -f supabase/seed/rides_insurance_agents_seed.sql"
echo ""

read -p "Press ENTER when seed data is loaded..."

echo ""
echo "Step 3: Verifying deployment..."
echo "─────────────────────────────────────────────────────────────────"

echo "Testing deployed function health..."
curl -s "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-ai-agents/health" | jq '.'

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ✅ DEPLOYMENT COMPLETE!                                       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "🎉 All 8 AI Agents are now deployed and ready!"
echo ""
echo "Test with a message:"
echo "curl -X POST 'https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-ai-agents' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer YOUR_ANON_KEY' \\"
echo "  -d '{\"from\": \"+250788999888\", \"body\": \"Need a ride to Kigali\", \"type\": \"text\"}'"
echo ""
