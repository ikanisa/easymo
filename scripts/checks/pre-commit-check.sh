#!/bin/bash
set -euo pipefail

# Pre-commit checks for EasyMO
# Run this before committing code

echo "🔍 Running pre-commit checks..."

ERRORS=0

# 1. Check for console.log in staged files
echo -n "Checking for console.log... "
STAGED_TS_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' || true)

if [ -n "$STAGED_TS_FILES" ]; then
  CONSOLE_LOGS=$(echo "$STAGED_TS_FILES" | xargs grep -n "console\.(log|debug|info)" 2>/dev/null || true)
  if [ -n "$CONSOLE_LOGS" ]; then
    echo "❌"
    echo "$CONSOLE_LOGS"
    echo "Replace console.log with structured logging (childLogger)"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅"
  fi
else
  echo "⏭️  (no TypeScript files)"
fi

# 2. Check for secrets in client env vars
echo -n "Checking for exposed secrets... "
ENV_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.env' || true)

if [ -n "$ENV_FILES" ]; then
  EXPOSED=$(echo "$ENV_FILES" | xargs grep -E '^(NEXT_PUBLIC_|VITE_).*(SERVICE_ROLE|SECRET|PRIVATE|PASSWORD|TOKEN)' 2>/dev/null || true)
  if [ -n "$EXPOSED" ]; then
    echo "❌"
    echo "$EXPOSED"
    echo "Remove secrets from client-exposed env vars"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅"
  fi
else
  echo "⏭️  (no .env files)"
fi

# 3. Check workspace protocol
echo -n "Checking workspace dependencies... "
PKG_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep 'package\.json$' || true)

if [ -n "$PKG_FILES" ]; then
  BAD_DEPS=$(echo "$PKG_FILES" | xargs grep -E '"@easymo/[^"]+": "\*"' 2>/dev/null || true)
  if [ -n "$BAD_DEPS" ]; then
    echo "❌"
    echo "$BAD_DEPS"
    echo "Use workspace:* protocol for internal dependencies"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅"
  fi
else
  echo "⏭️  (no package.json)"
fi

# 4. TypeScript check
echo -n "Running type check... "
if command -v pnpm &> /dev/null; then
  if pnpm type-check --silent 2>&1 | grep -q "error"; then
    echo "❌"
    pnpm type-check 2>&1 | grep "error"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅"
  fi
else
  echo "⏭️  (pnpm not found)"
fi

# 5. Lint staged files
echo -n "Running ESLint... "
if [ -n "$STAGED_TS_FILES" ]; then
  if ! echo "$STAGED_TS_FILES" | xargs pnpm exec eslint --quiet 2>/dev/null; then
    echo "❌"
    echo "$STAGED_TS_FILES" | xargs pnpm exec eslint
    ERRORS=$((ERRORS + 1))
  else
    echo "✅"
  fi
else
  echo "⏭️  (no files to lint)"
fi

echo ""
echo "=========================================="
if [ $ERRORS -gt 0 ]; then
  echo "❌ Pre-commit checks FAILED ($ERRORS errors)"
  echo "Fix the issues above before committing"
  exit 1
else
  echo "✅ All pre-commit checks PASSED"
  exit 0
fi
