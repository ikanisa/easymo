#!/bin/bash
# ============================================================================
# Orphan Edge Functions Cleanup Script
# ============================================================================
# This script deletes orphaned/deprecated edge functions from Supabase
# that are no longer in the repository or have been deprecated.
#
# Usage:
#   ./scripts/cleanup-orphan-functions.sh [--dry-run] [--batch N]
#
# Options:
#   --dry-run    Show what would be deleted without actually deleting
#   --batch N    Only delete functions from batch N (1, 2, or 3)
#
# Environment variables:
#   SUPABASE_PROJECT_REF: Supabase project reference (required)
#   SUPABASE_ACCESS_TOKEN: Access token for Supabase CLI (required)
#
# ============================================================================

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-lhbowpbcpwoiparwnwgt}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# BATCH 1: Critical - Deprecated per Issue #485 (IMMEDIATE)
# wa-webhook is the legacy monolithic handler replaced by wa-webhook-core + microservices
BATCH_1=(
    "wa-webhook"  # DEPRECATED per Issue #485 - Legacy monolithic handler
)

# BATCH 2: Low deployment count - Safe to delete (orphaned functions)
# These functions are not in the repository and have low usage
BATCH_2=(
    "admin-health"                      # Likely merged into admin-api
    "admin-messages"                    # Not in repo, likely merged
    "bars-lookup"                       # Not in repo listing
    "business-lookup"                   # Not in repo listing
    "cleanup-mobility-intents"          # Not in repo listing
    "complete-user-profile"             # May be merged into profile functions
    "get-user-profile"                  # May be merged
    "job-crawler"                       # Not in repo listing
    "job-sources-sync"                  # Not in repo listing
    "register-device"                   # Not in repo listing
    "send-otp"                          # May be merged with send-whatsapp-otp
    "source-url-scraper"                # Not in repo listing
    "update-user-profile"               # May be merged
    "webhook-relay"                     # Not in repo listing
)

# BATCH 3: Medium deployment count - Requires verification before deletion
# These may still have active traffic - verify logs before deleting
BATCH_3=(
    "momo-allocator"                    # MoMo functions - verify no active usage
    "momo-charge"                       # MoMo functions - verify no active usage
    "momo-sms-hook"                     # MoMo functions - verify no active usage
    "momo-webhook"                      # MoMo functions - verify no active usage
    "schedule-broadcast"                # Not in repo listing
    "schedule-email"                    # Not in repo listing
    "schedule-sms"                      # Not in repo listing
    "send-whatsapp-otp"                 # Not in repo listing
    "verify-whatsapp-otp"               # Not in repo listing
    "sms-ingest"                        # Not in repo listing
    "sync-transactions"                 # Not in repo listing
)

# BATCH 4: Vending functions - Requires explicit confirmation (may be active)
BATCH_4_VENDING=(
    "create-vending-order"
    "get-vending-machine"
    "get-vending-machines"
    "get-vending-order"
    "get-vending-orders"
)

# BATCH 5: Insurance admin functions - Requires verification
BATCH_5_INSURANCE=(
    "insurance-admin-api"
    "insurance-admin-health"
    "send-insurance-admin-notifications"
)

# Parse command line arguments
DRY_RUN=false
TARGET_BATCH=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --batch)
            TARGET_BATCH="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "=============================================="
echo "  Edge Functions Cleanup"
echo "=============================================="
echo ""
echo "Project: $PROJECT_REF"
echo "Mode: $(if $DRY_RUN; then echo 'DRY RUN'; else echo 'LIVE'; fi)"
if [[ -n "$TARGET_BATCH" ]]; then
    echo "Target batch: $TARGET_BATCH"
fi
echo ""

delete_functions() {
    local category=$1
    shift
    local functions=("$@")
    
    echo ""
    echo -e "${BLUE}🗑️  $category${NC}"
    echo "----------------------------------------"
    
    local deleted=0
    local failed=0
    
    for fn in "${functions[@]}"; do
        if $DRY_RUN; then
            echo -e "  [DRY RUN] Would delete: ${YELLOW}$fn${NC}"
            deleted=$((deleted + 1))
        else
            echo -n "  Deleting $fn... "
            if supabase functions delete "$fn" --project-ref "$PROJECT_REF" 2>/dev/null; then
                echo -e "${GREEN}✓${NC}"
                deleted=$((deleted + 1))
            else
                echo -e "${RED}⊗${NC} (not found or already deleted)"
                failed=$((failed + 1))
            fi
        fi
    done
    
    echo ""
    echo "  Processed: $deleted functions"
    if [[ $failed -gt 0 ]]; then
        echo "  Failed/Not found: $failed functions"
    fi
}

# Execute based on target batch or all
if [[ -z "$TARGET_BATCH" ]] || [[ "$TARGET_BATCH" == "1" ]]; then
    echo -e "${RED}⚠️  CRITICAL: Batch 1 - Deprecated Functions${NC}"
    echo "These functions are deprecated per Issue #485 and must be deleted."
    echo ""
    
    if ! $DRY_RUN; then
        echo "Press Enter to continue or Ctrl+C to cancel..."
        read -r
    fi
    
    delete_functions "BATCH 1: Critical Deprecated (Issue #485)" "${BATCH_1[@]}"
fi

if [[ -z "$TARGET_BATCH" ]] || [[ "$TARGET_BATCH" == "2" ]]; then
    delete_functions "BATCH 2: Low Usage Orphaned Functions" "${BATCH_2[@]}"
fi

if [[ -z "$TARGET_BATCH" ]] || [[ "$TARGET_BATCH" == "3" ]]; then
    echo ""
    echo -e "${YELLOW}⚠️  CAUTION: Batch 3 contains functions with medium deployment counts.${NC}"
    echo "Verify these have no active traffic before deletion."
    echo ""
    
    if ! $DRY_RUN; then
        read -p "Continue with Batch 3? (y/n): " confirm
        if [[ "$confirm" != "y" ]]; then
            echo "Skipping Batch 3."
        else
            delete_functions "BATCH 3: Medium Usage (Verify First)" "${BATCH_3[@]}"
        fi
    else
        delete_functions "BATCH 3: Medium Usage (Verify First)" "${BATCH_3[@]}"
    fi
fi

if [[ "$TARGET_BATCH" == "4" ]]; then
    echo ""
    echo -e "${YELLOW}⚠️  WARNING: Batch 4 contains Vending functions.${NC}"
    echo "These may be in active use. Confirm before deletion."
    echo ""
    
    if ! $DRY_RUN; then
        read -p "Are you sure you want to delete Vending functions? (type 'yes'): " confirm
        if [[ "$confirm" == "yes" ]]; then
            delete_functions "BATCH 4: Vending Functions" "${BATCH_4_VENDING[@]}"
        else
            echo "Skipping Batch 4."
        fi
    else
        delete_functions "BATCH 4: Vending Functions" "${BATCH_4_VENDING[@]}"
    fi
fi

if [[ "$TARGET_BATCH" == "5" ]]; then
    echo ""
    echo -e "${YELLOW}⚠️  WARNING: Batch 5 contains Insurance Admin functions.${NC}"
    echo "Verify these are not needed before deletion."
    echo ""
    
    if ! $DRY_RUN; then
        read -p "Continue with Batch 5? (y/n): " confirm
        if [[ "$confirm" != "y" ]]; then
            echo "Skipping Batch 5."
        else
            delete_functions "BATCH 5: Insurance Admin Functions" "${BATCH_5_INSURANCE[@]}"
        fi
    else
        delete_functions "BATCH 5: Insurance Admin Functions" "${BATCH_5_INSURANCE[@]}"
    fi
fi

echo ""
echo "=============================================="
echo "  Cleanup Complete"
echo "=============================================="
echo ""

if $DRY_RUN; then
    echo "This was a DRY RUN. No functions were actually deleted."
    echo "Run without --dry-run to delete functions."
else
    echo "Cleanup completed. Run 'supabase functions list --project-ref $PROJECT_REF' to verify."
fi

echo ""
echo "Next steps:"
echo "  1. Verify no critical functions were affected"
echo "  2. Update CI/CD workflows if needed"
echo "  3. Monitor logs for any errors"
echo ""
