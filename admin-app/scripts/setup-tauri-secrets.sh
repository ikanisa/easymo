#!/bin/bash
# Setup GitHub Secrets for Tauri Signing
# Run this script after generating Tauri signing keys

set -e

echo "🔐 Setting up GitHub Secrets for Tauri Signing Keys"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed"
    echo "Install from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI"
    echo "Run: gh auth login"
    exit 1
fi

# Check if private key exists
PRIVATE_KEY_PATH="$HOME/.tauri/easymo-admin.key"
if [ ! -f "$PRIVATE_KEY_PATH" ]; then
    echo "❌ Private key not found at $PRIVATE_KEY_PATH"
    echo "Run: npm run tauri signer generate -- -w ~/.tauri/easymo-admin.key"
    exit 1
fi

echo "✅ Found private key at $PRIVATE_KEY_PATH"
echo ""

# Set TAURI_SIGNING_PRIVATE_KEY
echo "📝 Setting TAURI_SIGNING_PRIVATE_KEY secret..."
gh secret set TAURI_SIGNING_PRIVATE_KEY < "$PRIVATE_KEY_PATH"
echo "✅ TAURI_SIGNING_PRIVATE_KEY set"
echo ""

# Set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
echo "📝 Setting TAURI_SIGNING_PRIVATE_KEY_PASSWORD secret..."
echo "⚠️  Current password: easymo-admin-2025"
echo "⚠️  You should change this in production!"
echo ""
echo -n "Enter password for Tauri signing key (or press Enter to use default): "
read -s PASSWORD
echo ""

if [ -z "$PASSWORD" ]; then
    PASSWORD="easymo-admin-2025"
    echo "Using default password (NOT RECOMMENDED FOR PRODUCTION)"
fi

echo "$PASSWORD" | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
echo "✅ TAURI_SIGNING_PRIVATE_KEY_PASSWORD set"
echo ""

echo "🎉 Tauri signing secrets configured!"
echo ""
echo "Next steps:"
echo "1. Purchase Windows code signing certificate"
echo "2. Enroll in Apple Developer Program"
echo "3. Configure remaining secrets (see PHASE_2_SETUP_GUIDE.md)"
echo ""
echo "Verify secrets set:"
echo "  gh secret list"
