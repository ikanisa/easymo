#!/usr/bin/env bash
#
# list_identities.sh
# Lists all available code-signing identities on this Mac.
#
# Usage:
#   ./scripts/list_identities.sh
#
# To use an identity in other scripts, set:
#   export SIGNING_IDENTITY="Inhouse Dev Signing"
# or:
#   export SIGNING_IDENTITY="Developer ID Application: My Company Name (TEAMID)"

set -euo pipefail

echo "=========================================="
echo "Available Code-Signing Identities"
echo "=========================================="
echo

# List all valid code-signing identities
security find-identity -v -p codesigning

echo
echo "=========================================="
echo "Usage:"
echo "  Set your identity with:"
echo "    export SIGNING_IDENTITY=\"Inhouse Dev Signing\""
echo "  or:"
echo "    export SIGNING_IDENTITY=\"Developer ID Application: Your Company (TEAMID)\""
echo "=========================================="
