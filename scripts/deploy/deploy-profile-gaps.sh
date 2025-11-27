#!/bin/bash
set -e

echo "🚀 Deploying Profile Microservice Gap Fixes"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
  echo -e "${RED}Error: Must run from repository root${NC}"
  exit 1
fi

echo -e "${BLUE}Step 1: Applying database migration...${NC}"
if supabase db push; then
  echo -e "${GREEN}✓ Migration applied successfully${NC}"
else
  echo -e "${RED}✗ Migration failed${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}Step 2: Verifying RPC functions...${NC}"
FUNCTIONS=$(supabase db execute "SELECT proname FROM pg_proc WHERE proname LIKE 'wallet_%' ORDER BY proname;" --format csv 2>/dev/null | tail -n +2)

if echo "$FUNCTIONS" | grep -q "wallet_credit_tokens"; then
  echo -e "${GREEN}✓ wallet_credit_tokens exists${NC}"
else
  echo -e "${RED}✗ wallet_credit_tokens missing${NC}"
  exit 1
fi

if echo "$FUNCTIONS" | grep -q "wallet_debit_tokens"; then
  echo -e "${GREEN}✓ wallet_debit_tokens exists${NC}"
else
  echo -e "${RED}✗ wallet_debit_tokens missing${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}Step 3: Deploying edge function...${NC}"
if supabase functions deploy wa-webhook-profile; then
  echo -e "${GREEN}✓ Edge function deployed${NC}"
else
  echo -e "${RED}✗ Edge function deployment failed${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}Step 4: Verifying deployment...${NC}"
PROJECT_URL=$(grep 'SUPABASE_URL' .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' || echo "")

if [ -z "$PROJECT_URL" ]; then
  echo -e "${RED}Warning: Could not determine project URL from .env${NC}"
  echo "Please verify manually:"
  echo "  curl https://YOUR-PROJECT.supabase.co/functions/v1/wa-webhook-profile/health"
else
  HEALTH_URL="${PROJECT_URL}/functions/v1/wa-webhook-profile/health"
  echo "Checking: $HEALTH_URL"
  
  RESPONSE=$(curl -s "$HEALTH_URL" 2>/dev/null || echo '{"status":"error"}')
  
  if echo "$RESPONSE" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "$RESPONSE"
    exit 1
  fi
fi

echo ""
echo -e "${BLUE}Step 5: Running tests...${NC}"
if [ -f "supabase/functions/wa-webhook-profile/tests/profile_security.test.ts" ]; then
  if deno test supabase/functions/wa-webhook-profile/tests/profile_security.test.ts --allow-env --allow-net; then
    echo -e "${GREEN}✓ All tests passed${NC}"
  else
    echo -e "${RED}✗ Some tests failed (non-blocking)${NC}"
  fi
else
  echo "⚠️  Test file not found (skipping)"
fi

echo ""
echo "=============================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "New Features Available:"
echo "  • Profile editing (name & language)"
echo "  • Transfer security & rate limiting"
echo "  • Wallet credit/debit RPC functions"
echo "  • Enhanced fraud detection"
echo ""
echo "Manual Testing Checklist:"
echo "  □ Send 'profile' and verify edit button appears"
echo "  □ Test profile name update"
echo "  □ Test language change"
echo "  □ Test token transfer with amount validation"
echo "  □ Test cash-out flow"
echo ""
echo "See PROFILE_MICROSERVICE_GAPS_IMPLEMENTED.md for details"
