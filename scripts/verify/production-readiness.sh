#!/bin/bash
# Pre-Production Readiness Checker
# Validates all P0 requirements before production deployment

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Check result tracker
declare -a FAILED_CHECKS_LIST
declare -a WARNING_CHECKS_LIST

# Helper functions
check_pass() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  PASSED_CHECKS=$((PASSED_CHECKS + 1))
  echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
  FAILED_CHECKS_LIST+=("$1")
  echo -e "${RED}✗${NC} $1"
}

check_warn() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  WARNING_CHECKS=$((WARNING_CHECKS + 1))
  WARNING_CHECKS_LIST+=("$1")
  echo -e "${YELLOW}⚠${NC} $1"
}

section_header() {
  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}========================================${NC}"
}

# Print header
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  EasyMO Production Readiness Check    ║${NC}"
echo -e "${GREEN}║  Version 1.0                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# ==============================================
# 1. ENVIRONMENT VALIDATION
# ==============================================
section_header "1. Environment Configuration"

# Check required environment variables
if [ -n "${SUPABASE_URL:-}" ]; then
  check_pass "SUPABASE_URL is set"
else
  check_fail "SUPABASE_URL is not set"
fi

if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  check_pass "SUPABASE_SERVICE_ROLE_KEY is set"
else
  check_fail "SUPABASE_SERVICE_ROLE_KEY is not set"
fi

if [ -n "${SUPABASE_ANON_KEY:-}" ]; then
  check_pass "SUPABASE_ANON_KEY is set"
else
  check_warn "SUPABASE_ANON_KEY is not set (needed for client apps)"
fi

if [ -n "${DATABASE_URL:-}" ]; then
  check_pass "DATABASE_URL is set (for Prisma)"
else
  check_warn "DATABASE_URL not set (needed for services)"
fi

# Check for leaked secrets in client env vars
if env | grep -E '^(VITE_|NEXT_PUBLIC_).*SERVICE_ROLE' > /dev/null 2>&1; then
  check_fail "SERVICE_ROLE_KEY leaked in client environment variables!"
else
  check_pass "No SERVICE_ROLE_KEY in client environment variables"
fi

# ==============================================
# 2. DATABASE SECURITY
# ==============================================
section_header "2. Database Security (RLS & Audit)"

# Check if we can connect to database
if [ -n "${DATABASE_URL:-}" ]; then
  if command -v psql > /dev/null 2>&1; then
    # Test database connection
    if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
      check_pass "Database connection successful"
      
      # Check audit_log table exists
      audit_table_exists=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'audit_log');")
      if [ "$audit_table_exists" == "t" ]; then
        check_pass "audit_log table exists"
      else
        check_fail "audit_log table does NOT exist"
      fi
      
      # Check RLS enabled on wallet_accounts
      rls_enabled=$(psql "$DATABASE_URL" -tAc "SELECT relrowsecurity FROM pg_class WHERE relname = 'wallet_accounts';")
      if [ "$rls_enabled" == "t" ]; then
        check_pass "RLS enabled on wallet_accounts"
      else
        check_fail "RLS NOT enabled on wallet_accounts"
      fi
      
      # Count audit triggers
      trigger_count=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE 'audit_%';")
      if [ "$trigger_count" -gt 0 ]; then
        check_pass "Audit triggers found ($trigger_count triggers)"
      else
        check_fail "No audit triggers found"
      fi
      
    else
      check_fail "Cannot connect to database"
    fi
  else
    check_warn "psql not installed - skipping database checks"
  fi
else
  check_warn "DATABASE_URL not set - skipping database checks"
fi

# ==============================================
# 3. RATE LIMITING
# ==============================================
section_header "3. Rate Limiting Infrastructure"

# Check for rate limiting module
if [ -f "supabase/functions/_shared/rate-limit.ts" ]; then
  check_pass "Rate limiting module exists"
else
  check_fail "Rate limiting module NOT found"
fi

# Check for Redis configuration
if [ -n "${UPSTASH_REDIS_URL:-}" ] && [ -n "${UPSTASH_REDIS_TOKEN:-}" ]; then
  check_pass "Redis (Upstash) configured for rate limiting"
else
  check_warn "Redis not configured - rate limiting will fail open"
fi

# ==============================================
# 4. CODE QUALITY & BUILD
# ==============================================
section_header "4. Code Quality & Build System"

# Check pnpm installed
if command -v pnpm > /dev/null 2>&1; then
  pnpm_version=$(pnpm --version)
  check_pass "pnpm installed (version $pnpm_version)"
else
  check_fail "pnpm NOT installed (required for workspace)"
fi

# Check for required package.json scripts
if [ -f "package.json" ]; then
  if grep -q '"test"' package.json; then
    check_pass "Test script defined in package.json"
  else
    check_warn "No test script in package.json"
  fi
  
  if grep -q '"build"' package.json; then
    check_pass "Build script defined in package.json"
  else
    check_fail "No build script in package.json"
  fi
else
  check_fail "package.json not found"
fi

# Check TypeScript configuration
if [ -f "tsconfig.json" ]; then
  check_pass "TypeScript configuration exists"
else
  check_fail "tsconfig.json not found"
fi

# ==============================================
# 5. TESTING INFRASTRUCTURE
# ==============================================
section_header "5. Testing Infrastructure"

# Check wallet service tests
if [ -d "services/wallet-service/test" ]; then
  test_count=$(find services/wallet-service/test -name "*.spec.ts" -o -name "*.test.ts" | wc -l)
  if [ "$test_count" -gt 0 ]; then
    check_pass "Wallet service tests exist ($test_count files)"
  else
    check_warn "Wallet service test directory exists but no tests found"
  fi
else
  check_fail "Wallet service test directory NOT found"
fi

# Check for vitest config
if [ -f "services/wallet-service/vitest.config.ts" ]; then
  check_pass "Wallet service vitest configured"
  
  # Check for coverage thresholds
  if grep -q "thresholds" services/wallet-service/vitest.config.ts; then
    check_pass "Coverage thresholds defined"
  else
    check_warn "No coverage thresholds in vitest config"
  fi
else
  check_fail "Wallet service vitest.config.ts NOT found"
fi

# ==============================================
# 6. OBSERVABILITY
# ==============================================
section_header "6. Observability & Logging"

# Check for observability module
if [ -f "supabase/functions/_shared/observability.ts" ]; then
  check_pass "Observability module exists"
else
  check_fail "Observability module NOT found"
fi

# Check for Sentry configuration
if grep -q "sentry" package.json 2>/dev/null; then
  check_pass "Sentry SDK installed"
else
  check_warn "Sentry not found (recommended for error tracking)"
fi

# ==============================================
# 7. DEPLOYMENT INFRASTRUCTURE
# ==============================================
section_header "7. Deployment Infrastructure"

# Check for Supabase CLI
if command -v supabase > /dev/null 2>&1; then
  supabase_version=$(supabase --version | head -n1)
  check_pass "Supabase CLI installed ($supabase_version)"
else
  check_fail "Supabase CLI NOT installed"
fi

# Check for deployment scripts
if [ -d "scripts/deploy" ]; then
  deploy_script_count=$(find scripts/deploy -name "*.sh" | wc -l)
  check_pass "Deployment scripts exist ($deploy_script_count scripts)"
else
  check_warn "scripts/deploy directory not found"
fi

# Check for GitHub workflows
if [ -d ".github/workflows" ]; then
  workflow_count=$(find .github/workflows -name "*.yml" -o -name "*.yaml" | wc -l)
  check_pass "GitHub workflows exist ($workflow_count workflows)"
else
  check_warn ".github/workflows directory not found"
fi

# ==============================================
# 8. DOCUMENTATION
# ==============================================
section_header "8. Documentation"

# Check for key documentation files
docs_required=("README.md" "GROUND_RULES.md" "PRODUCTION_READINESS_STATUS.md")
for doc in "${docs_required[@]}"; do
  if [ -f "$doc" ]; then
    check_pass "$doc exists"
  else
    check_warn "$doc not found"
  fi
done

# ==============================================
# 9. SECURITY CHECKS
# ==============================================
section_header "9. Security Verification"

# Check for .env in .gitignore
if [ -f ".gitignore" ]; then
  if grep -q "^\.env" .gitignore; then
    check_pass ".env files ignored in git"
  else
    check_fail ".env NOT in .gitignore - risk of secret leak!"
  fi
else
  check_fail ".gitignore not found"
fi

# Check for security guard script
if [ -f "scripts/assert-no-service-role-in-client.mjs" ]; then
  check_pass "Client secret guard script exists"
else
  check_fail "Client secret guard script NOT found"
fi

# ==============================================
# SUMMARY
# ==============================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Total Checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed:       $PASSED_CHECKS${NC}"
echo -e "${RED}Failed:       $FAILED_CHECKS${NC}"
echo -e "${YELLOW}Warnings:     $WARNING_CHECKS${NC}"
echo ""

# Calculate score
SCORE=$(awk "BEGIN {printf \"%.0f\", ($PASSED_CHECKS / $TOTAL_CHECKS) * 100}")

echo -e "Score: ${SCORE}%"
echo ""

# Show failed checks
if [ ${#FAILED_CHECKS_LIST[@]} -gt 0 ]; then
  echo -e "${RED}Critical Issues (Must Fix):${NC}"
  for item in "${FAILED_CHECKS_LIST[@]}"; do
    echo -e "  ${RED}✗${NC} $item"
  done
  echo ""
fi

# Show warnings
if [ ${#WARNING_CHECKS_LIST[@]} -gt 0 ]; then
  echo -e "${YELLOW}Warnings (Recommended):${NC}"
  for item in "${WARNING_CHECKS_LIST[@]}"; do
    echo -e "  ${YELLOW}⚠${NC} $item"
  done
  echo ""
fi

# Final verdict
echo -e "${BLUE}========================================${NC}"
if [ $FAILED_CHECKS -eq 0 ]; then
  echo -e "${GREEN}✅ PRODUCTION READY${NC}"
  echo -e "${GREEN}All critical checks passed!${NC}"
  if [ $WARNING_CHECKS -gt 0 ]; then
    echo -e "${YELLOW}Note: $WARNING_CHECKS warning(s) should be addressed${NC}"
  fi
  exit 0
else
  echo -e "${RED}❌ NOT PRODUCTION READY${NC}"
  echo -e "${RED}$FAILED_CHECKS critical issue(s) must be fixed${NC}"
  echo ""
  echo "Run the following to fix issues:"
  echo "  1. Apply database migrations: supabase db push"
  echo "  2. Run tests: pnpm test"
  echo "  3. Verify rate limiting: scripts/verify/rate-limiting-test.sh"
  exit 1
fi
