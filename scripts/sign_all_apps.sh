#!/usr/bin/env bash
#
# sign_all_apps.sh
# Signs both macOS app bundles (Admin Panel + Client/Staff Portal) with the same identity.
#
# Usage:
#   ./scripts/sign_all_apps.sh
#
# Environment variables:
#   SIGNING_IDENTITY - The code-signing identity to use (optional, has default)
#
# Example with custom identity:
#   SIGNING_IDENTITY="Developer ID Application: Company (TEAMID)" ./scripts/sign_all_apps.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ============================================================
# CONFIGURATION
# ============================================================
# Update these paths to match your actual build output locations

ADMIN_APP_PATH="./dist/mac/AdminPanel.app"
CLIENT_APP_PATH="./dist/mac/ClientPortal.app"

# Default signing identity (internal self-signed certificate)
# To switch to Apple Developer ID, change this to:
#   DEFAULT_IDENTITY="Developer ID Application: Your Company Name (TEAMID)"
DEFAULT_IDENTITY="Inhouse Dev Signing"

# Use environment variable if set, otherwise use default
IDENTITY="${SIGNING_IDENTITY:-$DEFAULT_IDENTITY}"

# Optional: Path to entitlements file (if needed)
# ENTITLEMENTS="./entitlements.plist"
ENTITLEMENTS=""

# ============================================================
# END CONFIGURATION
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIGN_SCRIPT="$SCRIPT_DIR/sign_app.sh"

# Validate sign_app.sh exists
if [ ! -f "$SIGN_SCRIPT" ]; then
    echo -e "${RED}ERROR: sign_app.sh not found at $SIGN_SCRIPT${NC}"
    exit 1
fi

echo "=========================================="
echo "Signing All Apps"
echo "=========================================="
echo "Identity: $IDENTITY"
echo "Apps to sign:"
echo "  1. Admin Panel:      $ADMIN_APP_PATH"
echo "  2. Client/Staff Portal: $CLIENT_APP_PATH"
echo "=========================================="
echo

# Track success/failure
FAILED_APPS=()

# Sign Admin Panel
echo -e "${YELLOW}[1/2] Signing Admin Panel...${NC}"
echo
if [ -n "$ENTITLEMENTS" ]; then
    "$SIGN_SCRIPT" "$ADMIN_APP_PATH" "$IDENTITY" "$ENTITLEMENTS" || FAILED_APPS+=("Admin Panel")
else
    "$SIGN_SCRIPT" "$ADMIN_APP_PATH" "$IDENTITY" || FAILED_APPS+=("Admin Panel")
fi
echo

# Sign Client/Staff Portal
echo -e "${YELLOW}[2/2] Signing Client/Staff Portal...${NC}"
echo
if [ -n "$ENTITLEMENTS" ]; then
    "$SIGN_SCRIPT" "$CLIENT_APP_PATH" "$IDENTITY" "$ENTITLEMENTS" || FAILED_APPS+=("Client/Staff Portal")
else
    "$SIGN_SCRIPT" "$CLIENT_APP_PATH" "$IDENTITY" || FAILED_APPS+=("Client/Staff Portal")
fi
echo

# Final summary
echo "=========================================="
if [ ${#FAILED_APPS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ ALL APPS SIGNED SUCCESSFULLY${NC}"
    echo "=========================================="
    echo "Both apps are ready for distribution."
    echo "Internal users should:"
    echo "  1. Import the .p12 certificate"
    echo "  2. Mark it as 'Always Trust' in Keychain Access"
    echo "  3. Right-click app → Open on first launch"
    echo "=========================================="
    exit 0
else
    echo -e "${RED}✗ SIGNING FAILED FOR:${NC}"
    for app in "${FAILED_APPS[@]}"; do
        echo -e "${RED}  - $app${NC}"
    done
    echo "=========================================="
    exit 1
fi
