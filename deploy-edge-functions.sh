#!/bin/bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Deploying Supabase Edge Functions                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI found${NC}"
echo ""

# Key functions to deploy
FUNCTIONS=(
  "wa-webhook-ai-agents:WhatsApp AI Agents Webhook"
  "wa-webhook-core:WhatsApp Core Webhook"
  "_shared:Shared utilities"
)

echo -e "${YELLOW}Functions to deploy:${NC}"
for item in "${FUNCTIONS[@]}"; do
  IFS=':' read -r func name <<< "$item"
  echo "  - $name ($func)"
done

echo ""
echo -e "${YELLOW}Deploy to which environment?${NC}"
echo "  1) Local (for testing)"
echo "  2) Remote (production)"
echo ""
read -p "Choice (1 or 2): " choice

case $choice in
  1)
    TARGET="--local"
    ENV="Local"
    ;;
  2)
    TARGET=""
    ENV="Remote/Production"
    echo -e "${RED}⚠ WARNING: Deploying to PRODUCTION${NC}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
      echo "Cancelled"
      exit 0
    fi
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Deploying to: $ENV${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Deploy wa-webhook-ai-agents (main agent router)
echo -e "${YELLOW}[1/2] Deploying wa-webhook-ai-agents...${NC}"
if supabase functions deploy wa-webhook-ai-agents $TARGET --no-verify-jwt 2>&1; then
  echo -e "${GREEN}✅ wa-webhook-ai-agents deployed${NC}"
else
  echo -e "${RED}❌ Failed to deploy wa-webhook-ai-agents${NC}"
fi

echo ""

# Deploy wa-webhook-core (fallback/legacy)
echo -e "${YELLOW}[2/2] Deploying wa-webhook-core...${NC}"
if supabase functions deploy wa-webhook-core $TARGET --no-verify-jwt 2>&1; then
  echo -e "${GREEN}✅ wa-webhook-core deployed${NC}"
else
  echo -e "${RED}❌ Failed to deploy wa-webhook-core${NC}"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Edge Functions Deployment Complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$ENV" = "Local" ]; then
  echo "Test endpoint:"
  echo "  http://127.0.0.1:56311/functions/v1/wa-webhook-ai-agents"
else
  echo "Production endpoint:"
  echo "  https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-ai-agents"
fi

echo ""
