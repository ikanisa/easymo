#!/bin/bash

# Quick verification script for wa-webhook-core infrastructure
# Checks that all components are deployed and working

set -e

echo "🔍 Verifying wa-webhook-core infrastructure..."
echo ""

# Check environment
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
  exit 1
fi

SUCCESS_COUNT=0
FAIL_COUNT=0

check() {
  local name="$1"
  local command="$2"
  
  echo -n "  → $name... "
  
  if eval "$command" > /dev/null 2>&1; then
    echo "✅"
    ((SUCCESS_COUNT++))
  else
    echo "❌"
    ((FAIL_COUNT++))
  fi
}

echo "📦 Checking Edge Functions..."

# Check if functions exist
check "wa-webhook-core deployed" \
  "curl -s -f $SUPABASE_URL/functions/v1/wa-webhook-core/health"

check "dlq-processor deployed" \
  "supabase functions list | grep -q dlq-processor"

check "session-cleanup deployed" \
  "supabase functions list | grep -q session-cleanup"

echo ""
echo "🗄️  Checking Database Tables..."

# Check tables exist
check "whatsapp_home_menu_items exists" \
  "supabase db exec 'SELECT 1 FROM whatsapp_home_menu_items LIMIT 1'"

check "wa_dead_letter_queue exists" \
  "supabase db exec 'SELECT 1 FROM wa_dead_letter_queue LIMIT 1'"

check "user_sessions exists" \
  "supabase db exec 'SELECT 1 FROM user_sessions LIMIT 1'"

echo ""
echo "⏰ Checking Scheduled Jobs..."

check "pg_cron extension enabled" \
  "supabase db exec 'SELECT 1 FROM pg_extension WHERE extname = '\''pg_cron'\'''"

check "dlq-processor job scheduled" \
  "supabase db exec 'SELECT 1 FROM cron.job WHERE jobname = '\''dlq-processor'\'''"

check "session-cleanup job scheduled" \
  "supabase db exec 'SELECT 1 FROM cron.job WHERE jobname = '\''session-cleanup'\'''"

echo ""
echo "🧪 Testing Function Endpoints..."

# Test DLQ processor
DLQ_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/functions/v1/dlq-processor" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}')

if echo "$DLQ_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "  → dlq-processor responds correctly... ✅"
  ((SUCCESS_COUNT++))
else
  echo "  → dlq-processor responds correctly... ❌"
  echo "     Response: $DLQ_RESPONSE"
  ((FAIL_COUNT++))
fi

# Test session cleanup
CLEANUP_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/functions/v1/session-cleanup" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}')

if echo "$CLEANUP_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "  → session-cleanup responds correctly... ✅"
  ((SUCCESS_COUNT++))
else
  echo "  → session-cleanup responds correctly... ❌"
  echo "     Response: $CLEANUP_RESPONSE"
  ((FAIL_COUNT++))
fi

echo ""
echo "📊 Summary"
echo "  ✅ Passed: $SUCCESS_COUNT"
echo "  ❌ Failed: $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo "🎉 All checks passed! Infrastructure is ready."
  exit 0
else
  echo "⚠️  Some checks failed. Review the output above."
  exit 1
fi
