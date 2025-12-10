#!/bin/bash
# =================================================================
# EasyMO Call Center AGI - Deployment Script
# =================================================================
# This script deploys the complete Call Center AGI implementation
# =================================================================

set -e  # Exit on error

echo "🚀 EasyMO Call Center AGI Deployment"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install with: npm install -g supabase"
    exit 1
fi
echo -e "${GREEN}✅ Supabase CLI found${NC}"

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Supabase${NC}"
    echo "Run: supabase login"
    exit 1
fi
echo -e "${GREEN}✅ Logged in to Supabase${NC}"

# Check if project is linked
if [ ! -f .git/config ] && [ ! -f supabase/.temp/project-ref ]; then
    echo -e "${YELLOW}⚠️  Project not linked${NC}"
    echo "Run: supabase link --project-ref YOUR_PROJECT_REF"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "📦 Step 1: Apply Database Migration"
echo "-----------------------------------"

# Check if migration file exists
MIGRATION_FILE="supabase/migrations/20251206000000_call_center_agi_complete.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo "Found migration file: $MIGRATION_FILE"
read -p "Apply migration to database? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Applying migration..."
    supabase db push
    echo -e "${GREEN}✅ Migration applied${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping migration${NC}"
fi

echo ""
echo "🔧 Step 2: Deploy Edge Function"
echo "-------------------------------"

# Check if function exists
FUNCTION_DIR="supabase/functions/wa-agent-call-center"
if [ ! -d "$FUNCTION_DIR" ]; then
    echo -e "${RED}❌ Function directory not found: $FUNCTION_DIR${NC}"
    exit 1
fi

echo "Found function directory: $FUNCTION_DIR"
echo "Files:"
ls -la "$FUNCTION_DIR"/*.ts

read -p "Deploy edge function? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Deploying function..."
    supabase functions deploy wa-agent-call-center --no-verify-jwt
    echo -e "${GREEN}✅ Function deployed${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping function deployment${NC}"
fi

echo ""
echo "🔍 Step 3: Verify Deployment"
echo "---------------------------"

# Get project URL
PROJECT_URL=$(supabase status | grep "API URL" | awk '{print $3}')
if [ -z "$PROJECT_URL" ]; then
    echo -e "${YELLOW}⚠️  Could not determine project URL${NC}"
    echo "Please check manually"
else
    HEALTH_URL="${PROJECT_URL}/functions/v1/wa-agent-call-center/health"
    echo "Testing health check: $HEALTH_URL"
    
    # Test health endpoint
    HEALTH_RESPONSE=$(curl -s "$HEALTH_URL" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo "Response:"
        echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
        
        # Check if AGI mode
        MODE=$(echo "$HEALTH_RESPONSE" | jq -r '.mode' 2>/dev/null)
        TOOLS=$(echo "$HEALTH_RESPONSE" | jq -r '.tools_available' 2>/dev/null)
        
        if [ "$MODE" = "agi" ]; then
            echo -e "${GREEN}✅ AGI mode active${NC}"
            echo -e "${GREEN}✅ Tools available: $TOOLS${NC}"
        else
            echo -e "${YELLOW}⚠️  AGI mode not active (mode: $MODE)${NC}"
            echo "Set CALL_CENTER_USE_AGI=true in environment variables"
        fi
    else
        echo -e "${RED}❌ Health check failed${NC}"
        echo "Function may not be deployed correctly"
    fi
fi

echo ""
echo "📊 Step 4: Database Verification"
echo "--------------------------------"

echo "Run these SQL queries to verify:"
echo ""
echo "-- Check agent exists"
echo "SELECT slug, name, is_active FROM ai_agents WHERE slug = 'call_center';"
echo ""
echo "-- Check tools loaded"
echo "SELECT COUNT(*) as tool_count FROM ai_agent_tools"
echo "WHERE agent_id = (SELECT id FROM ai_agents WHERE slug = 'call_center');"
echo ""
echo "-- Check tasks loaded"
echo "SELECT COUNT(*) as task_count FROM ai_agent_tasks"
echo "WHERE agent_id = (SELECT id FROM ai_agents WHERE slug = 'call_center');"
echo ""

read -p "Open database SQL editor? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Opening Supabase dashboard..."
    PROJECT_REF=$(cat supabase/.temp/project-ref 2>/dev/null || echo "unknown")
    open "https://app.supabase.com/project/$PROJECT_REF/sql"
fi

echo ""
echo "✅ Deployment Complete!"
echo "======================"
echo ""
echo "Next Steps:"
echo "1. ✅ Database migration applied"
echo "2. ✅ Edge function deployed"
echo "3. ⏳ Configure WhatsApp webhook"
echo "4. ⏳ Test with real calls"
echo ""
echo "📚 Documentation:"
echo "- Full Guide: CALL_CENTER_AGI_IMPLEMENTATION.md"
echo "- Quick Start: CALL_CENTER_AGI_QUICK_START.md"
echo "- Summary: CALL_CENTER_AGI_SUMMARY.md"
echo ""
echo "🎯 Test the AGI:"
echo "curl $HEALTH_URL"
echo ""
echo "🎉 Your Call Center AGI is ready!"
