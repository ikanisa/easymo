#!/bin/bash
# Test AI Agent Orchestrator
# Tests the full flow: message → intent → action → response

set -e

FUNCTION_URL="http://127.0.0.1:56311/functions/v1/wa-webhook-ai-agents"

echo "=== Testing AI Agent Orchestrator ==="
echo ""

# Test 1: Jobs Agent - Job Search
echo "Test 1: Jobs Agent - Job Search"
echo "Message: 'Find me software jobs in Kigali, salary > 500k'"
echo ""

curl -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep SUPABASE_SERVICE_ROLE_KEY .env | cut -d '=' -f2)" \
  -d '{
    "from": "+250788999888",
    "body": "Find me software jobs in Kigali, salary > 500k",
    "type": "text",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S")'"
  }' | jq '.'

echo ""
echo "---"
echo ""

# Test 2: Real Estate Agent - Property Search
echo "Test 2: Real Estate Agent - Property Search"
echo "Message: '2 bedroom apartment in Kimihurura, budget 300k/month'"
echo ""

curl -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep SUPABASE_SERVICE_ROLE_KEY .env | cut -d '=' -f2)" \
  -d '{
    "from": "+250788999777",
    "body": "2 bedroom apartment in Kimihurura, budget 300k/month",
    "type": "text",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S")'"
  }' | jq '.'

echo ""
echo "---"
echo ""

# Test 3: Waiter Agent - Menu Request
echo "Test 3: Waiter Agent - Menu Request"
echo "Message: 'Show me the menu please'"
echo ""

curl -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep SUPABASE_SERVICE_ROLE_KEY .env | cut -d '=' -f2)" \
  -d '{
    "from": "+250788999666",
    "body": "Show me the menu please",
    "type": "text",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S")'"
  }' | jq '.'

echo ""
echo "---"
echo ""

# Test 4: Business Broker - Business Search
echo "Test 4: Business Broker - Business Search"
echo "Message: 'Find restaurants near me'"
echo ""

curl -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep SUPABASE_SERVICE_ROLE_KEY .env | cut -d '=' -f2)" \
  -d '{
    "from": "+250788999555",
    "body": "Find restaurants near me",
    "type": "text",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S")'"
  }' | jq '.'

echo ""
echo "---"
echo ""

echo "=== Checking Database Records ==="
echo ""

# Check conversations created
echo "Active Conversations:"
psql "postgresql://postgres:postgres@127.0.0.1:57322/postgres" -c "
SELECT 
  c.id,
  wu.phone_number,
  a.slug as agent,
  c.status,
  c.last_message_at
FROM whatsapp_conversations c
JOIN whatsapp_users wu ON wu.id = c.user_id
JOIN ai_agents a ON a.id = c.agent_id
ORDER BY c.created_at DESC
LIMIT 5;
"

echo ""
echo "Recent Intents:"
psql "postgresql://postgres:postgres@127.0.0.1:57322/postgres" -c "
SELECT 
  i.intent_type,
  i.summary,
  i.structured_payload::text as payload,
  i.confidence,
  i.status,
  a.slug as agent
FROM ai_agent_intents i
JOIN ai_agents a ON a.id = i.agent_id
ORDER BY i.created_at DESC
LIMIT 5;
"

echo ""
echo "Message Count by Direction:"
psql "postgresql://postgres:postgres@127.0.0.1:57322/postgres" -c "
SELECT 
  direction,
  COUNT(*) as count
FROM whatsapp_messages
GROUP BY direction;
"

echo ""
echo "=== Test Complete ==="
