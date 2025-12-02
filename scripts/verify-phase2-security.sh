#!/bin/bash
# Phase 2 Security Integration Verification Script
# Version: 1.0

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔒 Phase 2: Security & Error Handling Verification${NC}"
echo "============================================================"

SERVICES=(
  "wa-webhook-core"
  "wa-webhook-profile"
  "wa-webhook-mobility"
  "wa-webhook-insurance"
)

PASSED=0
FAILED=0
WARNINGS=0

# Check security module files
echo -e "\n${YELLOW}Checking security module files...${NC}"

SECURITY_FILES=(
  "supabase/functions/_shared/security/middleware.ts"
  "supabase/functions/_shared/security/signature.ts"
  "supabase/functions/_shared/security/input-validator.ts"
  "supabase/functions/_shared/security/audit-logger.ts"
  "supabase/functions/_shared/errors/error-handler.ts"
)

for FILE in "${SECURITY_FILES[@]}"; do
  if [ -f "$PROJECT_ROOT/$FILE" ]; then
    echo -e "${GREEN}✅ $FILE exists${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ $FILE missing${NC}"
    ((FAILED++))
  fi
done

# Check for security tests
echo -e "\n${YELLOW}Checking security test files...${NC}"

TEST_FILES=(
  "supabase/functions/_shared/security/__tests__/signature.test.ts"
  "supabase/functions/_shared/security/__tests__/input-validator.test.ts"
  "supabase/functions/_shared/security/__tests__/rate-limit.test.ts"
)

for FILE in "${TEST_FILES[@]}"; do
  if [ -f "$PROJECT_ROOT/$FILE" ]; then
    echo -e "${GREEN}✅ $FILE exists${NC}"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠️  $FILE missing (optional)${NC}"
    ((WARNINGS++))
  fi
done

# Check audit_logs migration
echo -e "\n${YELLOW}Checking database migrations...${NC}"

if [ -f "$PROJECT_ROOT/supabase/migrations/20251202200000_create_audit_logs.sql" ]; then
  echo -e "${GREEN}✅ audit_logs migration exists${NC}"
  ((PASSED++))
  
  # Check if migration has BEGIN/COMMIT
  if grep -q "^BEGIN;" "$PROJECT_ROOT/supabase/migrations/20251202200000_create_audit_logs.sql" && \
     grep -q "^COMMIT;" "$PROJECT_ROOT/supabase/migrations/20251202200000_create_audit_logs.sql"; then
    echo -e "${GREEN}✅ Migration has proper BEGIN/COMMIT${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ Migration missing BEGIN/COMMIT${NC}"
    ((FAILED++))
  fi
  
  # Check for indexes
  if grep -q "CREATE INDEX" "$PROJECT_ROOT/supabase/migrations/20251202200000_create_audit_logs.sql"; then
    echo -e "${GREEN}✅ Migration includes indexes${NC}"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠️  No indexes found in migration${NC}"
    ((WARNINGS++))
  fi
else
  echo -e "${RED}❌ audit_logs migration missing${NC}"
  ((FAILED++))
fi

# Check if services are using security middleware
echo -e "\n${YELLOW}Checking service integration...${NC}"

for SERVICE in "${SERVICES[@]}"; do
  SERVICE_DIR="$PROJECT_ROOT/supabase/functions/$SERVICE"
  
  if [ ! -d "$SERVICE_DIR" ]; then
    echo -e "${RED}❌ $SERVICE directory not found${NC}"
    ((FAILED++))
    continue
  fi
  
  # Check for security imports in index.ts
  if grep -q "security/middleware\|createSecurityMiddleware\|SecurityMiddleware" "$SERVICE_DIR/index.ts" 2>/dev/null || \
     grep -q "security/middleware\|createSecurityMiddleware\|SecurityMiddleware" "$SERVICE_DIR/index.optimized.ts" 2>/dev/null; then
    echo -e "${GREEN}✅ $SERVICE: Using security middleware${NC}"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠️  $SERVICE: Security middleware not imported${NC}"
    ((WARNINGS++))
  fi
  
  # Check for signature verification
  if grep -q "verifySignature\|verifyWebhookRequest" "$SERVICE_DIR/index.ts" 2>/dev/null || \
     grep -q "verifySignature\|verifyWebhookRequest" "$SERVICE_DIR/index.optimized.ts" 2>/dev/null; then
    echo -e "${GREEN}✅ $SERVICE: Using signature verification${NC}"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠️  $SERVICE: Signature verification not found${NC}"
    ((WARNINGS++))
  fi
  
  # Check for error handler
  if grep -q "errorHandler\|ErrorHandler\|createError" "$SERVICE_DIR/index.ts" 2>/dev/null || \
     grep -q "errorHandler\|ErrorHandler\|createError" "$SERVICE_DIR/index.optimized.ts" 2>/dev/null; then
    echo -e "${GREEN}✅ $SERVICE: Using error handler${NC}"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠️  $SERVICE: Error handler not found${NC}"
    ((WARNINGS++))
  fi
done

# Security feature checklist
echo -e "\n${YELLOW}Security feature checklist:${NC}"

FEATURES=(
  "Content-type validation:supabase/functions/_shared/security/middleware.ts:validateContentType"
  "Request size limits:supabase/functions/_shared/security/middleware.ts:maxBodySize"
  "Rate limiting:supabase/functions/_shared/security/middleware.ts:rateLimit"
  "HMAC signature verification:supabase/functions/_shared/security/signature.ts:verifySignature"
  "Timing-safe comparison:supabase/functions/_shared/security/signature.ts:timingSafeEqual"
  "SQL injection detection:supabase/functions/_shared/security/input-validator.ts:hasSQLInjectionPatterns"
  "XSS pattern detection:supabase/functions/_shared/security/input-validator.ts:hasXSSPatterns"
  "Phone validation (E.164):supabase/functions/_shared/security/input-validator.ts:isValidPhoneNumber"
  "Email validation:supabase/functions/_shared/security/input-validator.ts:isValidEmail"
  "UUID validation:supabase/functions/_shared/security/input-validator.ts:isValidUUID"
  "PII masking:supabase/functions/_shared/security/audit-logger.ts:maskSensitiveData"
  "Multi-language errors:supabase/functions/_shared/errors/error-handler.ts:ERROR_MESSAGES"
)

for FEATURE in "${FEATURES[@]}"; do
  IFS=':' read -r NAME FILE PATTERN <<< "$FEATURE"
  
  if grep -q "$PATTERN" "$PROJECT_ROOT/$FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ $NAME${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ $NAME${NC}"
    ((FAILED++))
  fi
done

# Environment variable check
echo -e "\n${YELLOW}Checking required environment variables...${NC}"

ENV_VARS=(
  "WA_APP_SECRET"
  "WA_VERIFY_TOKEN"
  "SUPABASE_SERVICE_ROLE_KEY"
)

for VAR in "${ENV_VARS[@]}"; do
  if [ ! -z "${!VAR}" ]; then
    echo -e "${GREEN}✅ $VAR is set${NC}"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠️  $VAR not set (check production environment)${NC}"
    ((WARNINGS++))
  fi
done

# Summary
echo ""
echo "============================================================"
echo -e "${BLUE}Phase 2 Security Verification Summary${NC}"
echo "============================================================"
echo -e "✅ Passed:   ${GREEN}$PASSED${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "❌ Failed:   ${RED}$FAILED${NC}"
echo "============================================================"

if [ $FAILED -eq 0 ] && [ $WARNINGS -lt 5 ]; then
  echo -e "${GREEN}✅ Phase 2 verification passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Run security tests: deno test supabase/functions/_shared/security/__tests__/"
  echo "  2. Review service integration in each webhook handler"
  echo "  3. Proceed to Phase 3: Test Coverage & QA"
  exit 0
elif [ $FAILED -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Phase 2 verification passed with warnings${NC}"
  echo ""
  echo "Review warnings before proceeding to Phase 3"
  exit 0
else
  echo -e "${RED}❌ Phase 2 verification failed${NC}"
  echo ""
  echo "Please address failed checks before proceeding"
  exit 1
fi
