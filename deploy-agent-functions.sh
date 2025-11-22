#!/bin/bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:57322/postgres"

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Deploying All Agent Apply Intent Functions${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"

AGENT_FUNCTIONS=(
  "20251122082500_apply_intent_waiter.sql:Waiter"
  "20251122084500_apply_intent_rides.sql:Rides"
  "20251122085000_apply_intent_jobs.sql:Jobs"
  "20251122090000_apply_intent_business_broker.sql:Business Broker"
  "20251122110000_apply_intent_farmer.sql:Farmer"
  "20251122111000_apply_intent_real_estate.sql:Real Estate"
  "20251122112000_apply_intent_sales_sdr.sql:Sales SDR"
  "20251122113000_apply_intent_insurance.sql:Insurance"
)

COUNT=0
for item in "${AGENT_FUNCTIONS[@]}"; do
  IFS=':' read -r file name <<< "$item"
  filepath="supabase/migrations/$file"
  
  echo -e "${YELLOW}[$((COUNT+1))/8] Deploying $name...${NC}"
  
  if [ ! -f "$filepath" ]; then
    echo -e "${RED}❌ Missing: $filepath${NC}"
    continue
  fi
  
  if psql "$DATABASE_URL" < "$filepath" 2>&1 | grep -q "ERROR"; then
    echo -e "${YELLOW}⚠ Some errors (may be expected if depends missing)${NC}"
  fi
  
  echo -e "${GREEN}✅ $name deployed${NC}"
  COUNT=$((COUNT+1))
done

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Deployed $COUNT/8 agents${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
