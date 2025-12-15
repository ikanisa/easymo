#!/bin/bash

# Test runner for wa-webhook-core
# Runs all test suites with proper configuration

set -e

echo "🧪 Running wa-webhook-core test suite..."
echo ""

# Check environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
  exit 1
fi

echo "✅ Environment configured"
echo "   URL: ${SUPABASE_URL:0:30}..."
echo ""

# Navigate to test directory
cd "$(dirname "$0")/supabase/functions/wa-webhook-core/__tests__"

# Run tests (if they exist)
if [ -d "$(dirname "$0")/supabase/functions/wa-webhook-core/__tests__" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 Test Suite: Router Tests"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  deno test --allow-env --allow-net

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ All tests passed!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo "⚠️ No test directory found, skipping tests"
fi
