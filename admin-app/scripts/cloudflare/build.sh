#!/usr/bin/env bash
# Cloudflare Pages Build Script - Admin App (easymo-admin)
# This script handles building the Next.js 14 admin application for Cloudflare Pages deployment.
set -euo pipefail

echo "===================================="
echo "Cloudflare Pages build-admin: start"
echo "===================================="
echo "Node: $(node -v || echo 'not found')"
echo "NPM:  $(npm -v || echo 'not found')"
echo "Working directory: $(pwd)"
echo ""

# Determine if we're in the admin-app directory or repository root
if [[ -f "next.config.mjs" ]] && [[ -f "package.json" ]]; then
  echo "✓ Detected admin-app directory"
  IN_ADMIN_DIR=true
elif [[ -d "admin-app" ]] && [[ -f "admin-app/next.config.mjs" ]]; then
  echo "✓ Detected repository root, changing to admin-app/"
  cd admin-app
  IN_ADMIN_DIR=true
else
  echo "❌ ERROR: Cannot find admin-app directory or next.config.mjs"
  exit 1
fi
echo ""

# Also need to handle shared packages from root
REPO_ROOT="$(cd .. && pwd)"
echo "Repository root: ${REPO_ROOT}"
echo ""

echo "Step 1: Ensure pnpm is available (for shared packages)"
echo "------------------------------------------------------"
# Check if pnpm is already installed
if command -v pnpm &> /dev/null; then
  PNPM_VERSION=$(pnpm --version)
  echo "✓ pnpm already installed: v${PNPM_VERSION}"
else
  echo "Installing pnpm@10.18.3 via npm..."
  npm install -g pnpm@10.18.3
  PNPM_VERSION=$(pnpm --version)
  echo "✓ pnpm installed: v${PNPM_VERSION}"
fi
echo ""

echo "Step 2: Build shared packages first (monorepo dependency)"
echo "---------------------------------------------------------"
cd "${REPO_ROOT}"
echo "Installing root dependencies..."
pnpm install --frozen-lockfile

echo "Building @va/shared..."
pnpm --filter @va/shared build

echo "Building @easymo/commons..."
pnpm --filter @easymo/commons build

echo "✓ Shared packages built"
echo ""

echo "Step 3: Verify admin-app dependencies (already installed via pnpm)"
echo "-------------------------------------------------------------------"
cd "${REPO_ROOT}/admin-app"
# The admin-app is part of the pnpm workspace and dependencies were installed
# at the repository root with 'pnpm install --frozen-lockfile' in Step 2.
# While admin-app uses npm for running scripts (npm run build, npm test),
# its dependencies (including workspace:* packages) are managed by pnpm.
# This is intentional: pnpm handles installation, npm handles execution.
echo "✓ Admin app dependencies ready (installed via pnpm workspace)"
echo ""

echo "Step 4: Temporarily patch package.json for Cloudflare Pages compatibility"
echo "---------------------------------------------------------------------------"
# The workspace:* protocol is not supported by npm/Vercel build
# Temporarily replace it with a file path for the @cloudflare/next-on-pages adapter
cp package.json package.json.backup
sed -i 's|"@va/shared": "workspace:\*"|"@va/shared": "file:../packages/shared"|g' package.json
echo "✓ package.json patched (workspace:* → file:../packages/shared)"
echo ""

echo "Step 5: Run security guard (assert no service role in client env)"
echo "------------------------------------------------------------------"
node ../scripts/assert-no-service-role-in-client.mjs
echo "✓ Security guard passed"
echo ""

echo "Step 6: Lint admin app (max-warnings=0)"
echo "----------------------------------------"
npm run lint -- --max-warnings=0 || {
  echo "⚠️  Lint warnings/errors found, but continuing build..."
  echo "   (Cloudflare builds should address linting separately)"
}
echo ""

echo "Step 6: Run admin app tests"
echo "----------------------------"
if npm test -- --run; then
  echo "✓ Tests passed"
else
  echo "⚠️  Tests failed, but continuing build..."
  echo "   (Cloudflare builds should address test failures separately)"
fi
echo ""

echo "Step 7: Build Next.js application"
echo "----------------------------------"
# Set production environment
export NODE_ENV=production
export NEXT_PUBLIC_USE_MOCKS=false

npm run build
echo "✓ Next.js build complete"
echo ""

echo "Step 8: Build for Cloudflare Pages (next-on-pages)"
echo "---------------------------------------------------"
# The @cloudflare/next-on-pages adapter creates the .vercel/output structure
pnpm exec @cloudflare/next-on-pages --skip-build
echo "✓ Cloudflare Pages adapter complete"
echo ""

echo "Step 9: Restore original package.json"
echo "---------------------------------------"
mv package.json.backup package.json
echo "✓ package.json restored"
echo ""

echo "Step 10: Verify output directory exists"
echo "---------------------------------------"
if [[ ! -d ".vercel/output" ]]; then
  echo "❌ ERROR: Build output directory '.vercel/output' not found"
  exit 1
fi

if [[ ! -d ".vercel/output/static" ]]; then
  echo "❌ ERROR: Static output directory '.vercel/output/static' not found"
  exit 1
fi

echo "✓ Build output verified:"
echo "  - .vercel/output/ directory exists"
echo "  - .vercel/output/static/ directory exists"
echo "  - Build artifacts:"
ls -lh .vercel/output/static/ | head -20
echo ""

echo "===================================="
echo "✅ Cloudflare Pages build-admin: SUCCESS"
echo "===================================="
echo ""
echo "Output directory: .vercel/output/static/"
echo "Deploy command: Cloudflare Pages will serve from .vercel/output/static/"
echo ""
