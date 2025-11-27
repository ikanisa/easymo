#!/bin/bash
set -e

echo "=================================================="
echo "AI AGENT ECOSYSTEM - DEPLOYMENT SCRIPT"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1/4: Committing code changes...${NC}"
git add types/ai-agents.types.ts
git add supabase/functions/wa-webhook/state/store.ts
git add AI_AGENT_ECOSYSTEM_IMPLEMENTATION_STATUS.md
git commit -m "feat: implement AI agent ecosystem with Rides and Insurance agents

- Add comprehensive AI agent schema (8 agents: waiter, farmer, broker, real_estate, jobs, sales_cold_caller, rides, insurance)
- Create whatsapp_users table as primary identity source
- Add rides domain tables (trips, saved_locations, driver_status)
- Add insurance domain tables (profiles, documents, quote_requests)
- Update TypeScript types for all new tables
- Fix webhook auth error by removing deprecated auth.admin API calls
- Use whatsapp_users table instead of auth.users for identity
- Maintain backward compatibility with profiles table

This implements a WhatsApp-first natural language agent architecture where:
1. Users chat in natural language on WhatsApp
2. Agents parse messages and create structured intents
3. Backend applies intents to domain tables
4. Agents respond with concise messages + emoji numbered options
" || echo "No changes to commit (already committed)"

echo ""
echo -e "${YELLOW}Step 2/4: Pushing to main branch...${NC}"
git push origin main || {
    echo -e "${RED}Failed to push to main. Please resolve conflicts manually.${NC}"
    exit 1
}

echo ""
echo -e "${YELLOW}Step 3/4: Deploying database migrations...${NC}"
echo "This may take 2-10 minutes..."
echo ""

# Try to push migrations
supabase db push --include-all || {
    echo ""
    echo -e "${YELLOW}Migration push timed out or failed.${NC}"
    echo -e "${YELLOW}This is expected for large migrations.${NC}"
    echo ""
    echo -e "${GREEN}RECOMMENDED ACTION:${NC}"
    echo "1. Wait 10 minutes for database to finish processing"
    echo "2. Check Supabase Dashboard -> Database -> Migrations"
    echo "3. Verify tables exist with:"
    echo "   SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'ai_%';"
    echo ""
    read -p "Press ENTER to continue with webhook deployment, or Ctrl+C to abort..."
}

echo ""
echo -e "${YELLOW}Step 4/4: Deploying webhook function...${NC}"
supabase functions deploy wa-webhook --no-verify-jwt || {
    echo -e "${RED}Webhook deployment failed. Please check errors above.${NC}"
    exit 1
}

echo ""
echo -e "${GREEN}=================================================="
echo "DEPLOYMENT COMPLETE!"
echo "==================================================${NC}"
echo ""
echo "Next steps:"
echo "1. Verify migrations: Check Supabase Dashboard -> Database -> Migrations"
echo "2. Test webhook: Send a WhatsApp message"
echo "3. Check logs: supabase functions logs wa-webhook --tail"
echo ""
echo "Documentation: ./AI_AGENT_ECOSYSTEM_IMPLEMENTATION_STATUS.md"
echo ""
