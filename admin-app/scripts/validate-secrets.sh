#!/bin/bash
# Validate Secrets Configuration
# Usage: ./validate-secrets.sh

set -e

echo "🔐 Validating Secrets Configuration"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

function check_secret() {
    local name="$1"
    local critical="${2:-true}"
    
    if gh secret list | grep -q "^$name"; then
        echo -e "${GREEN}✓${NC} $name"
        return 0
    else
        if [ "$critical" = "true" ]; then
            echo -e "${RED}✗${NC} $name (MISSING - CRITICAL)"
            ((ERRORS++))
        else
            echo -e "${YELLOW}⚠${NC} $name (MISSING - Optional)"
            ((WARNINGS++))
        fi
        return 1
    fi
}

function check_file() {
    local path="$1"
    local name="$2"
    
    if [ -f "$path" ]; then
        echo -e "${GREEN}✓${NC} $name exists"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $name not found"
        ((WARNINGS++))
        return 1
    fi
}

function check_config() {
    local file="$1"
    local pattern="$2"
    local name="$3"
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $name configured"
        return 0
    else
        echo -e "${RED}✗${NC} $name not configured"
        ((ERRORS++))
        return 1
    fi
}

# ==================
# CHECK LOCAL FILES
# ==================

echo "📁 Local Files"
echo "-------------"

check_file ~/.tauri/easymo-admin.key "Tauri private key"
check_file ~/.tauri/easymo-admin.key.pub "Tauri public key"
check_file admin-app/src-tauri/Entitlements.plist "macOS Entitlements"

echo ""

# ======================
# CHECK CONFIGURATIONS
# ======================

echo "⚙️  Configuration Files"
echo "----------------------"

check_config admin-app/src-tauri/tauri.conf.json "pubkey" "Tauri public key in config"
check_config admin-app/src-tauri/tauri.conf.json "Entitlements.plist" "macOS entitlements reference"
check_config admin-app/src-tauri/Cargo.toml "tauri-plugin-updater" "Updater plugin enabled"

echo ""

# ==================
# CHECK GITHUB SECRETS
# ==================

echo "🔑 GitHub Secrets"
echo "-----------------"

echo ""
echo "Tauri Signing:"
check_secret "TAURI_SIGNING_PRIVATE_KEY" true
check_secret "TAURI_SIGNING_PRIVATE_KEY_PASSWORD" true

echo ""
echo "Windows Signing:"
check_secret "WINDOWS_CERTIFICATE" false
check_secret "WINDOWS_CERT_PASSWORD" false

echo ""
echo "Apple Signing:"
check_secret "APPLE_CERTIFICATE" false
check_secret "APPLE_CERT_PASSWORD" false
check_secret "APPLE_ID" false
check_secret "APPLE_TEAM_ID" false
check_secret "APPLE_APP_PASSWORD" false

echo ""
echo "Update Server:"
check_secret "CLOUDFLARE_R2_TOKEN" false
check_secret "CLOUDFLARE_ACCOUNT_ID" false

echo ""

# ==================
# SUMMARY
# ==================

echo "📊 Validation Summary"
echo "====================="
echo ""

CRITICAL_READY=true
PLATFORM_SIGNING_READY=false
UPDATE_SERVER_READY=false

# Check Tauri signing (critical)
if gh secret list | grep -q "TAURI_SIGNING_PRIVATE_KEY" && 
   gh secret list | grep -q "TAURI_SIGNING_PRIVATE_KEY_PASSWORD"; then
    echo -e "${GREEN}✓${NC} Tauri signing configured"
else
    echo -e "${RED}✗${NC} Tauri signing NOT configured"
    CRITICAL_READY=false
fi

# Check platform signing (optional for now)
if gh secret list | grep -q "WINDOWS_CERTIFICATE" && 
   gh secret list | grep -q "APPLE_CERTIFICATE"; then
    echo -e "${GREEN}✓${NC} Platform signing configured"
    PLATFORM_SIGNING_READY=true
else
    echo -e "${YELLOW}⚠${NC} Platform signing NOT configured (certificates pending)"
fi

# Check update server (optional for now)
if gh secret list | grep -q "CLOUDFLARE_R2_TOKEN" || 
   gh secret list | grep -q "AWS_ACCESS_KEY_ID"; then
    echo -e "${GREEN}✓${NC} Update server configured"
    UPDATE_SERVER_READY=true
else
    echo -e "${YELLOW}⚠${NC} Update server NOT configured (infrastructure pending)"
fi

echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ VALIDATION FAILED${NC}"
    echo "   Errors: $ERRORS"
    echo "   Warnings: $WARNINGS"
    echo ""
    echo "Fix errors before proceeding to production."
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  VALIDATION PASSED WITH WARNINGS${NC}"
    echo "   Warnings: $WARNINGS"
    echo ""
    
    if $CRITICAL_READY; then
        echo "✅ Ready for development builds"
    fi
    
    if ! $PLATFORM_SIGNING_READY; then
        echo "⏳ Waiting for platform certificates (Phase 2)"
    fi
    
    if ! $UPDATE_SERVER_READY; then
        echo "⏳ Waiting for update server setup (Phase 3)"
    fi
    
    echo ""
    echo "All automated work is complete!"
    echo "Configure remaining secrets when certificates arrive."
    exit 0
else
    echo -e "${GREEN}✅ ALL VALIDATIONS PASSED${NC}"
    echo ""
    echo "🎉 Ready for production release!"
    echo ""
    echo "Next steps:"
    echo "1. Run test build: git tag desktop-v1.0.0-test && git push origin desktop-v1.0.0-test"
    echo "2. Verify build artifacts"
    echo "3. Test installation on all platforms"
    echo "4. Release production: git tag desktop-v1.0.0 && git push origin desktop-v1.0.0"
    exit 0
fi
