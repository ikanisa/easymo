#!/bin/bash
set -euo pipefail

# =============================================================================
# Deploy Dual LLM Provider Infrastructure
# 
# This script safely deploys the OpenAI + Gemini dual-provider system
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Deploying Dual LLM Provider Infrastructure (OpenAI + Gemini)${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""

# =============================================================================
# Step 1: Pre-flight Checks
# =============================================================================

echo -e "${YELLOW}Step 1: Pre-flight checks...${NC}"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}ERROR: Supabase CLI not found. Install: npm install -g supabase${NC}"
    exit 1
fi

# Check if database is accessible
if ! supabase db ping &> /dev/null; then
    echo -e "${RED}ERROR: Cannot connect to database. Check your connection.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI installed${NC}"
echo -e "${GREEN}✓ Database accessible${NC}"
echo ""

# =============================================================================
# Step 2: Check Environment Variables
# =============================================================================

echo -e "${YELLOW}Step 2: Checking environment variables...${NC}"

REQUIRED_VARS=("OPENAI_API_KEY" "GEMINI_API_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}ERROR: Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo -e "${RED}  - $var${NC}"
    done
    echo ""
    echo "Set them with:"
    echo "  supabase secrets set OPENAI_API_KEY=sk-..."
    echo "  supabase secrets set GEMINI_API_KEY=AIza..."
    exit 1
fi

echo -e "${GREEN}✓ OPENAI_API_KEY set${NC}"
echo -e "${GREEN}✓ GEMINI_API_KEY set${NC}"
echo ""

# =============================================================================
# Step 3: Database Migration
# =============================================================================

echo -e "${YELLOW}Step 3: Applying database migration...${NC}"

# Check if migration already applied
MIGRATION_FILE="20251120120000_dual_llm_provider_infrastructure.sql"
if supabase db diff --schema public | grep -q "llm_requests"; then
    echo -e "${YELLOW}⚠ Migration appears already applied. Skipping...${NC}"
else
    supabase db push
    echo -e "${GREEN}✓ Database migration applied${NC}"
fi
echo ""

# =============================================================================
# Step 4: Verify Database Schema
# =============================================================================

echo -e "${YELLOW}Step 4: Verifying database schema...${NC}"

EXPECTED_TABLES=(
    "llm_requests"
    "llm_failover_events"
    "tool_provider_routing"
)

for table in "${EXPECTED_TABLES[@]}"; do
    if psql "$DATABASE_URL" -c "\dt $table" 2>/dev/null | grep -q "$table"; then
        echo -e "${GREEN}✓ Table exists: $table${NC}"
    else
        echo -e "${RED}✗ Table missing: $table${NC}"
        exit 1
    fi
done
echo ""

# =============================================================================
# Step 5: Deploy Edge Functions
# =============================================================================

echo -e "${YELLOW}Step 5: Deploying edge functions...${NC}"

FUNCTIONS=(
    "agent-tools-general-broker"
)

for func in "${FUNCTIONS[@]}"; do
    echo "  Deploying $func..."
    if supabase functions deploy "$func" --no-verify-jwt; then
        echo -e "${GREEN}  ✓ Deployed $func${NC}"
    else
        echo -e "${RED}  ✗ Failed to deploy $func${NC}"
        exit 1
    fi
done
echo ""

# =============================================================================
# Step 6: Verify Deployment
# =============================================================================

echo -e "${YELLOW}Step 6: Verifying deployment...${NC}"

# Test General Broker tools endpoint
echo "  Testing General Broker tools..."
BROKER_URL="$(supabase functions list | grep agent-tools-general-broker | awk '{print $2}')"

if [ -n "$BROKER_URL" ]; then
    echo -e "${GREEN}  ✓ General Broker endpoint active${NC}"
else
    echo -e "${RED}  ✗ General Broker endpoint not found${NC}"
    exit 1
fi
echo ""

# =============================================================================
# Step 7: Seed Tool Routing Data
# =============================================================================

echo -e "${YELLOW}Step 7: Checking tool routing data...${NC}"

TOOL_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM tool_provider_routing;" 2>/dev/null | tr -d ' ')

if [ "$TOOL_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Tool routing configured ($TOOL_COUNT tools)${NC}"
else
    echo -e "${YELLOW}⚠ No tool routing data found. Migration may need re-run.${NC}"
fi
echo ""

# =============================================================================
# Step 8: Health Check
# =============================================================================

echo -e "${YELLOW}Step 8: Running health checks...${NC}"

# Check OpenAI connectivity
echo "  Testing OpenAI provider..."
if curl -s -X POST https://api.openai.com/v1/chat/completions \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}],"max_tokens":1}' \
    | grep -q "choices"; then
    echo -e "${GREEN}  ✓ OpenAI provider healthy${NC}"
else
    echo -e "${RED}  ✗ OpenAI provider unhealthy${NC}"
    exit 1
fi

# Check Gemini connectivity
echo "  Testing Gemini provider..."
if curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"contents":[{"parts":[{"text":"test"}]}]}' \
    | grep -q "candidates"; then
    echo -e "${GREEN}  ✓ Gemini provider healthy${NC}"
else
    echo -e "${RED}  ✗ Gemini provider unhealthy${NC}"
    exit 1
fi
echo ""

# =============================================================================
# Deployment Complete
# =============================================================================

echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}✓ Dual LLM Provider Infrastructure Deployed Successfully!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Review implementation guide: DUAL_LLM_IMPLEMENTATION_GUIDE.md"
echo "  2. Monitor LLM requests: SELECT * FROM llm_performance_metrics;"
echo "  3. Check failover events: SELECT * FROM llm_failover_events ORDER BY created_at DESC;"
echo "  4. Test General Broker with: curl $BROKER_URL/health"
echo ""
echo "Documentation:"
echo "  - Implementation Guide: ./DUAL_LLM_IMPLEMENTATION_GUIDE.md"
echo "  - Ground Rules: ./docs/GROUND_RULES.md"
echo ""
echo -e "${YELLOW}NOTE: All agents still use OpenAI by default. Update agent_configurations${NC}"
echo -e "${YELLOW}      to enable Gemini for specific agents or tools.${NC}"
echo ""
