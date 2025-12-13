#!/bin/bash
# ============================================================================
# Edge Functions Verification Script
# ============================================================================
# Compares deployed Supabase functions against repository functions
# to identify orphaned functions that should be deleted.
# 
# Usage:
#   ./scripts/verify-edge-functions.sh [--check-only]
#
# Environment variables:
#   SUPABASE_PROJECT_REF: Supabase project reference (required for API calls)
#   SUPABASE_ACCESS_TOKEN: Access token for Supabase API (required for API calls)
#
# When --check-only is provided, only local repository functions are listed.
# ============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FUNCTIONS_DIR="$REPO_ROOT/supabase/functions"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions that are deprecated and should NOT be deployed
# Even if they exist in the repo, they should be treated as deprecated
DEPRECATED_FUNCTIONS=(
    "wa-webhook"  # Issue #485 - Legacy monolithic handler, replaced by wa-webhook-core + domain microservices
)

# Functions that exist in the repo but are for local development/testing only
LOCAL_ONLY_FUNCTIONS=(
    # Add any functions that should not be deployed
)

echo "=============================================="
echo "  Edge Functions Verification"
echo "=============================================="
echo ""

# List repository functions
list_repo_functions() {
    echo -e "${BLUE}📁 Functions in repository:${NC}"
    echo ""
    
    local count=0
    local deprecated_count=0
    
    for dir in "$FUNCTIONS_DIR"/*/; do
        if [ -d "$dir" ]; then
            local fn_name=$(basename "$dir")
            
            # Skip _shared directory (not a function)
            if [[ "$fn_name" == "_shared" ]]; then
                continue
            fi
            
            # Check if function is deprecated
            local is_deprecated=false
            for deprecated in "${DEPRECATED_FUNCTIONS[@]}"; do
                if [[ "$fn_name" == "$deprecated" ]]; then
                    is_deprecated=true
                    break
                fi
            done
            
            if $is_deprecated; then
                echo -e "  ${RED}⚠️  $fn_name${NC} (DEPRECATED - DO NOT DEPLOY)"
                deprecated_count=$((deprecated_count + 1))
            else
                # Check for deno.json or index.ts to verify it's a valid function
                if [[ -f "$dir/index.ts" ]] || [[ -f "$dir/deno.json" ]]; then
                    echo -e "  ${GREEN}✓${NC}  $fn_name"
                else
                    echo -e "  ${YELLOW}?${NC}  $fn_name (missing index.ts or deno.json)"
                fi
            fi
            count=$((count + 1))
        fi
    done
    
    echo ""
    echo "  Total: $count functions ($deprecated_count deprecated)"
    echo ""
}

# List functions that should NOT be deployed
list_deprecated_guard() {
    echo -e "${RED}🚫 DEPRECATED Functions (blocked from deployment):${NC}"
    echo ""
    
    for fn in "${DEPRECATED_FUNCTIONS[@]}"; do
        local reason=""
        case "$fn" in
            "wa-webhook")
                reason="Issue #485 - Replaced by wa-webhook-core + domain microservices"
                ;;
            *)
                reason="Legacy/deprecated"
                ;;
        esac
        echo "  • $fn"
        echo "    Reason: $reason"
    done
    
    echo ""
}

# Check if any deprecated functions are referenced in deploy commands
check_deploy_scripts() {
    echo -e "${BLUE}🔍 Checking deploy scripts for deprecated function references...${NC}"
    echo ""
    
    local found_issues=false
    
    for fn in "${DEPRECATED_FUNCTIONS[@]}"; do
        # Use exact match pattern (word boundary on both sides, not part of larger function name)
        # This ensures wa-webhook doesn't match wa-webhook-core, wa-webhook-mobility, etc.
        local pattern=" ${fn}[^-a-z]| ${fn}$"
        
        # Check CI workflows - look for the function name as a standalone word in deploy commands
        local workflow_refs=""
        for wf in "$REPO_ROOT/.github/workflows/"*.yml; do
            if grep -E "supabase functions deploy.*${pattern}" "$wf" 2>/dev/null | grep -v "^#\|^\s*#" >/dev/null; then
                workflow_refs="$workflow_refs $wf"
            fi
        done
        
        # Check package.json - look for deploy scripts with the deprecated function
        local pkg_refs=""
        if grep -E "\"functions:deploy[^\"]*${pattern}" "$REPO_ROOT/package.json" 2>/dev/null | grep -v "^#\|^\s*#" >/dev/null; then
            pkg_refs="package.json"
        fi
        
        workflow_refs=$(echo "$workflow_refs" | xargs)  # Trim whitespace
        
        if [[ -n "$workflow_refs" ]] || [[ -n "$pkg_refs" ]]; then
            echo -e "  ${RED}❌ Found references to deprecated '$fn':${NC}"
            
            if [[ -n "$workflow_refs" ]]; then
                for file in $workflow_refs; do
                    echo "      - $file"
                done
            fi
            
            if [[ -n "$pkg_refs" ]]; then
                echo "      - package.json"
            fi
            
            found_issues=true
        else
            echo -e "  ${GREEN}✓${NC}  No deployment references to '$fn'"
        fi
    done
    
    echo ""
    
    if $found_issues; then
        echo -e "${RED}⚠️  WARNING: Deprecated functions are still referenced in deploy scripts!${NC}"
        echo "  Please remove these references to prevent accidental deployment."
        return 1
    else
        echo -e "${GREEN}✓ All deprecated functions are properly blocked from deployment.${NC}"
    fi
    echo ""
}

# Print summary of what functions should be kept vs deleted
print_summary() {
    echo "=============================================="
    echo "  Summary"
    echo "=============================================="
    echo ""
    echo "Functions to KEEP (active in repository):"
    
    for dir in "$FUNCTIONS_DIR"/*/; do
        if [ -d "$dir" ]; then
            local fn_name=$(basename "$dir")
            
            # Skip _shared and deprecated
            if [[ "$fn_name" == "_shared" ]]; then
                continue
            fi
            
            local is_deprecated=false
            for deprecated in "${DEPRECATED_FUNCTIONS[@]}"; do
                if [[ "$fn_name" == "$deprecated" ]]; then
                    is_deprecated=true
                    break
                fi
            done
            
            if ! $is_deprecated && [[ -f "$dir/index.ts" || -f "$dir/deno.json" ]]; then
                echo "  ✅ $fn_name"
            fi
        fi
    done
    
    echo ""
    echo "Functions to DELETE (deprecated/orphaned):"
    for fn in "${DEPRECATED_FUNCTIONS[@]}"; do
        echo "  🗑️  $fn"
    done
    echo ""
}

# Main execution
main() {
    local check_only=false
    
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --check-only)
                check_only=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    list_repo_functions
    list_deprecated_guard
    check_deploy_scripts || true
    print_summary
    
    echo ""
    echo "=============================================="
    echo "  Cleanup Commands"
    echo "=============================================="
    echo ""
    echo "To delete deprecated functions from Supabase:"
    echo ""
    for fn in "${DEPRECATED_FUNCTIONS[@]}"; do
        echo "  supabase functions delete $fn --project-ref \$SUPABASE_PROJECT_REF"
    done
    echo ""
    echo "Or run the cleanup script:"
    echo "  ./scripts/cleanup-orphan-functions.sh"
    echo ""
}

main "$@"
