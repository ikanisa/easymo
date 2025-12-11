#!/bin/bash
# cleanup-microservices.sh
# Execute with: bash cleanup-microservices.sh

set -e

SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-lhbowpbcpwoiparwnwgt}"
ARCHIVE_DIR=".archive/cleanup-$(date +%Y%m%d)"

echo "🗑️ EasyMO Microservices Deep Cleanup"
echo "====================================="
echo "Archive directory: $ARCHIVE_DIR"
echo ""

# Create archive directory
mkdir -p "$ARCHIVE_DIR/functions"
mkdir -p "$ARCHIVE_DIR/services"
mkdir -p "$ARCHIVE_DIR/scripts"

# ============================================
# PHASE 1: Delete Edge Functions from Supabase
# ============================================
echo "📦 Phase 1: Deleting Edge Functions from Supabase..."

EDGE_FUNCTIONS_TO_DELETE=(
  # Consolidation artifacts (already deleted locally)
  "webhook-traffic-router"
  "wa-webhook-buy-sell-agent"
  "wa-webhook-buy-sell-directory"
  
  # Debug functions
  "debug-auth-users"
  "diagnostic"
  "bootstrap-admin"
  
  # Duplicate AI agents
  "agent-property-rental"
  "wa-agent-call-center"
  "wa-agent-farmer"
  "wa-agent-support"
  "wa-agent-waiter"
  "ai-contact-queue"
  "ai-lookup-customer"
  
  # Duplicate SMS functions
  "momo-sms-webhook"
  "momo-statement-poller"
  "sms-ai-parse"
  "sms-inbound-webhook"
  "sms-inbox"
  "sms-review"
  
  # Notification consolidation
  "notification-dispatch-email"
  "notification-dispatch-whatsapp"
  "send-push-notification"
  "wallet-notifications"
  
  # OCR consolidation
  "vehicle-ocr"
  "insurance-ocr"
  
  # Unused/Legacy
  "analytics-forecast"
  "availability-refresh"
  "edits"
  "generate"
  "group-contribute"
  "ibimina"
  "invite-user"
  "notify-buyers"
  "openai-deep-research"
  "openai-realtime-sip"
  "openai-sip-webhook"
  "post-call-notify"
  "process-user-intents"
  "reports-export"
  "reporting-summary"
  "sip-voice-webhook"
  "tool-contact-owner-whatsapp"
  "tool-notify-user"
  "tool-shortlist-rank"
  "metrics-anomaly-detector"
  "export-allocation"
  "export-report"
  "export-statement"
)

for func in "${EDGE_FUNCTIONS_TO_DELETE[@]}"; do
  echo "  Deleting from Supabase: $func"
  supabase functions delete "$func" --project-ref "$SUPABASE_PROJECT_REF" 2>/dev/null || echo "    ⚠️  Not found or already deleted"
done

echo "✅ Phase 1 complete"
echo ""

# ============================================
# PHASE 2: Archive Edge Functions Locally
# ============================================
echo "📦 Phase 2: Archiving Edge Functions locally..."

for func in "${EDGE_FUNCTIONS_TO_DELETE[@]}"; do
  if [ -d "supabase/functions/$func" ]; then
    echo "  Archiving: $func"
    mv "supabase/functions/$func" "$ARCHIVE_DIR/functions/"
  fi
done

echo "✅ Phase 2 complete"
echo ""

# ============================================
# PHASE 3: Archive Node.js Services
# ============================================
echo "📦 Phase 3: Archiving Node.js Services..."

SERVICES_TO_DELETE=(
  "voice-media-bridge"
  "voice-media-server"
  "whatsapp-voice-bridge"
  "webrtc-media-bridge"
  "wa-webhook-ai-agents"
  "whatsapp-webhook-worker"
  "cache-layer"
  "whatsapp-pricing-server"
)

for svc in "${SERVICES_TO_DELETE[@]}"; do
  if [ -d "services/$svc" ]; then
    echo "  Archiving: $svc"
    mv "services/$svc" "$ARCHIVE_DIR/services/"
  fi
done

echo "✅ Phase 3 complete"
echo ""

# ============================================
# PHASE 4: Delete Obsolete Scripts
# ============================================
echo "📦 Phase 4: Archiving obsolete scripts..."

SCRIPTS_TO_DELETE=(
  "scripts/week6-setup-infrastructure.sh"
  "scripts/consolidation-week5-integration.sh"
  "scripts/consolidation/week7-deprecation.sh"
  "scripts/monitor-agent-config-loading.sh"
)

for script in "${SCRIPTS_TO_DELETE[@]}"; do
  if [ -f "$script" ]; then
    echo "  Archiving: $script"
    mkdir -p "$ARCHIVE_DIR/scripts/$(dirname $script | xargs basename)"
    mv "$script" "$ARCHIVE_DIR/scripts/$(basename $script)" 2>/dev/null || true
  fi
done

echo "✅ Phase 4 complete"
echo ""

# ============================================
# SUMMARY
# ============================================
echo "====================================="
echo "🎉 Cleanup Complete!"
echo "====================================="
echo ""
echo "Archived to: $ARCHIVE_DIR"
echo ""
echo "Items processed:"
echo "  - Edge Functions: ${#EDGE_FUNCTIONS_TO_DELETE[@]}"
echo "  - Services: ${#SERVICES_TO_DELETE[@]}"
echo "  - Scripts: ${#SCRIPTS_TO_DELETE[@]}"
echo ""
echo "Next steps:"
echo "  1. Review changes: git status"
echo "  2. git add -A"
echo "  3. git commit -m 'chore: deep cleanup of unused microservices'"
echo "  4. git push origin main"
echo ""
echo "To restore any item:"
echo "  mv $ARCHIVE_DIR/functions/<name> supabase/functions/"
echo "  supabase functions deploy <name>"
