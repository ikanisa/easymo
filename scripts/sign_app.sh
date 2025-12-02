#!/usr/bin/env bash
#
# sign_app.sh
# Signs a single macOS .app bundle with a specified code-signing identity.
#
# Usage:
#   ./scripts/sign_app.sh /path/to/MyApp.app "Inhouse Dev Signing"
#   ./scripts/sign_app.sh /path/to/MyApp.app "Developer ID Application: Company (TEAMID)" [entitlements.plist]
#
# Arguments:
#   $1 - Path to .app bundle (required)
#   $2 - Signing identity name (required)
#   $3 - Path to entitlements file (optional)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -lt 2 ]; then
    echo -e "${RED}ERROR: Missing required arguments${NC}"
    echo "Usage: $0 <app-path> <identity> [entitlements-path]"
    echo "Example: $0 ./dist/mac/MyApp.app \"Inhouse Dev Signing\""
    exit 1
fi

APP_PATH="$1"
IDENTITY="$2"
ENTITLEMENTS="${3:-}"

# Validate app bundle exists
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}ERROR: App bundle not found: $APP_PATH${NC}"
    exit 1
fi

APP_NAME=$(basename "$APP_PATH")

echo "=========================================="
echo "Signing: $APP_NAME"
echo "=========================================="
echo "Path:     $APP_PATH"
echo "Identity: $IDENTITY"
[ -n "$ENTITLEMENTS" ] && echo "Entitlements: $ENTITLEMENTS"
echo

# Build codesign command
CODESIGN_ARGS=(
    --force
    --deep
    --options runtime
    --sign "$IDENTITY"
    --timestamp
)

# Add entitlements if provided
if [ -n "$ENTITLEMENTS" ]; then
    if [ ! -f "$ENTITLEMENTS" ]; then
        echo -e "${RED}ERROR: Entitlements file not found: $ENTITLEMENTS${NC}"
        exit 1
    fi
    CODESIGN_ARGS+=(--entitlements "$ENTITLEMENTS")
fi

CODESIGN_ARGS+=("$APP_PATH")

# Sign the app
echo -e "${YELLOW}Step 1: Signing app bundle...${NC}"
if codesign "${CODESIGN_ARGS[@]}"; then
    echo -e "${GREEN}✓ Signing succeeded${NC}"
else
    echo -e "${RED}✗ Signing FAILED${NC}"
    exit 1
fi

echo

# Verify the signature
echo -e "${YELLOW}Step 2: Verifying signature...${NC}"
if codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1; then
    echo -e "${GREEN}✓ Signature verification succeeded${NC}"
else
    echo -e "${RED}✗ Signature verification FAILED${NC}"
    exit 1
fi

echo

# Assess Gatekeeper
echo -e "${YELLOW}Step 3: Assessing Gatekeeper status...${NC}"
SPCTL_OUTPUT=$(spctl --assess --verbose=4 --type execute "$APP_PATH" 2>&1 || true)
echo "$SPCTL_OUTPUT"

if echo "$SPCTL_OUTPUT" | grep -q "accepted"; then
    echo -e "${GREEN}✓ Gatekeeper assessment: ACCEPTED${NC}"
elif echo "$SPCTL_OUTPUT" | grep -q "adhoc"; then
    echo -e "${YELLOW}⚠ Ad-hoc signed (internal use only)${NC}"
else
    echo -e "${YELLOW}⚠ Gatekeeper will require user approval on first launch${NC}"
fi

echo
echo "=========================================="
echo -e "${GREEN}SUCCESS: $APP_NAME is signed${NC}"
echo "=========================================="
