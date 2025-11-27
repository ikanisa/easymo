#!/bin/bash

echo "=================================================="
echo "AI AGENT ECOSYSTEM - DEPLOYMENT VERIFICATION"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Checking local migration files..."
echo ""

MIGRATION_COUNT=$(ls -1 supabase/migrations/202511220*.sql 2>/dev/null | wc -l | tr -d ' ')
echo "✓ Found $MIGRATION_COUNT AI agent migration files"

echo ""
echo "Key migrations:"
ls -1 supabase/migrations/202511220*.sql 2>/dev/null | xargs -n1 basename | head -15

echo ""
echo -e "${YELLOW}=================================================="
echo "MANUAL VERIFICATION REQUIRED"
echo "==================================================${NC}"
echo ""
echo "Please run these SQL queries in Supabase Dashboard:"
echo ""
echo -e "${GREEN}1. Check AI Agent Tables:${NC}"
echo "   SELECT tablename FROM pg_tables"
echo "   WHERE schemaname = 'public'"
echo "     AND (tablename LIKE 'ai_%' OR tablename LIKE 'whatsapp_%'"
echo "          OR tablename LIKE 'rides_%' OR tablename LIKE 'insurance_%')"
echo "   ORDER BY tablename;"
echo ""
echo -e "${GREEN}2. Check Agents Seeded:${NC}"
echo "   SELECT slug, name, is_active FROM ai_agents ORDER BY slug;"
echo ""
echo -e "${GREEN}3. Check Sample WhatsApp User:${NC}"
echo "   SELECT id, phone_number, user_roles FROM whatsapp_users LIMIT 5;"
echo ""
echo -e "${GREEN}4. Check Apply Intent Functions:${NC}"
echo "   SELECT routine_name FROM information_schema.routines"
echo "   WHERE routine_schema = 'public' AND routine_name LIKE 'apply_intent_%';"
echo ""
echo -e "${YELLOW}Expected Results:${NC}"
echo "- 14+ tables (ai_*, whatsapp_*, rides_*, insurance_*)"
echo "- 8 agents (waiter, farmer, business_broker, real_estate, jobs, sales_cold_caller, rides, insurance)"
echo "- 8 apply_intent_* functions"
echo ""
echo "If any are missing, check:"
echo "- Supabase Dashboard -> Database -> Migrations"
echo "- Function logs: supabase functions logs wa-webhook --tail"
echo ""
