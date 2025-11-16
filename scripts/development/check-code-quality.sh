#!/bin/bash
# Check code quality across the project

echo "🔍 Running Code Quality Checks"
echo "=============================="

cd "$(dirname "$0")/../.."

# TypeScript type checking
echo ""
echo "1. TypeScript Type Checking..."
cd admin-app
pnpm exec tsc --noEmit 2>&1 | grep "error TS" | wc -l | xargs echo "  TypeScript errors:"
cd ..

# ESLint
echo ""
echo "2. ESLint..."
cd admin-app
pnpm exec eslint . --ext .ts,.tsx --quiet 2>&1 | grep "problem" || echo "  No linting errors"
cd ..

# Prettier check
echo ""
echo "3. Prettier Formatting..."
cd admin-app
pnpm exec prettier --check "**/*.{ts,tsx,js,jsx,json,css,md}" 2>&1 | grep "Code style issues" || echo "  ✓ Formatting OK"
cd ..

# Security audit
echo ""
echo "4. Security Audit..."
if [ -f scripts/utilities/audit-security.sh ]; then
  bash scripts/utilities/audit-security.sh
fi

echo ""
echo "✅ Code quality check complete"
