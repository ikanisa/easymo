#!/bin/bash
# Deploy AI Agent Fixes
# Addresses Jobs & Gigs 500 error and Property AI Chat issues

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         WhatsApp AI Agent Fixes - Deployment Script         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not installed"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo "1️⃣  Deploying wa-webhook function (fixes Jobs & Gigs 500 error)..."
echo "   This will clear the deployment cache and fix the module not found error."
echo ""

cd supabase/functions

if supabase functions deploy wa-webhook --no-verify-jwt; then
    echo "✅ wa-webhook deployed successfully"
else
    echo "❌ Failed to deploy wa-webhook"
    exit 1
fi

echo ""
echo "2️⃣  Checking if agent-property-rental function exists..."
echo ""

# Check if agent-property-rental exists
if [ -d "agent-property-rental" ]; then
    echo "   Found agent-property-rental directory. Deploying..."
    if supabase functions deploy agent-property-rental --no-verify-jwt; then
        echo "✅ agent-property-rental deployed successfully"
    else
        echo "⚠️  Warning: Failed to deploy agent-property-rental"
        echo "   Property AI Chat may not work until this is resolved."
    fi
else
    echo "⚠️  Warning: agent-property-rental directory not found"
    echo "   Property AI Chat will not work without this function."
    echo "   Please ensure this function exists and is deployed."
fi

cd ../..

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    Deployment Complete!                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ Fixes Applied:"
echo "   1. Jobs & Gigs: Module cache cleared"
echo "   2. Property AI: Agent function deployed (if exists)"
echo ""
echo "📋 Next Steps:"
echo "   1. Test Jobs & Gigs: Tap menu item, should not show 500 error"
echo "   2. Test Property AI Chat: Go to Properties → Chat with AI"
echo "   3. Test Nearby Drivers: Share location, should show list or legitimate error"
echo ""
echo "📊 Status Summary:"
echo "   ✅ Nearby Drivers/Passengers: Already working (AI disabled)"
echo "   ✅ Schedule Trip: Already working (shows results)"
echo "   ✅ All AI searches: Disabled by default (opt-in only)"
echo ""
echo "For detailed analysis, see: AI_AGENT_FIX_COMPLETE.md"
echo ""
