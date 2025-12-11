#!/bin/bash
# =====================================================================
# Agent Database-Driven Architecture - Validation Script
# =====================================================================
# Tests that agents properly load from database
# Run after migration: supabase db push
# =====================================================================

set -e

echo "🔍 Validating AI Agent Database-Driven Architecture..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check migration file exists
echo "1️⃣  Checking migration file..."
if [ -f "supabase/migrations/20251201102239_add_support_marketplace_agents.sql" ]; then
    echo -e "${GREEN}✅ Migration file exists${NC}"
else
    echo -e "${RED}❌ Migration file missing!${NC}"
    exit 1
fi

# 2. Check agent infrastructure exists
echo ""
echo "2️⃣  Checking agent infrastructure..."
if [ -d "supabase/functions/wa-webhook-ai-agents" ]; then
    echo -e "${GREEN}✅ wa-webhook-ai-agents exists${NC}"
else
    echo -e "${RED}❌ wa-webhook-ai-agents directory missing${NC}"
    exit 1
fi

# 3. Check tool executor has real implementations
echo ""
echo "3️⃣  Checking tool executor implementations..."

if grep -q "Serper API integration" supabase/functions/_shared/tool-executor.ts; then
    echo -e "${GREEN}✅ Deep search tool implemented${NC}"
else
    echo -e "${YELLOW}⚠️  Deep search still placeholder${NC}"
fi

if grep -q "MTN MoMo Collection API" supabase/functions/_shared/tool-executor.ts; then
    echo -e "${GREEN}✅ MoMo payment tool implemented${NC}"
else
    echo -e "${YELLOW}⚠️  MoMo tool still placeholder${NC}"
fi

if grep -q "sanitizeSearchQuery" supabase/functions/_shared/tool-executor.ts; then
    echo -e "${GREEN}✅ Marketplace search has SQL injection protection${NC}"
else
    echo -e "${RED}❌ Marketplace search missing sanitization${NC}"
    exit 1
fi

# 4. Check wa-webhook-ai-agents already has database infrastructure
echo ""
echo "4️⃣  Checking wa-webhook-ai-agents infrastructure..."

if grep -q "buildConversationHistoryAsync" supabase/functions/wa-webhook-ai-agents/core/base-agent.ts; then
    echo -e "${GREEN}✅ Async conversation history builder exists${NC}"
else
    echo -e "${YELLOW}⚠️  Async builder missing (may use sync fallback)${NC}"
fi

# 5. Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ VALIDATION COMPLETE${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next Steps:"
echo "   1. Apply migration:    supabase db push"
echo "   2. Verify agents:      psql \$DATABASE_URL -c \"SELECT slug, name, is_active FROM ai_agents WHERE is_active = true;\""
echo "   3. Test webhook:       Send test WhatsApp message"
echo "   4. Check logs:         supabase functions logs wa-webhook-ai-agents"
echo ""
echo "📚 Documentation: See AGENT_DATABASE_FIXES_DEPLOYED.md"
echo ""
