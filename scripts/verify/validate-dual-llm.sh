#!/bin/bash
# Quick validation of Dual LLM implementation

echo "=== Dual LLM Implementation Validation ==="
echo ""

# Check files exist
echo "1. Checking files..."
FILES=(
  "supabase/functions/_shared/llm-provider-interface.ts"
  "supabase/functions/_shared/llm-provider-openai.ts"
  "supabase/functions/_shared/llm-provider-gemini.ts"
  "supabase/functions/_shared/llm-router.ts"
  "supabase/functions/_shared/gemini-tools.ts"
  "supabase/migrations/20251120120000_dual_llm_provider_infrastructure.sql"
  "DUAL_LLM_IMPLEMENTATION_GUIDE.md"
  "DUAL_LLM_COMPLETE_SUMMARY.md"
  "deploy-dual-llm.sh"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file MISSING"
  fi
done

echo ""
echo "2. Checking migration structure..."
if grep -q "CREATE TABLE.*llm_requests" supabase/migrations/20251120120000_dual_llm_provider_infrastructure.sql; then
  echo "  ✓ llm_requests table definition found"
fi
if grep -q "CREATE TABLE.*llm_failover_events" supabase/migrations/20251120120000_dual_llm_provider_infrastructure.sql; then
  echo "  ✓ llm_failover_events table definition found"
fi
if grep -q "CREATE TABLE.*tool_provider_routing" supabase/migrations/20251120120000_dual_llm_provider_infrastructure.sql; then
  echo "  ✓ tool_provider_routing table definition found"
fi

echo ""
echo "3. Checking enhanced broker tools..."
if grep -q "normalizeVendorPayload" supabase/functions/agent-tools-general-broker/index.ts; then
  echo "  ✓ Gemini vendor normalization integrated"
fi
if grep -q "correlationId" supabase/functions/agent-tools-general-broker/index.ts; then
  echo "  ✓ Correlation ID tracking added"
fi

echo ""
echo "4. File statistics..."
wc -l supabase/functions/_shared/llm-*.ts supabase/functions/_shared/gemini-tools.ts | tail -1

echo ""
echo "=== Validation Complete ==="
echo ""
echo "Next: Review DUAL_LLM_IMPLEMENTATION_GUIDE.md for deployment steps"
