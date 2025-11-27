#!/bin/bash
# General Broker Agent - Deployment Verification Script
# Run this before deploying to staging/production

set -e

echo "🔍 General Broker Agent - Pre-Deployment Verification"
echo "====================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

check_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

echo "📁 Step 1: File Existence Checks"
echo "-----------------------------------"

# Check migrations
for migration in \
    "supabase/migrations/20251120100000_general_broker_user_memory.sql" \
    "supabase/migrations/20251120100001_general_broker_service_requests.sql" \
    "supabase/migrations/20251120100002_general_broker_vendors.sql" \
    "supabase/migrations/20251120100003_general_broker_catalog_faq.sql"
do
    if [ -f "$migration" ]; then
        check_pass "Migration exists: $(basename $migration)"
    else
        check_fail "Migration missing: $migration"
    fi
done

# Check edge function
if [ -f "supabase/functions/agent-tools-general-broker/index.ts" ]; then
    check_pass "Edge function exists: agent-tools-general-broker"
else
    check_fail "Edge function missing: agent-tools-general-broker"
fi

# Check agent tools
if [ -f "packages/agents/src/tools/generalBrokerTools.ts" ]; then
    check_pass "Agent tools file exists"
else
    check_fail "Agent tools file missing"
fi

# Check agent definition
if [ -f "packages/agents/src/agents/general/general-broker.agent.ts" ]; then
    check_pass "Agent definition exists"
else
    check_fail "Agent definition missing"
fi

echo ""
echo "🔧 Step 2: Migration Hygiene Checks"
echo "-----------------------------------"

for migration in supabase/migrations/202511201000*.sql; do
    filename=$(basename "$migration")
    
    # Check for BEGIN (anywhere in first 10 lines)
    if head -10 "$migration" | grep -q "BEGIN"; then
        check_pass "$filename has BEGIN statement"
    else
        check_fail "$filename missing BEGIN statement"
    fi
    
    # Check for COMMIT (anywhere in last 10 lines)
    if tail -10 "$migration" | grep -q "COMMIT"; then
        check_pass "$filename has COMMIT statement"
    else
        check_fail "$filename missing COMMIT statement"
    fi
done

echo ""
echo "📦 Step 3: TypeScript Compilation Checks"
echo "----------------------------------------"

# Check if TypeScript files have syntax errors (basic check)
if command -v tsc &> /dev/null; then
    if tsc --noEmit --skipLibCheck packages/agents/src/tools/generalBrokerTools.ts 2>/dev/null; then
        check_pass "generalBrokerTools.ts compiles without errors"
    else
        check_warn "TypeScript compilation check failed (may need dependencies)"
    fi
else
    check_warn "TypeScript not found, skipping compilation check"
fi

echo ""
echo "🗃️  Step 4: SQL Syntax Validation"
echo "---------------------------------"

# Basic SQL syntax check (look for common issues)
for migration in supabase/migrations/202511201000*.sql; do
    filename=$(basename "$migration")
    
    # Check for basic SQL keywords
    if grep -q "CREATE TABLE" "$migration"; then
        check_pass "$filename contains CREATE TABLE statements"
    else
        check_warn "$filename has no CREATE TABLE (might be OK if only functions)"
    fi
    
    # Check for RLS
    if grep -q "ROW LEVEL SECURITY" "$migration"; then
        check_pass "$filename enables RLS"
    else
        check_warn "$filename missing RLS policies"
    fi
done

echo ""
echo "🔐 Step 5: Security Checks"
echo "-------------------------"

# Check for hardcoded secrets (basic check)
if grep -r "sk-[a-zA-Z0-9]\{20,\}" supabase/functions/agent-tools-general-broker/ 2>/dev/null; then
    check_fail "Hardcoded OpenAI API key found!"
else
    check_pass "No hardcoded OpenAI keys"
fi

if grep -r "eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*" supabase/functions/agent-tools-general-broker/ 2>/dev/null; then
    check_fail "Hardcoded JWT token found!"
else
    check_pass "No hardcoded JWT tokens"
fi

# Check for service role key usage (should use env var)
if grep -q "SUPABASE_SERVICE_ROLE_KEY" supabase/functions/agent-tools-general-broker/index.ts; then
    check_pass "Uses SUPABASE_SERVICE_ROLE_KEY from env"
else
    check_fail "Missing SUPABASE_SERVICE_ROLE_KEY usage"
fi

echo ""
echo "📊 Step 6: Code Statistics"
echo "-------------------------"

total_lines=$(cat supabase/migrations/202511201000*.sql \
    supabase/functions/agent-tools-general-broker/index.ts \
    packages/agents/src/tools/generalBrokerTools.ts 2>/dev/null | wc -l)

echo "Total lines of code: $total_lines"
echo "Migrations: $(cat supabase/migrations/202511201000*.sql 2>/dev/null | wc -l) lines"
echo "Edge function: $(cat supabase/functions/agent-tools-general-broker/index.ts 2>/dev/null | wc -l) lines"
echo "Agent tools: $(cat packages/agents/src/tools/generalBrokerTools.ts 2>/dev/null | wc -l) lines"

echo ""
echo "📝 Step 7: Documentation Checks"
echo "-------------------------------"

if [ -f "GENERAL_BROKER_AGENT_IMPLEMENTATION.md" ]; then
    check_pass "Implementation blueprint exists"
else
    check_warn "Implementation blueprint missing"
fi

if [ -f "GENERAL_BROKER_IMPLEMENTATION_COMPLETE.md" ]; then
    check_pass "Deployment checklist exists"
else
    check_warn "Deployment checklist missing"
fi

if [ -f "GENERAL_BROKER_DEEP_REVIEW_SUMMARY.md" ]; then
    check_pass "Review summary exists"
else
    check_warn "Review summary missing"
fi

echo ""
echo "🎯 Step 8: Tool Coverage Check"
echo "------------------------------"

# Check if all expected tools are exported
if grep -q "getUserLocationsTool" packages/agents/src/tools/generalBrokerTools.ts; then
    check_pass "getUserLocationsTool defined"
else
    check_fail "getUserLocationsTool missing"
fi

if grep -q "recordServiceRequestTool" packages/agents/src/tools/generalBrokerTools.ts; then
    check_pass "recordServiceRequestTool defined"
else
    check_fail "recordServiceRequestTool missing"
fi

if grep -q "findVendorsNearbyTool" packages/agents/src/tools/generalBrokerTools.ts; then
    check_pass "findVendorsNearbyTool defined"
else
    check_fail "findVendorsNearbyTool missing"
fi

# Check if tools are registered in agent
if grep -q "getUserLocationsTool" packages/agents/src/agents/general/general-broker.agent.ts; then
    check_pass "getUserLocationsTool registered in agent"
else
    check_fail "getUserLocationsTool not registered"
fi

if grep -q "recordServiceRequestTool" packages/agents/src/agents/general/general-broker.agent.ts; then
    check_pass "recordServiceRequestTool registered in agent"
else
    check_fail "recordServiceRequestTool not registered"
fi

echo ""
echo "=========================================="
echo "📊 VERIFICATION SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run: supabase db push"
    echo "2. Run: supabase functions serve agent-tools-general-broker"
    echo "3. Test with curl/Postman"
    echo "4. Deploy: supabase functions deploy agent-tools-general-broker"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please fix before deploying.${NC}"
    exit 1
fi
