#!/bin/bash
set -euo pipefail

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  TypeScript Version Alignment${NC}"
echo -e "${BLUE}========================================${NC}\n"

TARGET_VERSION="5.5.4"
UPDATED=0
SKIPPED=0

echo -e "Target TypeScript version: ${GREEN}${TARGET_VERSION}${NC}\n"

# Find all package.json files
PACKAGES=$(find . -name "package.json" \
  -not -path "*/node_modules/*" \
  -not -path "*/.archive/*" \
  -not -path "*/dist/*")

for pkg in $PACKAGES; do
  # Check if package has TypeScript dependency
  HAS_TS=$(jq -r '(.devDependencies.typescript // .dependencies.typescript) // "none"' "$pkg")
  
  if [ "$HAS_TS" != "none" ] && [ "$HAS_TS" != "null" ]; then
    if [ "$HAS_TS" != "$TARGET_VERSION" ]; then
      echo -e "${YELLOW}Updating${NC} $pkg"
      echo -e "  ${HAS_TS} → ${GREEN}${TARGET_VERSION}${NC}"
      
      # Update TypeScript version
      if jq -e '.devDependencies.typescript' "$pkg" >/dev/null 2>&1; then
        jq ".devDependencies.typescript = \"${TARGET_VERSION}\"" "$pkg" > "${pkg}.tmp"
      else
        jq ".dependencies.typescript = \"${TARGET_VERSION}\"" "$pkg" > "${pkg}.tmp"
      fi
      
      mv "${pkg}.tmp" "$pkg"
      UPDATED=$((UPDATED + 1))
    else
      echo -e "${GREEN}✓${NC} $pkg (already ${TARGET_VERSION})"
      SKIPPED=$((SKIPPED + 1))
    fi
  fi
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Updated: ${UPDATED} packages${NC}"
echo -e "${BLUE}Skipped: ${SKIPPED} packages (already correct)${NC}"
echo -e "${BLUE}========================================${NC}"

if [ $UPDATED -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}Next steps:${NC}"
  echo "1. Run: pnpm install"
  echo "2. Run: pnpm build"
  echo "3. Verify: pnpm exec tsc --version"
fi
