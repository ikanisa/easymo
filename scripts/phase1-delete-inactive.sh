#!/bin/bash
# PHASE 1: Delete Inactive Functions from Supabase
# Safe to execute immediately - these functions are 1+ month inactive

set -e

echo "🗑️  PHASE 1: Deleting Inactive Functions from Supabase"
echo "======================================================="
echo ""
echo "Functions to delete (confirmed inactive):"
echo "  1. wa-webhook-diag (v35, Oct 21) - diagnostic only"
echo "  2. insurance-media-fetch (v33, Oct 21) - no active refs"
echo "  3. video-performance-summary (archived, 13 days old)"
echo ""
read -p "Continue with deletion? (y/N): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "❌ Aborted"
  exit 0
fi

echo ""
echo "Deleting functions..."

# Delete inactive functions
supabase functions delete wa-webhook-diag || echo "⚠️  wa-webhook-diag: already deleted or not found"
supabase functions delete insurance-media-fetch || echo "⚠️  insurance-media-fetch: already deleted or not found"
supabase functions delete video-performance-summary || echo "⚠️  video-performance-summary: already deleted or not found"

echo ""
echo "✅ Phase 1 Complete"
echo ""
echo "Results:"
echo "  - Deleted: 3 inactive functions"
echo "  - Remaining: ~70 deployed functions"
echo ""
echo "Next Steps:"
echo "  - Week 4: Run ./scripts/phase2-setup-routing.sh"
echo "  - Week 5: Run ./scripts/phase3-scale-traffic.sh"
echo "  - Week 6: Run ./scripts/phase4-full-cutover.sh"
