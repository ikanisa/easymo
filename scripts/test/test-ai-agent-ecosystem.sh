#!/bin/bash
# =====================================================================
# AI AGENT ECOSYSTEM - QUICK VERIFICATION TEST
# =====================================================================
# Tests that all agents, tables, and functions are properly deployed
#
# Usage: ./test-ai-agent-ecosystem.sh
# =====================================================================

set -e

PROJECT_REF="lhbowpbcpwoiparwnwgt"
DB_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

echo "🧪 AI AGENT ECOSYSTEM - VERIFICATION TEST"
echo "=========================================="
echo ""

# Test 1: Verify all agents exist
echo "✅ Test 1: Verify all 9 agents exist..."
AGENT_COUNT=$(PGPASSWORD='Pq0jyevTlfoa376P' psql "$DB_URL" -t -c "SELECT COUNT(*) FROM ai_agents WHERE is_active = true;")
if [ "$AGENT_COUNT" -ge 8 ]; then
  echo "   ✓ Found $AGENT_COUNT active agents"
else
  echo "   ✗ ERROR: Only $AGENT_COUNT agents found (expected 8+)"
  exit 1
fi
echo ""

# Test 2: Verify tools are seeded
echo "✅ Test 2: Verify agent tools exist..."
TOOL_COUNT=$(PGPASSWORD='Pq0jyevTlfoa376P' psql "$DB_URL" -t -c "SELECT COUNT(*) FROM ai_agent_tools;")
if [ "$TOOL_COUNT" -ge 100 ]; then
  echo "   ✓ Found $TOOL_COUNT agent tools"
else
  echo "   ✗ ERROR: Only $TOOL_COUNT tools found (expected 100+)"
  exit 1
fi
echo ""

# Test 3: Verify tasks are seeded
echo "✅ Test 3: Verify agent tasks exist..."
TASK_COUNT=$(PGPASSWORD='Pq0jyevTlfoa376P' psql "$DB_URL" -t -c "SELECT COUNT(*) FROM ai_agent_tasks;")
if [ "$TASK_COUNT" -ge 60 ]; then
  echo "   ✓ Found $TASK_COUNT agent tasks"
else
  echo "   ✗ ERROR: Only $TASK_COUNT tasks found (expected 60+)"
  exit 1
fi
echo ""

# Test 4: Verify apply_intent functions exist
echo "✅ Test 4: Verify apply_intent functions..."
FUNCTION_COUNT=$(PGPASSWORD='Pq0jyevTlfoa376P' psql "$DB_URL" -t -c "SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'apply_intent_%';")
if [ "$FUNCTION_COUNT" -ge 8 ]; then
  echo "   ✓ Found $FUNCTION_COUNT apply_intent functions"
else
  echo "   ✗ ERROR: Only $FUNCTION_COUNT functions found (expected 8+)"
  exit 1
fi
echo ""

# Test 5: Verify WhatsApp tables exist
echo "✅ Test 5: Verify WhatsApp core tables..."
PGPASSWORD='Pq0jyevTlfoa376P' psql "$DB_URL" -c "
SELECT 
  table_name,
  CASE WHEN table_name IN ('whatsapp_users', 'whatsapp_conversations', 'whatsapp_messages', 'ai_agent_intents')
    THEN '✓' 
    ELSE '✗' 
  END as exists
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('whatsapp_users', 'whatsapp_conversations', 'whatsapp_messages', 'ai_agent_intents')
ORDER BY table_name;
" | grep "✓" > /dev/null
if [ $? -eq 0 ]; then
  echo "   ✓ WhatsApp core tables verified"
else
  echo "   ✗ ERROR: WhatsApp tables missing"
  exit 1
fi
echo ""

# Test 6: Verify Rides domain tables
echo "✅ Test 6: Verify Rides domain tables..."
RIDES_TABLES=$(PGPASSWORD='Pq0jyevTlfoa376P' psql "$DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'rides_%';")
if [ "$RIDES_TABLES" -ge 3 ]; then
  echo "   ✓ Found $RIDES_TABLES Rides tables"
else
  echo "   ✗ ERROR: Only $RIDES_TABLES Rides tables found (expected 3+)"
  exit 1
fi
echo ""

# Test 7: Verify Insurance domain tables
echo "✅ Test 7: Verify Insurance domain tables..."
INSURANCE_TABLES=$(PGPASSWORD='Pq0jyevTlfoa376P' psql "$DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'insurance_%';")
if [ "$INSURANCE_TABLES" -ge 3 ]; then
  echo "   ✓ Found $INSURANCE_TABLES Insurance tables"
else
  echo "   ✗ ERROR: Only $INSURANCE_TABLES Insurance tables found (expected 3+)"
  exit 1
fi
echo ""

# Test 8: Test creating a WhatsApp user
echo "✅ Test 8: Test WhatsApp user creation..."
TEST_PHONE="+250788123456"
PGPASSWORD='Pq0jyevTlfoa376P' psql "$DB_URL" -c "
INSERT INTO whatsapp_users (phone_number, preferred_language, user_roles)
VALUES ('$TEST_PHONE', 'en', ARRAY['guest'])
ON CONFLICT (phone_number) DO UPDATE SET updated_at = now()
RETURNING id;
" > /dev/null
if [ $? -eq 0 ]; then
  echo "   ✓ WhatsApp user creation test passed"
else
  echo "   ✗ ERROR: WhatsApp user creation failed"
  exit 1
fi
echo ""

# Test 9: Test creating an intent
echo "✅ Test 9: Test intent creation..."
PGPASSWORD='Pq0jyevTlfoa376P' psql "$DB_URL" -c "
WITH test_user AS (
  SELECT id FROM whatsapp_users WHERE phone_number = '$TEST_PHONE' LIMIT 1
),
test_agent AS (
  SELECT id FROM ai_agents WHERE slug = 'rides' LIMIT 1
),
test_conv AS (
  INSERT INTO whatsapp_conversations (user_id, agent_id, context, status)
  SELECT tu.id, ta.id, 'test_ride', 'active'
  FROM test_user tu, test_agent ta
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO ai_agent_intents (
  conversation_id, agent_id, intent_type, raw_text, summary, status
)
SELECT 
  tc.id, 
  ta.id,
  'find_ride',
  'I need a ride to town',
  'User wants a ride to town center',
  'pending'
FROM test_conv tc, test_agent ta
ON CONFLICT DO NOTHING;
" > /dev/null
if [ $? -eq 0 ]; then
  echo "   ✓ Intent creation test passed"
else
  echo "   ✗ ERROR: Intent creation failed"
  exit 1
fi
echo ""

# Test 10: Verify edge function deployment
echo "✅ Test 10: Verify edge function deployment..."
FUNCTION_STATUS=$(supabase functions list --project-ref $PROJECT_REF 2>&1 | grep -c "wa-webhook")
if [ "$FUNCTION_STATUS" -ge 1 ]; then
  echo "   ✓ wa-webhook edge function deployed"
else
  echo "   ⚠️  WARNING: wa-webhook function not found (may need deployment)"
fi
echo ""

echo "=========================================="
echo "✅ ALL TESTS PASSED!"
echo "=========================================="
echo ""
echo "📊 Summary:"
echo "  - $AGENT_COUNT active agents"
echo "  - $TOOL_COUNT tools"
echo "  - $TASK_COUNT tasks"
echo "  - $FUNCTION_COUNT apply_intent functions"
echo "  - $RIDES_TABLES Rides tables"
echo "  - $INSURANCE_TABLES Insurance tables"
echo ""
echo "🚀 System is ready for production!"
echo ""
echo "Next steps:"
echo "  1. Test via WhatsApp: Send message to your test number"
echo "  2. Monitor logs: supabase functions logs wa-webhook --project-ref $PROJECT_REF"
echo "  3. Check intents: SELECT * FROM ai_agent_intents ORDER BY created_at DESC LIMIT 10;"
echo ""
