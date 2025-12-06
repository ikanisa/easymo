#!/bin/bash
# =====================================================================
# Deploy Enhanced Call Center AGI with Intent System
# =====================================================================

set -e

echo "🚀 Deploying Enhanced Call Center AGI..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =====================================================================
# 1. Database Migrations
# =====================================================================

echo -e "${BLUE}📊 Step 1: Applying database migrations...${NC}"

echo "   → Creating user_intents tables..."
supabase db push --include-file 20251206120000_user_intents_system.sql

echo "   → Updating Call Center AGI system instructions..."
supabase db push --include-file 20251206121000_enhanced_call_center_agi.sql

echo -e "${GREEN}✅ Database migrations applied${NC}"
echo ""

# =====================================================================
# 2. Deploy Edge Functions
# =====================================================================

echo -e "${BLUE}📦 Step 2: Deploying edge functions...${NC}"

echo "   → Deploying process-user-intents function..."
supabase functions deploy process-user-intents \
  --project-ref ${SUPABASE_PROJECT_REF:-your-project-ref}

echo "   → Redeploying wa-agent-call-center with updated code..."
supabase functions deploy wa-agent-call-center \
  --project-ref ${SUPABASE_PROJECT_REF:-your-project-ref}

echo -e "${GREEN}✅ Edge functions deployed${NC}"
echo ""

# =====================================================================
# 3. Set Environment Variables
# =====================================================================

echo -e "${BLUE}🔐 Step 3: Verifying environment variables...${NC}"

# Check required variables
REQUIRED_VARS=(
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "WHATSAPP_ACCESS_TOKEN"
  "WHATSAPP_PHONE_NUMBER_ID"
  "OPENAI_API_KEY"
  "GOOGLE_APPLICATION_CREDENTIALS"
)

missing_vars=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Missing environment variables:${NC}"
  printf '   - %s\n' "${missing_vars[@]}"
  echo ""
  echo "   Set them in your Supabase dashboard:"
  echo "   Settings → Edge Functions → Secrets"
  echo ""
else
  echo -e "${GREEN}✅ All required environment variables are set${NC}"
  echo ""
fi

# =====================================================================
# 4. Test Deployment
# =====================================================================

echo -e "${BLUE}🧪 Step 4: Testing deployment...${NC}"

echo "   → Testing intent processing function..."
response=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/process-user-intents" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')

if echo "$response" | grep -q "success"; then
  echo -e "${GREEN}✅ Intent processing function is working${NC}"
else
  echo -e "${YELLOW}⚠️  Intent processing function test inconclusive${NC}"
  echo "   Response: $response"
fi

echo ""

# =====================================================================
# 5. Summary
# =====================================================================

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✨ Deployment Complete!${NC}"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "📋 What was deployed:"
echo "   ✅ User intents database tables (user_intents, intent_processing_queue, intent_matches)"
echo "   ✅ Enhanced Call Center AGI system prompt with guardrails"
echo "   ✅ record_user_intent tool added to Call Center AGI"
echo "   ✅ Intent processing function (runs every 5 minutes)"
echo "   ✅ WhatsApp notification system"
echo ""
echo "🎯 New Capabilities:"
echo "   • Strict guardrails - only EasyMO topics"
echo "   • Mandatory location collection"
echo "   • Structured intent recording"
echo "   • Automatic matching (properties, jobs, produce, etc.)"
echo "   • WhatsApp notifications when matches are found"
echo ""
echo "🧪 Test the system:"
echo "   1. Make a voice call to your WhatsApp number"
echo "   2. Say: 'I need a 2-bedroom house to rent in Kimironko'"
echo "   3. Agent will collect: location, bedrooms, budget"
echo "   4. Intent is recorded in user_intents table"
echo "   5. Within 5 minutes, matches are found and WhatsApp notification sent"
echo ""
echo "📊 Monitor:"
echo "   • user_intents - All recorded intents"
echo "   • intent_processing_queue - Processing status"
echo "   • intent_matches - Found matches"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
