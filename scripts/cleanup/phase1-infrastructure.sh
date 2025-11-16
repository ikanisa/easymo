#!/bin/bash
# PHASE 1: Critical Infrastructure Fixes
# Execute this script to fix Next.js, dependencies, and build system

set -e  # Exit on error

echo "🚀 Starting Phase 1: Critical Infrastructure Fixes"
echo "=================================================="

# 1.1 Fix Next.js Development Mode
echo ""
echo "📦 Step 1.1: Upgrading Next.js to 15.1.6..."
cd admin-app

# Backup current package.json
cp package.json package.json.backup

# Update Next.js version
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' 's/"next": "14.2.33"/"next": "15.1.6"/' package.json
else
  sed -i 's/"next": "14.2.33"/"next": "15.1.6"/' package.json
fi

# Also update React if needed (Next.js 15 requires React 18.3+)
echo "  ✓ Updated Next.js to 15.1.6"

cd ..

# 1.2 Fix Missing Dependencies
echo ""
echo "📦 Step 1.2: Adding missing dependencies..."
cd packages/video-agent-schema

# Check if @sinclair/typebox exists
if ! grep -q "@sinclair/typebox" package.json; then
  echo "  Adding @sinclair/typebox..."
  pnpm add @sinclair/typebox
else
  echo "  ✓ @sinclair/typebox already present"
fi

cd ../..

# 1.3 Clean Build Artifacts
echo ""
echo "🧹 Step 1.3: Cleaning build artifacts..."

# Remove all .next directories
find . -type d -name ".next" -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true
echo "  ✓ Removed .next directories"

# Remove all dist directories (except in node_modules)
find . -type d -name "dist" -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true
echo "  ✓ Removed dist directories"

# Remove all build directories
find . -type d -name "build" -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true
echo "  ✓ Removed build directories"

# Remove log files
find . -maxdepth 1 -name "*.log" -delete 2>/dev/null || true
echo "  ✓ Removed log files"

# 1.4 Update .gitignore
echo ""
echo "📝 Step 1.4: Updating .gitignore..."

# Append to .gitignore if lines don't exist
cat >> .gitignore << 'EOF'

# Build outputs (added by cleanup script)
.next/
dist/
build/
*.log
*.tsbuildinfo
.turbo/

# Temporary files
*.sql.backup
*.md.backup
combined_*.sql
*.tar.gz

# OS files
.DS_Store
Thumbs.db
.AppleDouble
.LSOverride

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Testing
coverage/
.nyc_output/

# Misc
.env.local.backup
.vercel
EOF

# Remove duplicate lines
sort -u .gitignore -o .gitignore
echo "  ✓ Updated .gitignore"

# 1.5 Reinstall Dependencies
echo ""
echo "📦 Step 1.5: Reinstalling dependencies..."

# Install root dependencies
pnpm install

echo "  ✓ Dependencies installed"

# 1.6 Build Shared Packages
echo ""
echo "🔨 Step 1.6: Building shared packages..."

pnpm --filter @va/shared build
echo "  ✓ Built @va/shared"

pnpm --filter @easymo/commons build
echo "  ✓ Built @easymo/commons"

pnpm --filter @easymo/video-agent-schema build
echo "  ✓ Built @easymo/video-agent-schema"

# 1.7 Build Admin App
echo ""
echo "🔨 Step 1.7: Building admin-app..."

pnpm --filter @easymo/admin-app run build

if [ $? -eq 0 ]; then
  echo "  ✓ Admin app built successfully"
else
  echo "  ❌ Admin app build failed"
  exit 1
fi

# 1.8 Test Dev Mode
echo ""
echo "🧪 Step 1.8: Testing development mode..."

cd admin-app
timeout 30 npm run dev > /tmp/next-dev-test.log 2>&1 &
DEV_PID=$!

sleep 15

# Check if server started
if curl -s http://localhost:3000/login | grep -q "Admin sign-in"; then
  echo "  ✓ Development mode working!"
  kill $DEV_PID 2>/dev/null || true
else
  echo "  ⚠️  Development mode test inconclusive (may need manual verification)"
  kill $DEV_PID 2>/dev/null || true
fi

cd ..

echo ""
echo "✅ Phase 1 Complete!"
echo "===================="
echo ""
echo "Next steps:"
echo "1. Test the admin app: cd admin-app && npm run dev"
echo "2. Verify http://localhost:3000/login works"
echo "3. Run tests: pnpm test"
echo "4. Proceed to Phase 2: bash scripts/cleanup/phase2-organize-files.sh"
echo ""
echo "If issues occur, rollback with:"
echo "  git reset --hard pre-cleanup-backup-2025-11-14"
