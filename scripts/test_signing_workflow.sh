#!/usr/bin/env bash
#
# test_signing_workflow.sh
# Runs a complete end-to-end test of the signing workflow.
# Safe to run repeatedly - uses mock apps for testing.
#
# Usage:
#   ./scripts/test_signing_workflow.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="$REPO_ROOT/.signing-test"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗"
echo "║           macOS Code Signing Workflow Test Suite             ║"
echo "╚═══════════════════════════════════════════════════════════════╝${NC}"
echo

# Cleanup function
cleanup() {
    if [ -d "$TEST_DIR" ]; then
        echo -e "${YELLOW}Cleaning up test directory...${NC}"
        rm -rf "$TEST_DIR"
    fi
}

trap cleanup EXIT

# Test 1: Check if scripts exist and are executable
echo -e "${YELLOW}[1/7] Checking script files...${NC}"
REQUIRED_SCRIPTS=(
    "list_identities.sh"
    "sign_app.sh"
    "sign_all_apps.sh"
    "check_certificate.sh"
    "verify_apps.sh"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if [ ! -f "$SCRIPT_DIR/$script" ]; then
        echo -e "${RED}✗ Missing: scripts/$script${NC}"
        exit 1
    fi
    if [ ! -x "$SCRIPT_DIR/$script" ]; then
        echo -e "${RED}✗ Not executable: scripts/$script${NC}"
        exit 1
    fi
    echo -e "${GREEN}  ✓ $script${NC}"
done
echo

# Test 2: Check documentation
echo -e "${YELLOW}[2/7] Checking documentation...${NC}"
if [ ! -f "$REPO_ROOT/SIGNING_QUICK_START.md" ]; then
    echo -e "${RED}✗ Missing: SIGNING_QUICK_START.md${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ SIGNING_QUICK_START.md${NC}"

if [ ! -f "$REPO_ROOT/docs/internal_mac_signing.md" ]; then
    echo -e "${RED}✗ Missing: docs/internal_mac_signing.md${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ docs/internal_mac_signing.md${NC}"
echo

# Test 3: Verify list_identities.sh runs without error
echo -e "${YELLOW}[3/7] Testing list_identities.sh...${NC}"
if "$SCRIPT_DIR/list_identities.sh" > /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ Script executes successfully${NC}"
else
    echo -e "${RED}✗ Script failed to execute${NC}"
    exit 1
fi
echo

# Test 4: Check certificate (non-fatal if missing)
echo -e "${YELLOW}[4/7] Checking for signing certificate...${NC}"
if "$SCRIPT_DIR/check_certificate.sh" > /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ Certificate 'Inhouse Dev Signing' found${NC}"
    CERT_EXISTS=true
else
    echo -e "${YELLOW}  ⚠ Certificate not found (expected for first run)${NC}"
    echo -e "${YELLOW}    Run: open 'Keychain Access' to create certificate${NC}"
    CERT_EXISTS=false
fi
echo

# Test 5: Create mock .app bundles
echo -e "${YELLOW}[5/7] Creating mock .app bundles...${NC}"
mkdir -p "$TEST_DIR/dist/mac"

# Create mock Admin Panel.app
MOCK_ADMIN="$TEST_DIR/dist/mac/AdminPanel.app"
mkdir -p "$MOCK_ADMIN/Contents/MacOS"
mkdir -p "$MOCK_ADMIN/Contents/Resources"

cat > "$MOCK_ADMIN/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>AdminPanel</string>
    <key>CFBundleIdentifier</key>
    <string>com.easymo.adminpanel</string>
    <key>CFBundleName</key>
    <string>Admin Panel</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
</dict>
</plist>
EOF

cat > "$MOCK_ADMIN/Contents/MacOS/AdminPanel" << 'EOF'
#!/bin/bash
echo "Mock Admin Panel"
EOF
chmod +x "$MOCK_ADMIN/Contents/MacOS/AdminPanel"

# Create mock Client Portal.app
MOCK_CLIENT="$TEST_DIR/dist/mac/ClientPortal.app"
mkdir -p "$MOCK_CLIENT/Contents/MacOS"
mkdir -p "$MOCK_CLIENT/Contents/Resources"

cat > "$MOCK_CLIENT/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>ClientPortal</string>
    <key>CFBundleIdentifier</key>
    <string>com.easymo.clientportal</string>
    <key>CFBundleName</key>
    <string>Client Portal</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
</dict>
</plist>
EOF

cat > "$MOCK_CLIENT/Contents/MacOS/ClientPortal" << 'EOF'
#!/bin/bash
echo "Mock Client Portal"
EOF
chmod +x "$MOCK_CLIENT/Contents/MacOS/ClientPortal"

echo -e "${GREEN}  ✓ Mock AdminPanel.app created${NC}"
echo -e "${GREEN}  ✓ Mock ClientPortal.app created${NC}"
echo

# Test 6: Test sign_app.sh (only if certificate exists)
echo -e "${YELLOW}[6/7] Testing sign_app.sh...${NC}"
if [ "$CERT_EXISTS" = true ]; then
    if "$SCRIPT_DIR/sign_app.sh" "$MOCK_ADMIN" "Inhouse Dev Signing" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Successfully signed mock app${NC}"
        
        # Verify signature
        if codesign --verify --deep --strict "$MOCK_ADMIN" 2>&1; then
            echo -e "${GREEN}  ✓ Signature verified${NC}"
        else
            echo -e "${RED}✗ Signature verification failed${NC}"
            exit 1
        fi
    else
        echo -e "${RED}✗ Failed to sign mock app${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}  ⚠ Skipped (no certificate)${NC}"
fi
echo

# Test 7: Check .gitignore
echo -e "${YELLOW}[7/7] Checking .gitignore security...${NC}"
if grep -q "*.p12" "$REPO_ROOT/.gitignore"; then
    echo -e "${GREEN}  ✓ .p12 files blocked${NC}"
else
    echo -e "${RED}✗ .p12 not in .gitignore${NC}"
    exit 1
fi

if grep -q "*.cer" "$REPO_ROOT/.gitignore"; then
    echo -e "${GREEN}  ✓ .cer files blocked${NC}"
else
    echo -e "${YELLOW}  ⚠ .cer not in .gitignore (recommended)${NC}"
fi
echo

# Final summary
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
if [ "$CERT_EXISTS" = true ]; then
    echo -e "${GREEN}║                    ✅ ALL TESTS PASSED                        ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${GREEN}Your signing workflow is fully operational!${NC}"
    echo
    echo "Next steps:"
    echo "  1. Update app paths in scripts/sign_all_apps.sh"
    echo "  2. Run: ./scripts/sign_all_apps.sh"
    echo "  3. Verify: ./scripts/verify_apps.sh"
else
    echo -e "${YELLOW}║              ⚠ TESTS PASSED (Certificate Needed)             ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${YELLOW}Scripts are ready, but you need to create a certificate:${NC}"
    echo
    echo "Follow SIGNING_QUICK_START.md section 1:"
    echo "  1. Open Keychain Access"
    echo "  2. Certificate Assistant → Create a Certificate"
    echo "  3. Name: Inhouse Dev Signing"
    echo "  4. Type: Code Signing"
    echo "  5. Mark as 'Always Trust'"
    echo
    echo "Then re-run this test: ./scripts/test_signing_workflow.sh"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
