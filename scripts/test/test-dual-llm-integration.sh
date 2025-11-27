#!/bin/bash
# Integration test for Dual LLM implementation

echo "=== Dual LLM Integration Test ==="
echo ""

PASS=0
FAIL=0

# Test 1: Check migration file exists
echo "Test 1: Checking migration file exists..."
if [ -f "supabase/migrations/20251120120000_dual_llm_provider_infrastructure.sql" ] && \
   [ -s "supabase/migrations/20251120120000_dual_llm_provider_infrastructure.sql" ]; then
  echo "  ✓ Migration file exists and not empty"
  ((PASS++))
else
  echo "  ✗ Migration file missing or empty"
  ((FAIL++))
fi

# Test 2: Check for required tables in migration
echo "Test 2: Checking migration creates required tables..."
REQUIRED_TABLES=("llm_requests" "llm_failover_events" "tool_provider_routing")
for table in "${REQUIRED_TABLES[@]}"; do
  if grep -q "CREATE TABLE.*$table" supabase/migrations/20251120120000_dual_llm_provider_infrastructure.sql; then
    echo "  ✓ $table table definition found"
    ((PASS++))
  else
    echo "  ✗ $table table definition missing"
    ((FAIL++))
  fi
done

# Test 3: Check TypeScript files exist and have exports
echo "Test 3: Validating TypeScript exports..."
TS_FILES=(
  "supabase/functions/_shared/llm-provider-interface.ts:export interface LLMProvider"
  "supabase/functions/_shared/llm-provider-openai.ts:export class OpenAIProvider"
  "supabase/functions/_shared/llm-provider-gemini.ts:export class GeminiProvider"
  "supabase/functions/_shared/llm-router.ts:export class LLMRouter"
  "supabase/functions/_shared/gemini-tools.ts:export async function normalizeVendorPayload"
)

for entry in "${TS_FILES[@]}"; do
  IFS=':' read -r file export <<< "$entry"
  if [ -f "$file" ]; then
    if grep -q "$export" "$file"; then
      echo "  ✓ $file has $export"
      ((PASS++))
    else
      echo "  ✗ $file missing $export"
      ((FAIL++))
    fi
  else
    echo "  ✗ $file not found"
    ((FAIL++))
  fi
done

# Test 4: Check broker tools integration
echo "Test 4: Checking General Broker integration..."
BROKER_FILE="supabase/functions/agent-tools-general-broker/index.ts"
if [ -f "$BROKER_FILE" ]; then
  if grep -q "normalizeVendorPayload" "$BROKER_FILE" && \
     grep -q "correlationId" "$BROKER_FILE"; then
    echo "  ✓ General Broker has Gemini tools and correlation tracking"
    ((PASS++))
  else
    echo "  ✗ General Broker missing integrations"
    ((FAIL++))
  fi
else
  echo "  ✗ General Broker file not found"
  ((FAIL++))
fi

# Test 5: Check documentation completeness
echo "Test 5: Validating documentation..."
DOC_FILES=(
  "DUAL_LLM_IMPLEMENTATION_GUIDE.md"
  "DUAL_LLM_COMPLETE_SUMMARY.md"
  "DUAL_LLM_ARCHITECTURE_VISUAL.txt"
  "README_DUAL_LLM.md"
)

for doc in "${DOC_FILES[@]}"; do
  if [ -f "$doc" ] && [ -s "$doc" ]; then
    echo "  ✓ $doc exists and not empty"
    ((PASS++))
  else
    echo "  ✗ $doc missing or empty"
    ((FAIL++))
  fi
done

# Test 6: Check deployment scripts
echo "Test 6: Validating deployment scripts..."
if [ -x "deploy-dual-llm.sh" ]; then
  echo "  ✓ deploy-dual-llm.sh is executable"
  ((PASS++))
else
  echo "  ✗ deploy-dual-llm.sh not executable"
  ((FAIL++))
fi

if [ -x "validate-dual-llm.sh" ]; then
  echo "  ✓ validate-dual-llm.sh is executable"
  ((PASS++))
else
  echo "  ✗ validate-dual-llm.sh not executable"
  ((FAIL++))
fi

# Results
echo ""
echo "=== Test Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "✅ All tests passed! Ready for deployment."
  exit 0
else
  echo "❌ Some tests failed. Review errors above."
  exit 1
fi
