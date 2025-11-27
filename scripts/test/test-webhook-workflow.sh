#!/bin/bash
# Test WhatsApp Webhook Workflow
# Tests message deduplication, AI timeout handling, and retry mechanism

set -e

# Configuration
WEBHOOK_URL="${WEBHOOK_URL:-http://localhost:54321/functions/v1/wa-webhook}"
TEST_PHONE="+250788000000"
CORRELATION_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)

echo "==============================================="
echo "WhatsApp Webhook Workflow Testing"
echo "==============================================="
echo "Webhook URL: $WEBHOOK_URL"
echo "Test Phone: $TEST_PHONE"
echo "Correlation ID: $CORRELATION_ID"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to make webhook request
make_request() {
    local message_id=$1
    local text=$2
    local extra_params=${3:-""}
    
    echo -e "${YELLOW}Sending:${NC} $text (ID: $message_id)"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -H "X-Correlation-ID: $CORRELATION_ID" \
        -d "{
            \"message_id\": \"$message_id\",
            \"from\": \"$TEST_PHONE\",
            \"text\": \"$text\",
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"
            $extra_params
        }")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        echo -e "${GREEN}✓${NC} Success (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗${NC} Failed (HTTP $http_code)"
        echo "$body"
    fi
    
    echo ""
    return $([ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ])
}

# Test 1: Message Deduplication
echo "==============================================="
echo "Test 1: Message Deduplication"
echo "==============================================="
echo "Sending duplicate messages with same ID..."
echo ""

MESSAGE_ID_1="test_dedup_$(date +%s)"

# Send first message
make_request "$MESSAGE_ID_1" "Hello, this is a test message"

# Wait a bit
sleep 1

# Send duplicate (should be detected and handled)
echo "Sending duplicate message..."
make_request "$MESSAGE_ID_1" "Hello, this is a test message"

sleep 2

# Test 2: AI Agent Timeout Handling
echo "==============================================="
echo "Test 2: AI Agent Timeout Handling"
echo "==============================================="
echo "Testing AI agent with simulated processing..."
echo ""

MESSAGE_ID_2="test_ai_$(date +%s)"
make_request "$MESSAGE_ID_2" "/waiter recommend pasta" ", \"simulate_delay\": 5000"

sleep 3

# Test 3: Normal Workflow
echo "==============================================="
echo "Test 3: Normal Workflow"
echo "==============================================="
echo "Testing normal message processing..."
echo ""

MESSAGE_ID_3="test_normal_$(date +%s)"
make_request "$MESSAGE_ID_3" "Show me available jobs"

sleep 2

# Test 4: Retry Mechanism (if supported)
echo "==============================================="
echo "Test 4: Retry Mechanism"
echo "==============================================="
echo "Testing retry with simulated failure..."
echo ""

MESSAGE_ID_4="test_retry_$(date +%s)"
make_request "$MESSAGE_ID_4" "Process payment" ", \"simulate_failure\": true"

sleep 2

# Test 5: Rate Limiting
echo "==============================================="
echo "Test 5: Rate Limiting"
echo "==============================================="
echo "Sending rapid messages to test rate limiting..."
echo ""

for i in {1..5}; do
    MESSAGE_ID="test_rate_$(date +%s)_$i"
    make_request "$MESSAGE_ID" "Message $i" &
    sleep 0.2
done

wait

sleep 2

# Test 6: Workflow State Tracking
echo "==============================================="
echo "Test 6: Multi-Step Workflow"
echo "==============================================="
echo "Testing multi-step order workflow..."
echo ""

MESSAGE_ID_5="test_workflow_$(date +%s)_step1"
make_request "$MESSAGE_ID_5" "I want to order food"

sleep 1

MESSAGE_ID_6="test_workflow_$(date +%s)_step2"
make_request "$MESSAGE_ID_6" "Show me the menu"

sleep 1

MESSAGE_ID_7="test_workflow_$(date +%s)_step3"
make_request "$MESSAGE_ID_7" "I'll take item 1 and item 5"

sleep 2

# Summary
echo "==============================================="
echo "Test Summary"
echo "==============================================="
echo ""
echo "All tests completed. Check the logs and database for:"
echo "  1. Duplicate message detection in processed_webhook_messages"
echo "  2. Message queue entries in message_queue table"
echo "  3. Workflow states in workflow_states table"
echo "  4. AI conversation memory in ai_conversation_memory table"
echo "  5. Error entries in webhook_dlq table (if any failures)"
echo ""
echo "Run monitoring queries to verify system health:"
echo "  psql -f monitoring/webhook-health-checks.sql"
echo ""
echo -e "${GREEN}Testing complete!${NC}"
