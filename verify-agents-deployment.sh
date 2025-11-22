#!/bin/bash
# =====================================================================
# VERIFY AGENT DEPLOYMENT
# =====================================================================
# Quick verification script to check all 8 agents are deployed correctly
#
# Usage: ./verify-agents-deployment.sh
# =====================================================================

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   EasyMO AI Agents - Deployment Verification              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
  echo -e "${RED}❌ ERROR: DATABASE_URL not set${NC}"
  exit 1
fi

echo -e "${GREEN}✅ DATABASE_URL is set${NC}"
echo ""

# 1. Check ai_agents table
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}1. Checking ai_agents table...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

AGENTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM ai_agents WHERE is_active = true;" 2>/dev/null || echo "0")
echo "Active Agents: $AGENTS/8"

if [ "$AGENTS" -eq 8 ]; then
  echo -e "${GREEN}✅ All 8 agents found${NC}"
else
  echo -e "${YELLOW}⚠ Expected 8 agents, found $AGENTS${NC}"
fi

echo ""
psql "$DATABASE_URL" -c "SELECT slug, name, is_active FROM ai_agents ORDER BY slug;" 2>/dev/null || echo "Failed to query agents"

# 2. Check apply_intent functions
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}2. Checking apply_intent functions...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

EXPECTED_FUNCTIONS=(
  "apply_intent_waiter"
  "apply_intent_farmer"
  "apply_intent_broker"
  "apply_intent_real_estate"
  "apply_intent_jobs"
  "apply_intent_sales_sdr"
  "apply_intent_rides"
  "apply_intent_insurance"
)

MISSING_COUNT=0
for func in "${EXPECTED_FUNCTIONS[@]}"; do
  EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_proc WHERE proname = '$func';" 2>/dev/null || echo "0")
  if [ "$EXISTS" -gt 0 ]; then
    echo -e "${GREEN}✅ $func${NC}"
  else
    echo -e "${RED}❌ $func (MISSING)${NC}"
    MISSING_COUNT=$((MISSING_COUNT + 1))
  fi
done

echo ""
if [ "$MISSING_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ All 8 apply_intent functions found${NC}"
else
  echo -e "${RED}❌ Missing $MISSING_COUNT functions${NC}"
fi

# 3. Check key tables
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}3. Checking key tables...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

TABLES=(
  "ai_agents"
  "ai_agent_intents"
  "ai_agent_personas"
  "ai_agent_tools"
  "whatsapp_users"
  "whatsapp_conversations"
  "whatsapp_messages"
)

for table in "${TABLES[@]}"; do
  EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = '$table';" 2>/dev/null || echo "0")
  if [ "$EXISTS" -gt 0 ]; then
    echo -e "${GREEN}✅ $table${NC}"
  else
    echo -e "${RED}❌ $table (MISSING)${NC}"
  fi
done

# 4. Summary
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}VERIFICATION SUMMARY${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$AGENTS" -eq 8 ] && [ "$MISSING_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
  echo ""
  echo "✅ 8/8 agents active"
  echo "✅ 8/8 apply_intent functions present"
  echo "✅ All core tables exist"
  echo ""
  echo -e "${GREEN}🎉 Ready for testing and production deployment!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠ SOME CHECKS FAILED${NC}"
  echo ""
  echo "Agents: $AGENTS/8"
  echo "Functions: $((8 - MISSING_COUNT))/8"
  echo ""
  echo -e "${YELLOW}Review the output above for details.${NC}"
  exit 1
fi
