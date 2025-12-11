#!/bin/bash
# =====================================================================
# Monitor Agent Database Config Loading
# =====================================================================
# Checks Supabase function logs for database config loading events
# Usage: ./scripts/monitor-agent-config-loading.sh
# =====================================================================

set -e

echo "📊 Monitoring Agent Config Loading Events..."
echo ""
echo "Checking last 100 log entries from wa-webhook-unified..."
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install with: brew install supabase/tap/supabase"
    exit 1
fi

# Tail logs and filter for config loading events
supabase functions logs wa-webhook-unified --limit 100 2>&1 | grep -E "AGENT_CONFIG|loadedFrom|buildPromptAsync|DB_CONFIG" || echo "⚠️  No config loading events found in recent logs"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 What to look for:"
echo ""
echo "✅ GOOD SIGNS:"
echo "  - \"event\": \"AGENT_CONFIG_LOADED\""
echo "  - \"loadedFrom\": \"database\""
echo "  - \"hasPersona\": true"
echo "  - \"hasInstructions\": true"
echo "  - \"toolsCount\": > 0"
echo ""
echo "⚠️  WARNING SIGNS:"
echo "  - \"loadedFrom\": \"fallback\""
echo "  - \"DB_CONFIG_LOAD_FAILED\""
echo "  - \"AGENT_CONFIG_FALLBACK\""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Tip: Run with --tail to stream live logs:"
echo "   supabase functions logs wa-webhook-unified --tail"
echo ""
