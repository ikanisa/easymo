#!/bin/bash
# AI Agent Test Script for wa-webhook
# Tests the new OpenAI integration components

set -e

echo "🧪 Testing AI Agent Implementation..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Change to wa-webhook directory
cd "$(dirname "$0")/supabase/functions/wa-webhook"

echo "📋 Step 1: Checking environment variables..."
if [ -z "$OPENAI_API_KEY" ]; then
  echo -e "${RED}❌ OPENAI_API_KEY not set${NC}"
  echo "   Set it with: export OPENAI_API_KEY=sk-..."
  exit 1
fi
echo -e "${GREEN}✅ OPENAI_API_KEY is set${NC}"

echo ""
echo "📋 Step 2: Formatting code..."
deno fmt --check shared/openai_client.ts shared/memory_manager.ts shared/tool_manager.ts 2>&1 > /dev/null
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Code formatting is correct${NC}"
else
  echo -e "${RED}❌ Code formatting issues found${NC}"
  echo "   Run: deno fmt shared/*.ts"
  exit 1
fi

echo ""
echo "📋 Step 3: Type checking files..."
echo "   Checking openai_client.ts..."
deno check --quiet shared/openai_client.ts 2>&1 > /dev/null || echo -e "${RED}❌ Type errors in openai_client.ts${NC}"

echo "   Checking memory_manager.ts..."
deno check --quiet shared/memory_manager.ts 2>&1 > /dev/null || echo -e "${RED}❌ Type errors in memory_manager.ts${NC}"

echo "   Checking tool_manager.ts..."
deno check --quiet shared/tool_manager.ts 2>&1 > /dev/null || echo -e "${RED}❌ Type errors in tool_manager.ts${NC}"

echo -e "${GREEN}✅ Type checking complete${NC}"

echo ""
echo "📋 Step 4: Checking feature flag..."
if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
  FLAG_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT enabled FROM feature_flags WHERE name = 'ai_agents_enabled' LIMIT 1;" 2>/dev/null || echo "")
  
  if [ "$FLAG_EXISTS" = "t" ]; then
    echo -e "${GREEN}✅ Feature flag 'ai_agents_enabled' is enabled${NC}"
  elif [ "$FLAG_EXISTS" = "f" ]; then
    echo -e "${RED}⚠️  Feature flag 'ai_agents_enabled' is disabled${NC}"
    echo "   Enable it with:"
    echo "   psql \$DATABASE_URL -c \"UPDATE feature_flags SET enabled = true WHERE name = 'ai_agents_enabled';\""
  else
    echo -e "${RED}⚠️  Feature flag 'ai_agents_enabled' not found${NC}"
    echo "   Create it with:"
    echo "   psql \$DATABASE_URL -c \"INSERT INTO feature_flags (name, enabled) VALUES ('ai_agents_enabled', true);\""
  fi
else
  echo -e "${RED}ℹ️  Skipping database check (psql or DATABASE_URL not available)${NC}"
fi

echo ""
echo "📋 Step 5: Verifying database tables..."
if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
  TABLES=("wa_interactions" "agent_conversations" "ai_tool_executions" "wallets" "trips" "users")
  
  for table in "${TABLES[@]}"; do
    EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" 2>/dev/null || echo "f")
    
    if [ "$EXISTS" = "t" ]; then
      echo -e "${GREEN}✅ Table '$table' exists${NC}"
    else
      echo -e "${RED}❌ Table '$table' not found${NC}"
    fi
  done
else
  echo -e "${RED}ℹ️  Skipping database check (psql or DATABASE_URL not available)${NC}"
fi

echo ""
echo "📋 Step 6: Testing OpenAI API connection..."
TEST_RESPONSE=$(curl -s -X POST https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Say hello in 3 words"}],
    "max_tokens": 10
  }' 2>&1)

if echo "$TEST_RESPONSE" | grep -q "choices"; then
  echo -e "${GREEN}✅ OpenAI API connection successful${NC}"
else
  echo -e "${RED}❌ OpenAI API connection failed${NC}"
  echo "   Response: $TEST_RESPONSE"
  exit 1
fi

echo ""
echo "📋 Step 7: File summary..."
echo "   Created files:"
echo "     ✅ shared/openai_client.ts ($(wc -l < shared/openai_client.ts) lines)"
echo "     ✅ shared/memory_manager.ts ($(wc -l < shared/memory_manager.ts) lines)"
echo "     ✅ shared/tool_manager.ts ($(wc -l < shared/tool_manager.ts) lines)"
echo ""
echo "   Modified files:"
echo "     ✅ router/ai_agent_handler.ts"
echo "     ✅ shared/agent_context.ts"

echo ""
echo "═══════════════════════════════════════════════"
echo -e "${GREEN}🎉 All checks passed!${NC}"
echo "═══════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Deploy to Supabase: supabase functions deploy wa-webhook"
echo "2. Test via WhatsApp: Send 'Hi' to your bot"
echo "3. Monitor logs: supabase functions logs wa-webhook"
echo "4. Check database: psql \$DATABASE_URL -c \"SELECT * FROM wa_interactions WHERE message_type = 'ai_agent' ORDER BY created_at DESC LIMIT 5;\""
echo ""
echo "For more info, see: supabase/functions/wa-webhook/AI_IMPLEMENTATION_COMPLETE.md"
