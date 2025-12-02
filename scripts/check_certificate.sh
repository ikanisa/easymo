#!/usr/bin/env bash
#
# check_certificate.sh
# Checks if "Inhouse Dev Signing" certificate exists and is trusted.
# Run this BEFORE signing to ensure setup is correct.
#
# Usage:
#   ./scripts/check_certificate.sh ["Certificate Name"]

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Certificate name (can override with argument)
CERT_NAME="${1:-Inhouse Dev Signing}"

echo -e "${BLUE}=========================================="
echo "Certificate Check: $CERT_NAME"
echo "==========================================${NC}"
echo

# Check if certificate exists
echo "1. Searching for certificate..."
if security find-identity -v -p codesigning | grep -q "$CERT_NAME"; then
    echo -e "${GREEN}✓ Certificate found${NC}"
    echo
    security find-identity -v -p codesigning | grep "$CERT_NAME"
else
    echo -e "${RED}✗ Certificate NOT found${NC}"
    echo
    echo "Available certificates:"
    security find-identity -v -p codesigning
    echo
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Open Keychain Access"
    echo "2. Create certificate: Keychain Access → Certificate Assistant → Create a Certificate"
    echo "3. Name: $CERT_NAME"
    echo "4. Type: Code Signing"
    echo "5. Mark as 'Always Trust'"
    echo
    echo "See docs/internal_mac_signing.md for detailed instructions."
    exit 1
fi

echo

# Check trust settings
echo "2. Checking trust settings..."
CERT_HASH=$(security find-identity -v -p codesigning | grep "$CERT_NAME" | awk '{print $2}')

if [ -n "$CERT_HASH" ]; then
    TRUST_INFO=$(security dump-trust-settings -d 2>/dev/null | grep -A5 "$CERT_HASH" || echo "")
    
    if [ -n "$TRUST_INFO" ]; then
        echo -e "${GREEN}✓ Custom trust settings found${NC}"
        echo "  (Certificate is explicitly trusted)"
    else
        echo -e "${YELLOW}⚠ Using default trust settings${NC}"
        echo "  Recommendation: Set to 'Always Trust' in Keychain Access"
    fi
else
    echo -e "${YELLOW}⚠ Could not verify trust settings${NC}"
fi

echo

# Check validity period
echo "3. Checking validity..."
CERT_INFO=$(security find-certificate -c "$CERT_NAME" -p | openssl x509 -noout -dates 2>/dev/null || echo "")

if [ -n "$CERT_INFO" ]; then
    echo "$CERT_INFO"
    echo -e "${GREEN}✓ Certificate is valid${NC}"
else
    echo -e "${YELLOW}⚠ Could not check validity${NC}"
fi

echo
echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}✓ Certificate check complete${NC}"
echo
echo "Ready to sign apps with:"
echo "  ./scripts/sign_all_apps.sh"
echo -e "${BLUE}==========================================${NC}"
