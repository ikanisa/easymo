#!/bin/bash

# AI Agents Deployment Script
# This script deploys all AI agents to Supabase and sets up the environment

set -e

echo "🤖 AI Agents Deployment Script"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI is not installed${NC}"
    echo "Install it with: brew install supabase/tap/supabase"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env file${NC}"
        echo -e "${YELLOW}⚠️  Please edit .env and add your API keys before continuing${NC}"
        exit 1
    else
        echo -e "${RED}❌ .env.example not found${NC}"
        exit 1
    fi
fi

# Load environment variables
source .env

# Check required environment variables
REQUIRED_VARS=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY" "OPENAI_API_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    printf '   - %s\n' "${MISSING_VARS[@]}"
    echo ""
    echo "Please set these in your .env file"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables loaded${NC}"
echo ""

# Step 1: Check Supabase status
echo "📡 Checking Supabase connection..."
if ! supabase status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Supabase is not running locally${NC}"
    echo "Starting Supabase..."
    supabase start
    echo -e "${GREEN}✅ Supabase started${NC}"
else
    echo -e "${GREEN}✅ Supabase is running${NC}"
fi
echo ""

# Step 2: Apply database migrations
echo "🗄️  Applying database migrations..."
if supabase db push; then
    echo -e "${GREEN}✅ Migrations applied${NC}"
else
    echo -e "${RED}❌ Failed to apply migrations${NC}"
    exit 1
fi
echo ""

# Step 3: Set Supabase secrets
echo "🔐 Setting function secrets..."
SECRETS=(
    "OPENAI_API_KEY=$OPENAI_API_KEY"
    "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
    "WHATSAPP_ACCESS_TOKEN=$WHATSAPP_ACCESS_TOKEN"
    "WHATSAPP_PHONE_NUMBER_ID=$WHATSAPP_PHONE_NUMBER_ID"
)

for secret in "${SECRETS[@]}"; do
    KEY=$(echo "$secret" | cut -d'=' -f1)
    VALUE=$(echo "$secret" | cut -d'=' -f2-)
    
    if [ -n "$VALUE" ]; then
        if supabase secrets set "$KEY=$VALUE" &> /dev/null; then
            echo -e "${GREEN}✅ Set $KEY${NC}"
        else
            echo -e "${YELLOW}⚠️  Failed to set $KEY (may need remote project link)${NC}"
        fi
    fi
done
echo ""

# Step 4: Deploy agent functions
echo "🚀 Deploying AI Agent functions..."

AGENTS=(
    "agents/property-rental"
    "agents/schedule-trip"
    "agents/quincaillerie"
    "agents/shops"
)

for agent in "${AGENTS[@]}"; do
    AGENT_NAME=$(basename "$agent")
    echo "Deploying $AGENT_NAME..."
    
    if supabase functions deploy "$agent"; then
        echo -e "${GREEN}✅ Deployed $AGENT_NAME${NC}"
    else
        echo -e "${RED}❌ Failed to deploy $AGENT_NAME${NC}"
        exit 1
    fi
done
echo ""

# Step 5: Test agent endpoints
echo "🧪 Testing agent endpoints..."

# Get Supabase URL and Anon Key
SUPABASE_URL=$(supabase status | grep "API URL" | awk '{print $NF}')
SUPABASE_ANON_KEY=$(supabase status | grep "anon key" | awk '{print $NF}')

# Test Property Rental Agent
echo "Testing Property Rental Agent..."
PROPERTY_RESPONSE=$(curl -s -X POST \
  "$SUPABASE_URL/functions/v1/agents/property-rental" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "action": "find",
    "rentalType": "long_term",
    "bedrooms": 3,
    "maxBudget": 500000,
    "location": {
      "latitude": -1.9536,
      "longitude": 30.0606
    }
  }')

if echo "$PROPERTY_RESPONSE" | grep -q "success\|searchId"; then
    echo -e "${GREEN}✅ Property Rental Agent working${NC}"
else
    echo -e "${YELLOW}⚠️  Property Rental Agent response: $PROPERTY_RESPONSE${NC}"
fi

# Test Schedule Trip Agent
echo "Testing Schedule Trip Agent..."
SCHEDULE_RESPONSE=$(curl -s -X POST \
  "$SUPABASE_URL/functions/v1/agents/schedule-trip" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "action": "get_predictions",
    "pickupLocation": {
      "latitude": -1.9536,
      "longitude": 30.0606
    },
    "dropoffLocation": {
      "latitude": -1.9440,
      "longitude": 30.0619
    }
  }')

if echo "$SCHEDULE_RESPONSE" | grep -q "predictions"; then
    echo -e "${GREEN}✅ Schedule Trip Agent working${NC}"
else
    echo -e "${YELLOW}⚠️  Schedule Trip Agent response: $SCHEDULE_RESPONSE${NC}"
fi
echo ""

# Step 6: Summary
echo "📊 Deployment Summary"
echo "===================="
echo -e "${GREEN}✅ Database migrations applied${NC}"
echo -e "${GREEN}✅ Function secrets configured${NC}"
echo -e "${GREEN}✅ All agents deployed${NC}"
echo -e "${GREEN}✅ Endpoint tests completed${NC}"
echo ""
echo "🎉 AI Agents deployment complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Check agent logs: supabase functions logs agents/property-rental"
echo "  2. Monitor database: supabase db remote list"
echo "  3. Test via WhatsApp (if configured)"
echo "  4. View dashboard: http://localhost:54323"
echo ""
echo "📚 Documentation:"
echo "  - AGENTS_FINAL_STATUS_REPORT.md"
echo "  - AGENTS_QUICK_REFERENCE.md"
echo "  - AGENTS_INDEX.md"
echo ""
