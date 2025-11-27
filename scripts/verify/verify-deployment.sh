#!/bin/bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:57322/postgres"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          AI Agent Ecosystem - Deployment Verification      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check 1: Agents Table
echo -e "${YELLOW}✓ Checking ai_agents table...${NC}"
AGENT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM ai_agents;" | xargs)
echo -e "${GREEN}  Found $AGENT_COUNT agents${NC}"

psql "$DATABASE_URL" -c "SELECT slug, name, is_active FROM ai_agents ORDER BY slug;"

echo ""

# Check 2: Apply Intent Functions
echo -e "${YELLOW}✓ Checking apply_intent functions...${NC}"
FUNCTION_COUNT=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) 
FROM information_schema.routines 
WHERE routine_name LIKE 'apply_intent_%' AND routine_type = 'FUNCTION';
" | xargs)

echo -e "${GREEN}  Found $FUNCTION_COUNT apply_intent functions${NC}"

psql "$DATABASE_URL" -c "
SELECT routine_name as function_name
FROM information_schema.routines
WHERE routine_name LIKE 'apply_intent_%' AND routine_type = 'FUNCTION'
ORDER BY routine_name;
"

echo ""

# Check 3: Supporting Tables
echo -e "${YELLOW}✓ Checking supporting tables...${NC}"
TABLES=(
  "whatsapp_users"
  "whatsapp_conversations"
  "whatsapp_messages"
  "ai_agent_intents"
  "ai_agent_personas"
  "ai_agent_system_instructions"
  "ai_agent_tools"
  "ai_agent_tasks"
  "ai_agent_knowledge_bases"
  "ai_agent_match_events"
)

for table in "${TABLES[@]}"; do
  if psql "$DATABASE_URL" -t -c "\dt $table" 2>/dev/null | grep -q "$table"; then
    echo -e "${GREEN}  ✓ $table${NC}"
  else
    echo -e "${RED}  ✗ $table${NC}"
  fi
done

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

if [ "$AGENT_COUNT" -eq 8 ] && [ "$FUNCTION_COUNT" -eq 8 ]; then
  echo -e "${GREEN}✅ DEPLOYMENT SUCCESSFUL!${NC}"
  echo ""
  echo "  Agents: $AGENT_COUNT/8"
  echo "  Functions: $FUNCTION_COUNT/8"
  echo ""
  echo -e "${YELLOW}Next Steps:${NC}"
  echo "  1. Deploy Supabase Edge Functions"
  echo "  2. Test WhatsApp webhook integration"
  echo "  3. Enable feature flag"
  echo "  4. Monitor logs"
else
  echo -e "${YELLOW}⚠ PARTIAL DEPLOYMENT${NC}"
  echo "  Agents: $AGENT_COUNT/8"
  echo "  Functions: $FUNCTION_COUNT/8"
fi

echo ""
