#!/bin/bash
set -euo pipefail

# P0 Readiness Verification Script
# Checks all P0 blockers daily during Week 1

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "================================================================"
echo "  EasyMO P0 Production Readiness Check"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================"
echo ""

# Track overall status
FAILURES=0

# 1. Rate Limiting Module
echo -n "📊 Rate limiting module exists: "
if [ -f "supabase/functions/_shared/rate-limit/index.ts" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  ((FAILURES++))
fi

# 2. SQL Scripts
echo -n "📋 RLS audit script exists: "
if [ -f "scripts/sql/rls-audit.sql" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  ((FAILURES++))
fi

echo -n "📋 Audit log schema exists: "
if [ -f "scripts/sql/audit-log-schema.sql" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  ((FAILURES++))
fi

echo -n "📋 Audit triggers script exists: "
if [ -f "scripts/sql/audit-triggers.sql" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  ((FAILURES++))
fi

# 3. Database checks (if DATABASE_URL is set)
if [ -n "${DATABASE_URL:-}" ]; then
  echo ""
  echo "🗄️  Database Checks:"
  
  echo -n "  Audit log table exists: "
  if psql "$DATABASE_URL" -tAc "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_log')" | grep -q "t"; then
    echo -e "${GREEN}✓ PASS${NC}"
  else
    echo -e "${YELLOW}⚠ NOT CREATED YET${NC}"
  fi

  echo -n "  Audit triggers count: "
  TRIGGER_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE 'audit_%'" || echo "0")
  if [ "$TRIGGER_COUNT" -ge "5" ]; then
    echo -e "${GREEN}✓ $TRIGGER_COUNT triggers${NC}"
  else
    echo -e "${YELLOW}⚠ Only $TRIGGER_COUNT triggers (target: 10)${NC}"
  fi

  echo -n "  RLS policies count: "
  POLICY_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM pg_policies WHERE schemaname='public'" || echo "0")
  if [ "$POLICY_COUNT" -ge "10" ]; then
    echo -e "${GREEN}✓ $POLICY_COUNT policies${NC}"
  else
    echo -e "${YELLOW}⚠ Only $POLICY_COUNT policies (target: 30+)${NC}"
  fi
else
  echo ""
  echo -e "${YELLOW}⚠ DATABASE_URL not set - skipping database checks${NC}"
fi

# 4. Test Coverage (if wallet-service exists)
echo ""
if [ -d "services/wallet-service" ]; then
  echo -n "🧪 Wallet service tests exist: "
  if [ -f "services/wallet-service/package.json" ]; then
    if grep -q "\"test\"" services/wallet-service/package.json; then
      echo -e "${GREEN}✓ PASS${NC}"
    else
      echo -e "${YELLOW}⚠ No test script configured${NC}"
    fi
  else
    echo -e "${YELLOW}⚠ package.json not found${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Wallet service directory not found${NC}"
fi

# Summary
echo ""
echo "================================================================"
if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}✅ All file checks passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Apply SQL scripts: psql \$DATABASE_URL -f scripts/sql/audit-log-schema.sql"
  echo "  2. Apply triggers: psql \$DATABASE_URL -f scripts/sql/audit-triggers.sql"
  echo "  3. Run RLS audit: psql \$DATABASE_URL -f scripts/sql/rls-audit.sql"
  echo "  4. Implement wallet tests (see docs/production-readiness/QUICK_START.md)"
  exit 0
else
  echo -e "${RED}❌ $FAILURES file check(s) failed${NC}"
  echo ""
  echo "See: docs/production-readiness/QUICK_START.md for implementation guide"
  exit 1
fi
