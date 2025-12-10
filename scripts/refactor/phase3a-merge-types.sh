#!/bin/bash
# Phase 3A: Merge @easymo/types into @easymo/commons
# Safe, low-risk consolidation of type definitions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$ROOT_DIR"

echo "🚀 Phase 3A: Merging @easymo/types → @easymo/commons"
echo "================================================"
echo ""

# Step 1: Verify packages exist
echo "Step 1: Verifying packages..."
if [ ! -d "packages/types" ]; then
  echo "❌ packages/types not found!"
  exit 1
fi

if [ ! -d "packages/commons" ]; then
  echo "❌ packages/commons not found!"
  exit 1
fi

echo "✅ Both packages exist"
echo ""

# Step 2: Create directory structure
echo "Step 2: Creating directory structure in @easymo/commons..."
mkdir -p packages/commons/src/types/ai-agents
echo "✅ Directories created"
echo ""

# Step 3: Copy type files
echo "Step 3: Copying type files..."
if [ -d "packages/types/src/ai-agents" ]; then
  cp -r packages/types/src/ai-agents/* packages/commons/src/types/ai-agents/ 2>/dev/null || true
  echo "✅ Copied ai-agents types"
fi

if [ -f "packages/types/src/index.ts" ]; then
  cp packages/types/src/index.ts packages/commons/src/types/index.ts
  echo "✅ Copied index.ts"
fi
echo ""

# Step 4: Update commons index.ts
echo "Step 4: Updating @easymo/commons/src/index.ts..."
if ! grep -q "export \* from './types'" packages/commons/src/index.ts 2>/dev/null; then
  echo "" >> packages/commons/src/index.ts
  echo "// Type definitions (from @easymo/types)" >> packages/commons/src/index.ts
  echo "export * from './types';" >> packages/commons/src/index.ts
  echo "✅ Added types export"
else
  echo "⏩ Types export already exists"
fi
echo ""

# Step 5: Update package.json exports
echo "Step 5: Updating package.json exports..."
cat > /tmp/commons-pkg-update.json << 'EOF'
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./types": {
      "types": "./dist/types/index.d.ts",
      "require": "./dist/types/index.js",
      "default": "./dist/types/index.js"
    }
  }
}
EOF

# Note: Manual merge needed for package.json - showing what to add
echo "⚠️  Manual step required:"
echo "   Add the following to packages/commons/package.json exports:"
echo '   "./types": {'
echo '     "types": "./dist/types/index.d.ts",'
echo '     "require": "./dist/types/index.js",'
echo '     "default": "./dist/types/index.js"'
echo '   }'
echo ""

# Step 6: Find imports to update
echo "Step 6: Finding imports to update..."
echo "Files using @easymo/types:"
grep -r "from '@easymo/types'" --include="*.ts" --include="*.tsx" -l . 2>/dev/null | grep -v node_modules | grep -v ".archive" || echo "No imports found"
echo ""

# Step 7: Show replacement command
echo "Step 7: Update imports with this command:"
echo ""
echo "  find . -type f \( -name '*.ts' -o -name '*.tsx' \) \\"
echo "    ! -path '*/node_modules/*' ! -path '*/.archive/*' \\"
echo "    -exec sed -i '' \"s|from '@easymo/types'|from '@easymo/commons/types'|g\" {} +"
echo ""
echo "  # Or for Linux:"
echo "  find . -type f \( -name '*.ts' -o -name '*.tsx' \) \\"
echo "    ! -path '*/node_modules/*' ! -path '*/.archive/*' \\"
echo "    -exec sed -i \"s|from '@easymo/types'|from '@easymo/commons/types'|g\" {} +"
echo ""

# Step 8: Test build
echo "Step 8: Testing build (after manual steps)..."
echo "  pnpm --filter @easymo/commons build"
echo "  pnpm build"
echo "  pnpm exec vitest run"
echo ""

# Step 9: Archive old package
echo "Step 9: Archive old package (after successful build)..."
echo "  mkdir -p .archive/packages"
echo "  mv packages/types .archive/packages/types-\$(date +%Y%m%d)"
echo ""

# Step 10: Update pnpm-workspace.yaml
echo "Step 10: Update pnpm-workspace.yaml..."
echo "  Remove 'packages/types' from workspace packages list"
echo ""

echo "================================================"
echo "✅ Phase 3A preparation complete!"
echo ""
echo "📋 Manual Steps Required:"
echo "1. Update packages/commons/package.json exports (see above)"
echo "2. Run the find/sed command to update imports"
echo "3. Test build: pnpm --filter @easymo/commons build && pnpm build"
echo "4. Run tests: pnpm exec vitest run"
echo "5. Archive old package: mv packages/types .archive/packages/types-\$(date +%Y%m%d)"
echo "6. Update pnpm-workspace.yaml to remove packages/types"
echo ""
echo "🔍 Review changes before committing!"
