#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Default options
DRY_RUN=false
SKIP_MIGRATIONS=false
SKIP_FUNCTIONS=false
SKIP_SERVICES=false
ENVIRONMENT="staging"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --skip-migrations)
      SKIP_MIGRATIONS=true
      shift
      ;;
    --skip-functions)
      SKIP_FUNCTIONS=true
      shift
      ;;
    --skip-services)
      SKIP_SERVICES=true
      shift
      ;;
    --env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  EasyMO Deployment - $ENVIRONMENT${NC}"
echo -e "${GREEN}========================================${NC}"

# Load environment
if [ -f "$ROOT_DIR/.env.$ENVIRONMENT" ]; then
  source "$ROOT_DIR/.env.$ENVIRONMENT"
fi

# Validate required variables
required_vars=(
  "SUPABASE_PROJECT_REF"
  "SUPABASE_ACCESS_TOKEN"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo -e "${RED}ERROR: $var is not set${NC}"
    exit 1
  fi
done

# Step 1: Build packages
echo -e "\n${YELLOW}Step 1: Building shared packages...${NC}"
if [ "$DRY_RUN" = false ]; then
  pnpm --filter @va/shared build
  pnpm --filter @easymo/commons build
  pnpm --filter @easymo/ui build
  pnpm --filter @easymo/messaging build
  echo -e "${GREEN}✓ Packages built${NC}"
else
  echo -e "${YELLOW}[DRY RUN] Would build packages${NC}"
fi

# Step 2: Run migrations
if [ "$SKIP_MIGRATIONS" = false ]; then
  echo -e "\n${YELLOW}Step 2: Running database migrations...${NC}"
  if [ "$DRY_RUN" = false ]; then
    "$SCRIPT_DIR/migrations.sh" --env "$ENVIRONMENT"
    echo -e "${GREEN}✓ Migrations applied${NC}"
  else
    echo -e "${YELLOW}[DRY RUN] Would run migrations${NC}"
  fi
else
  echo -e "${YELLOW}Skipping migrations...${NC}"
fi

# Step 3: Deploy edge functions
if [ "$SKIP_FUNCTIONS" = false ]; then
  echo -e "\n${YELLOW}Step 3: Deploying edge functions...${NC}"
  if [ "$DRY_RUN" = false ]; then
    "$SCRIPT_DIR/edge-functions.sh" --env "$ENVIRONMENT"
    echo -e "${GREEN}✓ Edge functions deployed${NC}"
  else
    echo -e "${YELLOW}[DRY RUN] Would deploy edge functions${NC}"
  fi
else
  echo -e "${YELLOW}Skipping edge functions...${NC}"
fi

# Step 4: Deploy services
if [ "$SKIP_SERVICES" = false ]; then
  echo -e "\n${YELLOW}Step 4: Deploying services...${NC}"
  if [ "$DRY_RUN" = false ]; then
    "$SCRIPT_DIR/services.sh" --env "$ENVIRONMENT"
    echo -e "${GREEN}✓ Services deployed${NC}"
  else
    echo -e "${YELLOW}[DRY RUN] Would deploy services${NC}"
  fi
else
  echo -e "${YELLOW}Skipping services...${NC}"
fi

# Step 5: Verify deployment
echo -e "\n${YELLOW}Step 5: Verifying deployment...${NC}"
if [ "$DRY_RUN" = false ]; then
  "$SCRIPT_DIR/../verify/all.sh" --env "$ENVIRONMENT"
  echo -e "${GREEN}✓ Deployment verified${NC}"
else
  echo -e "${YELLOW}[DRY RUN] Would verify deployment${NC}"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
