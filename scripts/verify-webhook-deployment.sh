#!/bin/bash
# WhatsApp Webhook Services Deployment Verification Script
# Version: 1.0

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🔍 Verifying WhatsApp Webhook Services Deployment"
echo "=================================================="

SERVICES=(
  "wa-webhook-core"
  "wa-webhook-profile"
  "wa-webhook-mobility"
  "wa-webhook-insurance"
)

PASSED=0
FAILED=0

# Verify function configurations
echo -e "${YELLOW}Checking function configurations...${NC}"
for SERVICE in "${SERVICES[@]}"; do
  CONFIG_FILE="$PROJECT_ROOT/supabase/functions/$SERVICE/function.json"
  
  if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ $SERVICE: function.json missing${NC}"
    ((FAILED++))
    continue
  fi
  
  # Validate JSON
  if command -v jq >/dev/null 2>&1; then
    if jq empty "$CONFIG_FILE" 2>/dev/null; then
      VERSION=$(jq -r '.version' "$CONFIG_FILE")
      VERIFY_JWT=$(jq -r '.verify_jwt' "$CONFIG_FILE")
      
      if [ "$VERSION" == "2.2.0" ] && [ "$VERIFY_JWT" == "false" ]; then
        echo -e "${GREEN}✅ $SERVICE: v$VERSION, verify_jwt=$VERIFY_JWT${NC}"
        ((PASSED++))
      else
        echo -e "${YELLOW}⚠️  $SERVICE: v$VERSION, verify_jwt=$VERIFY_JWT (expected v2.2.0, verify_jwt=false)${NC}"
        ((FAILED++))
      fi
    else
      echo -e "${RED}❌ $SERVICE: Invalid JSON${NC}"
      ((FAILED++))
    fi
  else
    echo -e "${YELLOW}⚠️  $SERVICE: Cannot validate (jq not installed)${NC}"
  fi
done

# Verify no backup files
echo ""
echo -e "${YELLOW}Checking for backup files...${NC}"
BACKUP_COUNT=$(find "$PROJECT_ROOT/supabase/functions" -name "*.bak" -o -name "*backup*" | grep -v ".archive" | wc -l | tr -d ' ')

if [ "$BACKUP_COUNT" -eq "0" ]; then
  echo -e "${GREEN}✅ No backup files found${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Found $BACKUP_COUNT backup files${NC}"
  ((FAILED++))
fi

# Verify health check module
echo ""
echo -e "${YELLOW}Checking health check module...${NC}"
if [ -f "$PROJECT_ROOT/supabase/functions/_shared/health-check.ts" ]; then
  echo -e "${GREEN}✅ Health check module exists${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Health check module missing${NC}"
  ((FAILED++))
fi

# Summary
echo ""
echo "=================================================="
echo -e "Summary: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
echo "=================================================="

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All verifications passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some verifications failed${NC}"
  exit 1
fi
