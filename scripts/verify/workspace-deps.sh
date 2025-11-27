#!/bin/bash
set -euo pipefail

echo "🔍 Verifying workspace dependencies..."

# Find all package.json files
PACKAGES=$(find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.archive/*" -not -path "*/dist/*")

ERRORS=0

for pkg in $PACKAGES; do
  # Check for internal deps without workspace: protocol
  BAD_DEPS=$(jq -r '
    (.dependencies // {}) + (.devDependencies // {}) | 
    to_entries[] | 
    select(.key | startswith("@easymo/") or startswith("@va/")) | 
    select(.value | test("^workspace:") | not) | 
    "\(.key): \(.value)"
  ' "$pkg" 2>/dev/null || true)
  
  if [ -n "$BAD_DEPS" ]; then
    echo "❌ $pkg has internal deps without workspace: protocol:"
    echo "$BAD_DEPS"
    ERRORS=$((ERRORS + 1))
  fi
done

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "❌ Found $ERRORS packages with incorrect internal dependencies"
  echo "Fix by changing \"@easymo/pkg\": \"*\" to \"@easymo/pkg\": \"workspace:*\""
  exit 1
fi

echo "✅ All workspace dependencies use correct protocol"
