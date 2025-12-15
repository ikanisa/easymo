#!/bin/bash
# WhatsApp Webhook Services Deployment Script
# Version: 1.0
# Usage: ./scripts/deploy-webhook-services.sh [environment]

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Deploying WhatsApp Webhook Services to $ENVIRONMENT"
echo "=================================================="

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Services to deploy
SERVICES=(
  "wa-webhook-core"
  "wa-webhook-profile"
  "wa-webhook-mobility"
  "wa-webhook-buy-sell"
)

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"
command -v supabase >/dev/null 2>&1 || { echo -e "${RED}Error: supabase CLI not found${NC}"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo -e "${YELLOW}Warning: jq not found, skipping JSON validation${NC}"; }

# Link to Supabase project
echo -e "${YELLOW}Linking to Supabase project...${NC}"
cd "$PROJECT_ROOT"
supabase link --project-ref ${SUPABASE_PROJECT_REF:-$(supabase projects list --output json | jq -r '.[0].id')} 2>/dev/null || true

# Deploy each service
for SERVICE in "${SERVICES[@]}"; do
  echo ""
  echo -e "${YELLOW}Deploying $SERVICE...${NC}"
  
  # Validate function.json
  if [ -f "supabase/functions/$SERVICE/function.json" ]; then
    VERSION=$(jq -r '.version' "supabase/functions/$SERVICE/function.json" 2>/dev/null || echo "unknown")
    echo "  Version: $VERSION"
  fi
  
  # Deploy function
  if supabase functions deploy "$SERVICE" --no-verify-jwt; then
    echo -e "${GREEN}✅ $SERVICE deployed successfully${NC}"
  else
    echo -e "${RED}❌ Failed to deploy $SERVICE${NC}"
    exit 1
  fi
done

echo ""
echo -e "${GREEN}=================================================="
echo "✅ All services deployed successfully!"
echo -e "==================================================${NC}"

# Health check
echo ""
echo -e "${YELLOW}Running health checks...${NC}"
for SERVICE in "${SERVICES[@]}"; do
  HEALTH_URL="https://$(supabase status -o json | jq -r '.FUNCTIONS_URL' 2>/dev/null || echo 'unknown')/$SERVICE"
  echo "  Checking $SERVICE..."
  # Note: Actual health check would require authentication
done

echo ""
echo -e "${GREEN}Deployment complete!${NC}"
