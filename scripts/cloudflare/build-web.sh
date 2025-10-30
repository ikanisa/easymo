#!/usr/bin/env bash
# Cloudflare Pages Build Script - Root Vite SPA (easymo-web)
# This script handles building the main Vite application for Cloudflare Pages deployment.
set -euo pipefail

echo "===================================="
echo "Cloudflare Pages build-web: start"
echo "===================================="
echo "Node: $(node -v || echo 'not found')"
echo "NPM:  $(npm -v || echo 'not found')"
echo "Working directory: $(pwd)"
echo ""

# Ensure we're in the repository root
if [[ ! -f "package.json" ]] || [[ ! -f "vite.config.ts" ]]; then
  echo "❌ ERROR: Must run from repository root (expected package.json and vite.config.ts)"
  exit 1
fi

echo "Step 1: Ensure pnpm is available (>= 10.18.3)"
echo "-----------------------------------------------"
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

echo "Step 2: Install dependencies (frozen lockfile)"
echo "-----------------------------------------------"
pnpm install --frozen-lockfile
echo "✓ Dependencies installed"
echo ""

echo "Step 3: Build shared packages first (required for monorepo)"
echo "------------------------------------------------------------"
echo "Building @va/shared..."
pnpm --filter @va/shared build

echo "Building @easymo/commons..."
pnpm --filter @easymo/commons build

echo "✓ Shared packages built"
echo ""

echo "Step 4: Run security guard (assert no service role in client env)"
echo "------------------------------------------------------------------"
node ./scripts/assert-no-service-role-in-client.mjs
echo "✓ Security guard passed"
echo ""

echo "Step 5: Build Vite application"
echo "-------------------------------"
# The prebuild hook will run automatically and execute the security check again
# The build command in package.json is: "pnpm --filter @va/shared build && vite build"
# But we've already built shared packages, so we just need vite build
pnpm exec vite build
echo "✓ Vite build complete"
echo ""

echo "Step 6: Verify output directory exists"
echo "---------------------------------------"
if [[ ! -d "dist" ]]; then
  echo "❌ ERROR: Build output directory 'dist' not found"
  exit 1
fi

# Check that dist contains essential files
if [[ ! -f "dist/index.html" ]]; then
  echo "❌ ERROR: dist/index.html not found - build may have failed"
  exit 1
fi

echo "✓ Build output verified:"
echo "  - dist/ directory exists"
echo "  - dist/index.html present"
echo "  - Build artifacts:"
ls -lh dist/ | head -20
echo ""

echo "===================================="
echo "✅ Cloudflare Pages build-web: SUCCESS"
echo "===================================="
echo ""
echo "Output directory: dist/"
echo "Deploy command: Cloudflare Pages will serve from dist/"
echo ""
