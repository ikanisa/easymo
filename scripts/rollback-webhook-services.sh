#!/bin/bash
# WhatsApp Webhook Services Rollback Script
# Version: 1.0
# Usage: ./scripts/rollback-webhook-services.sh <service-name> <version>

set -e

SERVICE_NAME=${1:-}
VERSION=${2:-}

if [ -z "$SERVICE_NAME" ]; then
  echo "Error: Service name required"
  echo "Usage: $0 <service-name> [version]"
  echo ""
  echo "Available services:"
  echo "  - wa-webhook-core"
  echo "  - wa-webhook-profile"
  echo "  - wa-webhook-mobility"
  echo "  - wa-webhook-insurance"
  echo "  - all (rollback all services)"
  exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔄 Rolling back $SERVICE_NAME${NC}"

# Function to rollback a single service
rollback_service() {
  local service=$1
  echo -e "${YELLOW}Rolling back $service...${NC}"
  
  # Check if previous version exists in git
  if git show HEAD~1:supabase/functions/$service/index.ts > /dev/null 2>&1; then
    # Restore previous version
    git checkout HEAD~1 -- "supabase/functions/$service/"
    
    # Deploy restored version
    cd "$PROJECT_ROOT"
    if supabase functions deploy "$service" --no-verify-jwt; then
      echo -e "${GREEN}✅ $service rolled back successfully${NC}"
      return 0
    else
      echo -e "${RED}❌ Failed to rollback $service${NC}"
      return 1
    fi
  else
    echo -e "${RED}❌ No previous version found for $service${NC}"
    return 1
  fi
}

# Execute rollback
if [ "$SERVICE_NAME" == "all" ]; then
  for service in wa-webhook-core wa-webhook-profile wa-webhook-mobility wa-webhook-insurance; do
    rollback_service "$service"
  done
else
  rollback_service "$SERVICE_NAME"
fi

echo -e "${GREEN}Rollback complete!${NC}"
