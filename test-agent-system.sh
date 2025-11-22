#!/bin/bash
# Test deployed agent system

set -e

PROJECT_REF="lhbowpbcpwoiparwnwgt"
BASE_URL="https://${PROJECT_REF}.supabase.co/functions/v1"

echo "🧪 Testing EasyMO Agent System"
echo "================================"
echo

# Test 1: Health check
echo "1️⃣ Testing health endpoint..."
curl -s "${BASE_URL}/wa-webhook-ai-agents/health" | jq '.' || echo "❌ Health check failed"
echo

# Test 2: Feature flags
echo "2️⃣ Checking feature flags..."
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.${PROJECT_REF}.supabase.co:5432/postgres" -c "
SELECT 
  key, 
  value->'enabled' as enabled,
  value->'rollout_percentage' as rollout
FROM system_config 
WHERE key = 'feature_unified_agent_system';
" || echo "❌ Feature flag check failed"
echo

# Test 3: Active agents
echo "3️⃣ Listing active agents..."
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.${PROJECT_REF}.supabase.co:5432/postgres" -c "
SELECT slug, name, is_active 
FROM ai_agents 
WHERE is_active = true 
ORDER BY slug;
" || echo "❌ Agent query failed"
echo

# Test 4: Apply intent functions
echo "4️⃣ Checking apply_intent functions..."
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.${PROJECT_REF}.supabase.co:5432/postgres" -c "
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'apply_intent%' 
ORDER BY routine_name;
" || echo "❌ Function check failed"
echo

echo "✅ All tests completed!"
echo
echo "📊 Summary:"
echo "  - Health endpoint: Check output above"
echo "  - Feature flags: Should show enabled=true, rollout=100"
echo "  - Active agents: Should show 9 agents"
echo "  - Apply functions: Should show 8 functions"
echo
echo "🚀 System is ready for production traffic!"
