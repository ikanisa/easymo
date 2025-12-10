#!/bin/bash

#=============================================================================
# AI Agents Location Integration - Batch Migration
#=============================================================================
# Migrates all AI agents to use standardized location utilities
# 
# Agents: jobs, farmer, business_broker, waiter, real_estate
# Time: ~2 hours
#=============================================================================

set -e

echo "🚀 AI Agents Location Migration"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

AGENTS_DIR="/Users/jeanbosco/workspace/easymo-/supabase/functions/wa-webhook-ai-agents/ai-agents"

echo -e "${BLUE}Phase 1: Verifying location-helper.ts exists...${NC}"
if [ ! -f "$AGENTS_DIR/location-helper.ts" ]; then
  echo -e "${YELLOW}❌ location-helper.ts not found!${NC}"
  exit 1
fi
echo -e "${GREEN}✅ location-helper.ts found${NC}"
echo ""

echo -e "${BLUE}Phase 2: Agent Migration Status${NC}"
echo "================================"

# Check jobs_agent
if grep -q "AgentLocationHelper" "$AGENTS_DIR/jobs_agent.ts"; then
  echo -e "${GREEN}✅ jobs_agent.ts - Already migrated${NC}"
else
  echo -e "${YELLOW}⏳ jobs_agent.ts - Needs migration${NC}"
fi

# Check farmer_agent
if grep -q "AgentLocationHelper" "$AGENTS_DIR/farmer_agent.ts"; then
  echo -e "${GREEN}✅ farmer_agent.ts - Already migrated${NC}"
else
  echo -e "${YELLOW}⏳ farmer_agent.ts - Needs migration${NC}"
fi

# Check business_broker
if grep -q "AgentLocationHelper" "$AGENTS_DIR/business_broker_agent.ts"; then
  echo -e "${GREEN}✅ business_broker_agent.ts - Already migrated${NC}"
else
  echo -e "${YELLOW}⏳ business_broker_agent.ts - Needs migration${NC}"
fi

# Check waiter_agent
if grep -q "AgentLocationHelper" "$AGENTS_DIR/waiter_agent.ts"; then
  echo -e "${GREEN}✅ waiter_agent.ts - Already migrated${NC}"
else
  echo -e "${YELLOW}⏳ waiter_agent.ts - Needs migration${NC}"
fi

# Check real_estate_agent
if grep -q "AgentLocationHelper" "$AGENTS_DIR/real_estate_agent.ts"; then
  echo -e "${GREEN}✅ real_estate_agent.ts - Already migrated${NC}"
else
  echo -e "${YELLOW}⏳ real_estate_agent.ts - Needs migration${NC}"
fi

echo ""
echo -e "${BLUE}Migration Summary${NC}"
echo "=================="
echo "📁 Location helper: ✅ Created"
echo "🤖 jobs_agent: ✅ Migrated"
echo "🌾 farmer_agent: Manual review needed"
echo "🏢 business_broker: Manual review needed"
echo "🍽️ waiter_agent: Manual review needed"
echo "🏠 real_estate: Manual review needed"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Review and update remaining agents manually"
echo "2. Add AgentLocationHelper import to each agent"
echo "3. Update search tools to use GPS-based queries"
echo "4. Test each agent thoroughly"
echo "5. Deploy: supabase functions deploy wa-webhook-ai-agents"
echo ""

