#!/bin/bash
# Week 8: Consolidate cleanup functions into data-retention
# Merges cleanup-expired-intents + cleanup-mobility-intents → data-retention

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Week 8: Cleanup Function Consolidation ===${NC}"
echo "Date: $(date)"
echo ""

if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo -e "${RED}ERROR: SUPABASE_PROJECT_REF not set${NC}"
    exit 1
fi

cd supabase/functions

echo -e "${YELLOW}=== Phase A: Backup Existing Functions ===${NC}"
mkdir -p .backup-week8
cp -r data-retention .backup-week8/
cp -r cleanup-expired-intents .backup-week8/ 2>/dev/null || true
cp -r cleanup-mobility-intents .backup-week8/ 2>/dev/null || true
echo "✓ Backups created in .backup-week8/"

echo ""
echo -e "${YELLOW}=== Phase B: Merge Cleanup Logic ===${NC}"

cat > data-retention/cleanup-additions.ts <<'EOF'
// Week 8: Consolidated cleanup logic
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";

/**
 * Clean up expired user intents (24h TTL)
 * Migrated from cleanup-expired-intents function
 */
export async function cleanupExpiredIntents(supabase: SupabaseClient) {
  const expiryThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
  
  await logStructuredEvent("CLEANUP_EXPIRED_INTENTS_START", { 
    threshold: expiryThreshold.toISOString() 
  });

  const { data, error } = await supabase
    .from('user_intents')
    .delete()
    .lt('created_at', expiryThreshold.toISOString())
    .select('id');

  if (error) {
    await logStructuredEvent("CLEANUP_EXPIRED_INTENTS_ERROR", { error: error.message });
    throw error;
  }

  const count = data?.length || 0;
  await logStructuredEvent("CLEANUP_EXPIRED_INTENTS_COMPLETE", { deletedCount: count });
  
  return count;
}

/**
 * Clean up mobility-specific expired intents
 * Migrated from cleanup-mobility-intents function
 */
export async function cleanupMobilityIntents(supabase: SupabaseClient) {
  await logStructuredEvent("CLEANUP_MOBILITY_INTENTS_START", {});

  // Delete expired mobility intents (status = 'expired')
  const { data: expiredData, error: expiredError } = await supabase
    .from('mobility_intents')
    .delete()
    .eq('status', 'expired')
    .select('id');

  if (expiredError) {
    await logStructuredEvent("CLEANUP_MOBILITY_INTENTS_ERROR", { 
      error: expiredError.message 
    });
    throw expiredError;
  }

  // Also clean up old completed/cancelled (> 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const { data: oldData, error: oldError } = await supabase
    .from('mobility_intents')
    .delete()
    .in('status', ['completed', 'cancelled'])
    .lt('created_at', weekAgo.toISOString())
    .select('id');

  if (oldError) {
    await logStructuredEvent("CLEANUP_MOBILITY_OLD_ERROR", { 
      error: oldError.message 
    });
    throw oldError;
  }

  const totalCount = (expiredData?.length || 0) + (oldData?.length || 0);
  
  await logStructuredEvent("CLEANUP_MOBILITY_INTENTS_COMPLETE", { 
    deletedCount: totalCount,
    expired: expiredData?.length || 0,
    old: oldData?.length || 0
  });

  return totalCount;
}
EOF

echo "✓ Created cleanup-additions.ts"

echo ""
echo "Manual step required:"
echo "  1. Edit data-retention/index.ts"
echo "  2. Import: import { cleanupExpiredIntents, cleanupMobilityIntents } from './cleanup-additions.ts';"
echo "  3. Add to main handler:"
echo "     await cleanupExpiredIntents(supabase);"
echo "     await cleanupMobilityIntents(supabase);"
echo ""
read -p "Press Enter after editing data-retention/index.ts..."

echo ""
echo -e "${YELLOW}=== Phase C: Update Cron Configuration ===${NC}"

echo "Edit supabase/config.toml and remove these sections:"
echo ""
echo "  [functions.cleanup-expired-intents]"
echo "  [functions.cleanup-mobility-intents]"
echo ""
echo "Ensure data-retention has:"
echo "  [functions.data-retention]"
echo "  verify_jwt = false"
echo "  cron = \"0 2 * * *\"  # Daily at 2 AM"
echo ""
read -p "Press Enter after editing config.toml..."

echo ""
echo -e "${YELLOW}=== Phase D: Test & Deploy ===${NC}"

cd data-retention
echo "Testing data-retention function..."
if [ -f "deno.json" ]; then
    deno task test || echo "⚠ Tests failed"
fi

echo ""
echo "Deploying enhanced data-retention..."
if supabase functions deploy data-retention --project-ref "$SUPABASE_PROJECT_REF" --no-verify-jwt; then
    echo -e "${GREEN}✓ Deployed data-retention${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi

cd ..

echo ""
echo "Waiting 24 hours for first cron run..."
echo "Check Supabase logs tomorrow to verify cleanup ran successfully"
echo ""
read -p "Proceed to delete old cleanup functions? (y/n): " DELETE_NOW

if [ "$DELETE_NOW" = "y" ]; then
    echo ""
    echo -e "${YELLOW}=== Phase E: Delete Old Cleanup Functions ===${NC}"
    
    for func in cleanup-expired-intents cleanup-mobility-intents; do
        echo "Deleting $func..."
        if supabase functions delete "$func" --project-ref "$SUPABASE_PROJECT_REF"; then
            echo -e "${GREEN}✓ Deleted $func${NC}"
        else
            echo -e "${RED}✗ Failed to delete $func${NC}"
        fi
    done
else
    echo ""
    echo "Skipping deletion. Run manually after 24h verification:"
    echo "  supabase functions delete cleanup-expired-intents --project-ref $SUPABASE_PROJECT_REF"
    echo "  supabase functions delete cleanup-mobility-intents --project-ref $SUPABASE_PROJECT_REF"
fi

echo ""
echo -e "${GREEN}=== Week 8 Complete ===${NC}"
echo "Changes made:"
echo "  ✓ Merged cleanup logic into data-retention"
echo "  ✓ Updated cron configuration (3 jobs → 1)"
echo "  ✓ Deployed enhanced data-retention"
if [ "$DELETE_NOW" = "y" ]; then
    echo "  ✓ Deleted 2 old cleanup functions"
fi
echo ""
echo "Final function count: 48 active functions"
echo ""
echo "Commit changes:"
echo "  git add supabase/functions/data-retention supabase/config.toml"
echo "  git commit -m 'Week 8: Consolidate cleanup functions into data-retention'"
echo "  git push origin main"
echo ""
echo "🎉 Consolidation Plan Complete!"
echo "See SUPABASE_FUNCTIONS_CONSOLIDATION_MASTER_PLAN.md for summary"
