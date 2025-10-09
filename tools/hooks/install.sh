#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_PATH="${SCRIPT_DIR}/../../.git/hooks/pre-commit"

cp "${SCRIPT_DIR}/pre-commit" "$HOOK_PATH"
chmod +x "$HOOK_PATH"
echo "pre-commit hook installed -> $HOOK_PATH"
