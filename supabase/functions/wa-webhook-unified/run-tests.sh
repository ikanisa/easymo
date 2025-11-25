#!/bin/bash
# Run all tests for wa-webhook-unified
# Usage: ./run-tests.sh [unit|integration|e2e|all]

set -e

TEST_TYPE=${1:-all}
SUPABASE_URL=${SUPABASE_URL:-"http://localhost:54321"}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-""}

echo "🧪 Running tests for wa-webhook-unified..."
echo "Test type: $TEST_TYPE"
echo ""

cd "$(dirname "$0")"

case $TEST_TYPE in
  unit)
    echo "📦 Running unit tests..."
    deno test --allow-net --allow-env __tests__/*-agent.test.ts
    ;;
  
  integration)
    echo "🔗 Running integration tests..."
    deno test --allow-net --allow-env __tests__/orchestrator.test.ts
    ;;
  
  e2e)
    echo "🌐 Running E2E tests..."
    deno test --allow-net --allow-env __tests__/e2e.test.ts
    ;;
  
  all)
    echo "🎯 Running all tests..."
    deno test --allow-net --allow-env __tests__/
    ;;
  
  *)
    echo "❌ Unknown test type: $TEST_TYPE"
    echo "Usage: ./run-tests.sh [unit|integration|e2e|all]"
    exit 1
    ;;
esac

echo ""
echo "✅ Tests completed!"
