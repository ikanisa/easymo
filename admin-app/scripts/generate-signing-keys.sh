#!/usr/bin/env bash
# Generate Tauri Update Signing Keys
# Run this script ONCE to generate signing keys for auto-updates

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KEYS_DIR="${HOME}/.tauri"
KEY_FILE="${KEYS_DIR}/easymo-admin.key"

echo "🔐 EasyMO Admin - Signing Key Generation"
echo "========================================"
echo ""

# Check if tauri CLI is installed
if ! command -v tauri &> /dev/null; then
    echo "❌ Error: Tauri CLI not found"
    echo "Install with: npm install -g @tauri-apps/cli"
    exit 1
fi

# Create keys directory
mkdir -p "${KEYS_DIR}"

# Check if key already exists
if [ -f "${KEY_FILE}" ]; then
    echo "⚠️  Warning: Key file already exists at ${KEY_FILE}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted"
        exit 1
    fi
    rm -f "${KEY_FILE}"
fi

# Generate key
echo "📝 Generating signing keys..."
tauri signer generate -w "${KEY_FILE}"

echo ""
echo "✅ Keys generated successfully!"
echo ""
echo "📋 Next Steps:"
echo "  1. BACKUP the private key securely: ${KEY_FILE}"
echo "  2. Extract the public key from tauri.conf.json"
echo "  3. Set environment variables:"
echo "     export TAURI_SIGNING_PRIVATE_KEY=\$(cat ${KEY_FILE})"
echo "     export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=your-password"
echo ""
echo "⚠️  CRITICAL: Store the private key in a secure location!"
echo "   - Add to password manager"
echo "   - Add to CI/CD secrets"
echo "   - NEVER commit to git"
echo ""
