#!/bin/bash
# EasyMO Repository Cleanup - Phase 3 (Voice Services Removal)
# Description: Removes ALL voice call services and related code
# Risk Level: HIGH - Only run if WhatsApp text-only strategy is confirmed
# Estimated Cleanup: ~11MB

set -e

BACKUP_NAME="easymo-voice-services-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🗑️  EasyMO Repository Cleanup - Phase 3 (Voice Services Removal)"
echo "================================================================="
echo "Repository: $REPO_ROOT"
echo "Backup: $BACKUP_NAME"
echo ""

cd "$REPO_ROOT"

# Check if we're in a git repo
if [ ! -d ".git" ]; then
  echo "❌ Error: Not in a git repository"
  exit 1
fi

# CRITICAL WARNING
echo "⚠️  🚨 CRITICAL WARNING 🚨 ⚠️"
echo ""
echo "This script will PERMANENTLY REMOVE all voice call capabilities:"
echo ""
echo "Services:"
echo "  • services/voice-bridge/ (Twilio ↔ OpenAI Realtime bridge)"
echo "  • services/sip-ingress/ (SIP webhook handler)"
echo "  • services/ai-realtime/ (OpenAI Realtime API integration)"
echo ""
echo "Apps:"
echo "  • apps/voice-agent/"
echo "  • apps/voice-bridge/"
echo "  • apps/sip-webhook/"
echo ""
echo "Edge Functions:"
echo "  • supabase/functions/ai-realtime-webhook/"
echo ""
echo "Tests:"
echo "  • tests/voice/"
echo ""
echo "⚠️  This action CANNOT be easily undone!"
echo "⚠️  Only proceed if:"
echo "    1. Product team has confirmed WhatsApp text-only strategy"
echo "    2. No voice features are planned for 6+ months"
echo "    3. You have a full backup of the repository"
echo ""
read -p "Type 'REMOVE_VOICE_SERVICES' to continue: " confirm

if [ "$confirm" != "REMOVE_VOICE_SERVICES" ]; then
  echo "❌ Aborted. Voice services preserved."
  exit 1
fi

echo ""
echo "📦 Step 1/7: Creating comprehensive backup..."
tar -czf "$BACKUP_NAME" \
  services/voice-bridge/ \
  services/sip-ingress/ \
  services/ai-realtime/ \
  supabase/functions/ai-realtime-webhook/ \
  apps/voice-agent/ \
  apps/voice-bridge/ \
  apps/sip-webhook/ \
  tests/voice/ \
  docker-compose-agent-core.yml \
  2>/dev/null || echo "  (Some items may not exist)"

echo "  ✅ Backup created: $BACKUP_NAME (KEEP THIS SAFE!)"
echo ""

echo "🗑️  Step 2/7: Removing voice-bridge service..."
if [ -d "services/voice-bridge/" ]; then
  du -sh services/voice-bridge/ 2>/dev/null || true
  rm -rf services/voice-bridge/
  echo "  ✅ Removed: services/voice-bridge/ (~5MB)"
else
  echo "  ⏭️  Already removed: services/voice-bridge/"
fi
echo ""

echo "🗑️  Step 3/7: Removing sip-ingress service..."
if [ -d "services/sip-ingress/" ]; then
  du -sh services/sip-ingress/ 2>/dev/null || true
  rm -rf services/sip-ingress/
  echo "  ✅ Removed: services/sip-ingress/ (~3MB)"
else
  echo "  ⏭️  Already removed: services/sip-ingress/"
fi
echo ""

echo "🗑️  Step 4/7: Removing ai-realtime service..."
if [ -d "services/ai-realtime/" ]; then
  du -sh services/ai-realtime/ 2>/dev/null || true
  rm -rf services/ai-realtime/
  echo "  ✅ Removed: services/ai-realtime/ (~2MB)"
else
  echo "  ⏭️  Already removed: services/ai-realtime/"
fi
echo ""

echo "🗑️  Step 5/7: Removing voice apps..."
removed_apps=0
for app in "apps/voice-agent" "apps/voice-bridge" "apps/sip-webhook"; do
  if [ -d "$app/" ]; then
    du -sh "$app/" 2>/dev/null || true
    rm -rf "$app/"
    echo "  ✅ Removed: $app/"
    ((removed_apps++))
  fi
done
if [ $removed_apps -eq 0 ]; then
  echo "  ⏭️  No voice apps to remove"
fi
echo ""

echo "🗑️  Step 6/7: Removing voice Edge Function..."
if [ -d "supabase/functions/ai-realtime-webhook/" ]; then
  du -sh supabase/functions/ai-realtime-webhook/ 2>/dev/null || true
  rm -rf supabase/functions/ai-realtime-webhook/
  echo "  ✅ Removed: supabase/functions/ai-realtime-webhook/"
else
  echo "  ⏭️  Already removed: ai-realtime-webhook/"
fi
echo ""

echo "🗑️  Step 7/7: Removing voice tests..."
if [ -d "tests/voice/" ]; then
  du -sh tests/voice/ 2>/dev/null || true
  rm -rf tests/voice/
  echo "  ✅ Removed: tests/voice/"
else
  echo "  ⏭️  Already removed: tests/voice/"
fi
echo ""

echo "✅ Phase 3 Complete!"
echo ""
echo "📊 Summary:"
echo "  • Removed 3 voice services (voice-bridge, sip-ingress, ai-realtime)"
echo "  • Removed 3 voice apps"
echo "  • Removed 1 voice Edge Function"
echo "  • Removed voice tests"
echo "  • Total cleanup: ~11MB"
echo ""
echo "💾 BACKUP SAVED (CRITICAL): $BACKUP_NAME"
echo ""
echo "⚠️  MANUAL ACTION REQUIRED:"
echo ""
echo "  1. Edit docker-compose-agent-core.yml and REMOVE these services:"
echo "     • voice-bridge"
echo "     • sip-ingress"
echo ""
echo "  2. Review and update documentation:"
echo "     • README.md (remove voice references)"
echo "     • docs/ARCHITECTURE.md (remove voice diagrams)"
echo "     • docs/services/ (remove voice service docs)"
echo ""
echo "  3. Update .github/workflows/*.yml if voice services are referenced"
echo ""
echo "🔧 Next steps:"
echo "  1. Review changes: git status"
echo "  2. Manually update docker-compose-agent-core.yml"
echo "  3. Install dependencies: pnpm install"
echo "  4. Test build: pnpm build"
echo "  5. Run tests: pnpm exec vitest run"
echo "  6. Verify services still work: docker-compose up -d"
echo "  7. If all good, commit:"
echo "     git add -A"
echo "     git commit -m 'chore: remove voice services for WhatsApp-only focus (Phase 3)'"
echo ""
echo "⚠️  To restore from backup if needed:"
echo "     tar -xzf $BACKUP_NAME"
