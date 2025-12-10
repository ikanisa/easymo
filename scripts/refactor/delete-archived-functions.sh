#!/bin/bash
# Delete archived functions from Supabase
# Run with: SUPABASE_PROJECT_REF=your-ref ./scripts/refactor/delete-archived-functions.sh

set -e

if [ -z "$SUPABASE_PROJECT_REF" ]; then
  echo "Error: SUPABASE_PROJECT_REF not set"
  exit 1
fi

echo "🗑️  Deleting 22 archived functions from Supabase..."

# Agent Duplicates (13)
for func in agent-chat agent-config-invalidator agent-monitor agent-negotiation \
            agent-property-rental agent-quincaillerie agent-runner agent-schedule-trip \
            agent-shops agent-tools-general-broker agents job-board-ai-agent waiter-ai-agent; do
  echo "Deleting $func..."
  supabase functions delete $func --project-ref $SUPABASE_PROJECT_REF || echo "⚠️  $func not found (may already be deleted)"
done

# Inactive Functions (9)
for func in admin-subscriptions campaign-dispatch cart-reminder flow-exchange \
            flow-exchange-mock housekeeping order-pending-reminder simulator wa-webhook-diag; do
  echo "Deleting $func..."
  supabase functions delete $func --project-ref $SUPABASE_PROJECT_REF || echo "⚠️  $func not found (may already be deleted)"
done

echo "✅ Phase 2 Supabase cleanup complete!"
echo "📊 Verify with: supabase functions list --project-ref $SUPABASE_PROJECT_REF"
