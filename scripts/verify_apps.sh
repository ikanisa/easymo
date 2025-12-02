#!/usr/bin/env bash
#
# verify_apps.sh
# Verifies signatures and Gatekeeper status for both apps.
# Run this AFTER signing to confirm everything worked.
#
# Usage:
#   ./scripts/verify_apps.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# App paths (must match sign_all_apps.sh)
ADMIN_APP_PATH="./dist/mac/AdminPanel.app"
CLIENT_APP_PATH="./dist/mac/ClientPortal.app"

echo -e "${BLUE}=========================================="
echo "Verification Report"
echo "==========================================${NC}"
echo

# Function to verify a single app
verify_app() {
    local app_path="$1"
    local app_name=$(basename "$app_path")
    
    if [ ! -d "$app_path" ]; then
        echo -e "${RED}✗ $app_name NOT FOUND${NC}"
        echo "  Path: $app_path"
        return 1
    fi
    
    echo -e "${YELLOW}Checking: $app_name${NC}"
    echo "Path: $app_path"
    echo
    
    # Check if signed
    echo "1. Signature verification..."
    if codesign --verify --deep --strict --verbose=2 "$app_path" 2>&1; then
        echo -e "${GREEN}   ✓ Valid signature${NC}"
    else
        echo -e "${RED}   ✗ Invalid or missing signature${NC}"
        return 1
    fi
    
    echo
    
    # Display signature info
    echo "2. Signature details..."
    codesign -dvv "$app_path" 2>&1 | grep -E "Authority|Identifier|Format|Signature size"
    
    echo
    
    # Check Gatekeeper
    echo "3. Gatekeeper assessment..."
    SPCTL_OUTPUT=$(spctl --assess --verbose=4 --type execute "$app_path" 2>&1 || true)
    echo "$SPCTL_OUTPUT"
    
    if echo "$SPCTL_OUTPUT" | grep -q "accepted"; then
        echo -e "${GREEN}   ✓ Accepted by Gatekeeper${NC}"
    elif echo "$SPCTL_OUTPUT" | grep -q "adhoc"; then
        echo -e "${YELLOW}   ⚠ Ad-hoc signed (internal use)${NC}"
    else
        echo -e "${YELLOW}   ⚠ Not notarized (right-click to open)${NC}"
    fi
    
    echo
    echo -e "${GREEN}✓ $app_name verification complete${NC}"
    echo "---"
    echo
}

# Verify both apps
FAILED=0

verify_app "$ADMIN_APP_PATH" || FAILED=1
verify_app "$CLIENT_APP_PATH" || FAILED=1

# Final summary
echo -e "${BLUE}=========================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL APPS VERIFIED${NC}"
    echo "Both apps are properly signed and ready."
else
    echo -e "${RED}✗ VERIFICATION FAILED${NC}"
    echo "Check errors above."
fi
echo -e "${BLUE}==========================================${NC}"

exit $FAILED
