#!/bin/bash
# Validation script for webhook enhancement implementation
# Checks migration syntax, file structure, and documentation

set -e

echo "=== Webhook Enhancement Validation ==="
echo ""

# Check migration files exist
echo "✓ Checking migration files..."
test -f supabase/migrations/20251116050500_webhook_state_management.sql || (echo "✗ State management migration missing" && exit 1)
test -f supabase/migrations/20251116050600_webhook_monitoring_views.sql || (echo "✗ Monitoring views migration missing" && exit 1)
echo "  ✓ Both migrations present"

# Check migrations have BEGIN/COMMIT
echo ""
echo "✓ Checking migration hygiene..."
if ! grep -q "^BEGIN;" supabase/migrations/20251116050500_webhook_state_management.sql; then
  echo "✗ State management migration missing BEGIN"
  exit 1
fi
if ! grep -q "^COMMIT;" supabase/migrations/20251116050500_webhook_state_management.sql; then
  echo "✗ State management migration missing COMMIT"
  exit 1
fi
if ! grep -q "^BEGIN;" supabase/migrations/20251116050600_webhook_monitoring_views.sql; then
  echo "✗ Monitoring views migration missing BEGIN"
  exit 1
fi
if ! grep -q "^COMMIT;" supabase/migrations/20251116050600_webhook_monitoring_views.sql; then
  echo "✗ Monitoring views migration missing COMMIT"
  exit 1
fi
echo "  ✓ All migrations have BEGIN/COMMIT wrappers"

# Check shared utilities exist
echo ""
echo "✓ Checking shared utilities..."
test -f supabase/functions/_shared/ai-agent-orchestrator.ts || (echo "✗ AI orchestrator missing" && exit 1)
test -f supabase/functions/_shared/webhook-utils.ts || (echo "✗ Webhook utils missing" && exit 1)
test -f supabase/functions/_shared/observability.ts || (echo "✗ Observability module missing" && exit 1)
echo "  ✓ All shared utilities present"

# Check enhanced processor exists
echo ""
echo "✓ Checking enhanced processor..."
test -f supabase/functions/wa-webhook/router/enhanced_processor.ts || (echo "✗ Enhanced processor missing" && exit 1)
echo "  ✓ Enhanced processor present"

# Check documentation exists
echo ""
echo "✓ Checking documentation..."
test -f WEBHOOK_ENHANCEMENT_GUIDE.md || (echo "✗ Implementation guide missing" && exit 1)
echo "  ✓ Implementation guide present"

# Check for required tables in migration
echo ""
echo "✓ Checking migration content..."
tables=(
  "webhook_conversations"
  "processed_webhook_messages"
  "webhook_dlq"
  "agent_contexts"
  "agent_sessions"
  "conversation_state_transitions"
)

for table in "${tables[@]}"; do
  if ! grep -q "CREATE TABLE.*${table}" supabase/migrations/20251116050500_webhook_state_management.sql; then
    echo "✗ Table ${table} not found in migration"
    exit 1
  fi
done
echo "  ✓ All required tables present in migration"

# Check for required indexes
echo ""
echo "✓ Checking indexes..."
indexes=(
  "idx_webhook_conversations_user_status"
  "idx_processed_messages_whatsapp_id"
  "idx_webhook_dlq_retry"
  "idx_agent_contexts_conversation"
  "idx_agent_sessions_conversation"
  "idx_state_transitions_conversation"
)

for index in "${indexes[@]}"; do
  if ! grep -q "${index}" supabase/migrations/20251116050500_webhook_state_management.sql; then
    echo "✗ Index ${index} not found in migration"
    exit 1
  fi
done
echo "  ✓ All required indexes present"

# Check for monitoring views
echo ""
echo "✓ Checking monitoring views..."
views=(
  "webhook_conversation_health"
  "stuck_webhook_conversations"
  "webhook_agent_performance"
  "webhook_message_processing_metrics"
  "webhook_dlq_summary"
)

for view in "${views[@]}"; do
  if ! grep -q "${view}" supabase/migrations/20251116050600_webhook_monitoring_views.sql; then
    echo "✗ View ${view} not found in migration"
    exit 1
  fi
done
echo "  ✓ All monitoring views present"

# Check for helper functions
echo ""
echo "✓ Checking helper functions..."
functions=(
  "cleanup_stuck_webhook_conversations"
  "acquire_conversation_lock"
  "release_conversation_lock"
  "increment_session_metrics"
  "check_webhook_system_health"
  "get_webhook_performance_stats"
)

for func in "${functions[@]}"; do
  if ! grep -q "${func}" supabase/migrations/20251116050*.sql; then
    echo "✗ Function ${func} not found in migrations"
    exit 1
  fi
done
echo "  ✓ All helper functions present"

# Check for RLS policies
echo ""
echo "✓ Checking RLS policies..."
if ! grep -q "ENABLE ROW LEVEL SECURITY" supabase/migrations/20251116050500_webhook_state_management.sql; then
  echo "✗ RLS not enabled"
  exit 1
fi
if ! grep -q "CREATE POLICY service_role_all" supabase/migrations/20251116050500_webhook_state_management.sql; then
  echo "✗ Service role policies not found"
  exit 1
fi
echo "  ✓ RLS policies configured"

# Check TypeScript files for imports
echo ""
echo "✓ Checking TypeScript imports..."
if ! grep -q "logStructuredEvent" supabase/functions/_shared/webhook-utils.ts; then
  echo "✗ webhook-utils.ts missing observability imports"
  exit 1
fi
if ! grep -q "logStructuredEvent" supabase/functions/_shared/ai-agent-orchestrator.ts; then
  echo "✗ ai-agent-orchestrator.ts missing observability imports"
  exit 1
fi
echo "  ✓ All TypeScript files properly import observability"

# Summary
echo ""
echo "==================================="
echo "✓ All validation checks passed!"
echo "==================================="
echo ""
echo "Migration files:"
echo "  - 20251116050500_webhook_state_management.sql ($(wc -l < supabase/migrations/20251116050500_webhook_state_management.sql) lines)"
echo "  - 20251116050600_webhook_monitoring_views.sql ($(wc -l < supabase/migrations/20251116050600_webhook_monitoring_views.sql) lines)"
echo ""
echo "Shared utilities:"
echo "  - _shared/ai-agent-orchestrator.ts ($(wc -l < supabase/functions/_shared/ai-agent-orchestrator.ts) lines)"
echo "  - _shared/webhook-utils.ts ($(wc -l < supabase/functions/_shared/webhook-utils.ts) lines)"
echo "  - router/enhanced_processor.ts ($(wc -l < supabase/functions/wa-webhook/router/enhanced_processor.ts) lines)"
echo ""
echo "Documentation:"
echo "  - WEBHOOK_ENHANCEMENT_GUIDE.md ($(wc -l < WEBHOOK_ENHANCEMENT_GUIDE.md) lines)"
echo ""
echo "Next steps:"
echo "  1. Review changes with: git diff origin/main"
echo "  2. Apply migrations with: supabase db push"
echo "  3. Enable feature with: WA_ENHANCED_PROCESSING=true"
echo "  4. Monitor with: SELECT * FROM check_webhook_system_health();"
