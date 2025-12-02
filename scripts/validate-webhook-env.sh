#!/bin/bash
# Environment Variable Validation Script for WhatsApp Webhook Services
# Version: 1.0

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🔍 Validating Environment Variables"
echo "===================================="

REQUIRED_VARS=(
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "WA_PHONE_ID"
  "WA_TOKEN"
  "WA_APP_SECRET"
  "WA_VERIFY_TOKEN"
)

MISSING=()
PRESENT=()

# Check each required variable
for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    MISSING+=("$VAR")
    echo -e "${RED}❌ $VAR - NOT SET${NC}"
  else
    PRESENT+=("$VAR")
    # Show partial value for verification (mask sensitive parts)
    VAL="${!VAR}"
    if [ ${#VAL} -gt 20 ]; then
      MASKED="${VAL:0:10}...${VAL: -10}"
    else
      MASKED="${VAL:0:5}..."
    fi
    echo -e "${GREEN}✅ $VAR - SET ($MASKED)${NC}"
  fi
done

echo ""
echo "===================================="
echo -e "Total: ${GREEN}${#PRESENT[@]} set${NC}, ${RED}${#MISSING[@]} missing${NC}"

if [ ${#MISSING[@]} -gt 0 ]; then
  echo ""
  echo -e "${RED}Missing variables:${NC}"
  for VAR in "${MISSING[@]}"; do
    echo "  - $VAR"
  done
  echo ""
  echo "Please set missing variables in your .env file or environment"
  exit 1
else
  echo -e "${GREEN}✅ All required environment variables are set!${NC}"
  exit 0
fi
