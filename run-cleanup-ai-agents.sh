#!/bin/bash
# Run AI agents cleanup script

cd /Users/jeanbosco/workspace/easymo

echo "🚀 Starting AI agents cleanup and consolidation..."
echo ""

psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" -f cleanup_ai_agents.sql

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy wa-webhook-buy-sell: supabase functions deploy wa-webhook-buy-sell --no-verify-jwt"
echo "2. Test 'Chat with Agent' menu"
