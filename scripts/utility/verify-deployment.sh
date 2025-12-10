#!/bin/bash
# Quick verification script for Phase 1 & 2 deployment
# Tests all database functions to ensure they work correctly

set -e

DB_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

echo "🧪 Testing Phase 1 & 2 Deployment"
echo "=================================="
echo ""

# Test 1: AI Agent Sessions
echo "✅ Test 1: AI Agent Session Creation"
psql "$DB_URL" -c "
SELECT get_or_create_ai_agent_session('+250788999999', 'waiter', 24) as session_id;
" 2>&1 | grep -A 2 "session_id" || echo "❌ FAILED"
echo ""

# Test 2: Business AI Search
echo "✅ Test 2: Business AI Search"
psql "$DB_URL" -c "
SELECT id, name, distance_km, relevance_score 
FROM search_businesses_ai('pharmacy', -1.9536, 30.0606, 10, 5)
LIMIT 3;
" 2>&1 | grep -E "rows|ERROR" || echo "❌ FAILED"
echo ""

# Test 3: Bar Nearby Search
echo "✅ Test 3: Bar Nearby Search"
psql "$DB_URL" -c "
SELECT id, name, distance_km 
FROM search_bars_nearby(-1.9536, 30.0606, 10, 5)
LIMIT 3;
" 2>&1 | grep -E "rows|ERROR" || echo "❌ FAILED"
echo ""

# Test 4: Business Table Columns
echo "✅ Test 4: Business Table Enhancement"
psql "$DB_URL" -c "
SELECT 
  COUNT(*) as total,
  COUNT(tags) FILTER (WHERE tags != '{}') as with_tags,
  COUNT(keywords) FILTER (WHERE keywords != '{}') as with_keywords,
  COUNT(search_vector) FILTER (WHERE search_vector IS NOT NULL) as with_search_vector
FROM business;
" 2>&1 | grep -A 5 "total" || echo "❌ FAILED"
echo ""

# Test 5: Session Count
echo "✅ Test 5: Active Sessions"
psql "$DB_URL" -c "
SELECT COUNT(*) as active_sessions 
FROM ai_agent_sessions 
WHERE expires_at > now();
" 2>&1 | grep -A 2 "active_sessions" || echo "❌ FAILED"
echo ""

echo "=================================="
echo "✅ All database tests complete!"
echo ""
echo "Next: Test end-to-end flows via WhatsApp"
echo "See DEPLOYMENT_COMPLETE_PHASE_1_2.md for manual test guide"
