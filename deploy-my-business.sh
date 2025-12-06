#!/bin/bash
# My Business Workflow - Complete Deployment Script
# Date: 2024-12-06

set -e

echo "🚀 MY BUSINESS WORKFLOW - DEPLOYMENT"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
    echo -e "${RED}❌ Error: Not in project root. Please run from /workspace/easymo${NC}"
    exit 1
fi

echo "📋 Pre-Deployment Checklist"
echo "---------------------------"

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install: https://supabase.com/docs/guides/cli"
    exit 1
fi
echo -e "${GREEN}✅ Supabase CLI installed${NC}"

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase${NC}"
    echo "Run: supabase login"
    exit 1
fi
echo -e "${GREEN}✅ Supabase authenticated${NC}"

# Check for GEMINI_API_KEY
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Ensure GEMINI_API_KEY is set in Supabase Dashboard${NC}"
echo "   https://aistudio.google.com/app/apikey"
echo ""
read -p "Press Enter to continue or Ctrl+C to abort..."

echo ""
echo "🗄️  STEP 1: Apply Database Migrations"
echo "-------------------------------------"
echo "Applying 6 migrations..."
echo ""

cd supabase

# List migrations to be applied
echo "Migrations:"
echo "  1. 20251206_001_profile_menu_items.sql"
echo "  2. 20251206_002_get_profile_menu_items_v2.sql"
echo "  3. 20251206_003_user_businesses.sql"
echo "  4. 20251206_004_semantic_business_search.sql"
echo "  5. 20251206_005_menu_enhancements.sql"
echo "  6. 20251206_006_waiter_ai_tables.sql"
echo ""

read -p "Apply migrations? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase db push
    echo -e "${GREEN}✅ Migrations applied${NC}"
else
    echo -e "${YELLOW}⏭️  Skipped migrations${NC}"
fi

echo ""
echo "📦 STEP 2: Deploy Edge Functions"
echo "---------------------------------"
echo ""

read -p "Deploy wa-webhook-profile? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase functions deploy wa-webhook-profile --no-verify-jwt
    echo -e "${GREEN}✅ wa-webhook-profile deployed${NC}"
else
    echo -e "${YELLOW}⏭️  Skipped wa-webhook-profile${NC}"
fi

echo ""
read -p "Deploy wa-webhook-waiter (NEW)? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase functions deploy wa-webhook-waiter --no-verify-jwt
    echo -e "${GREEN}✅ wa-webhook-waiter deployed${NC}"
else
    echo -e "${YELLOW}⏭️  Skipped wa-webhook-waiter${NC}"
fi

cd ..

echo ""
echo "🔧 STEP 3: Environment Variables Check"
echo "--------------------------------------"
echo ""
echo "Required secrets in Supabase Dashboard:"
echo "  ✅ WA_ACCESS_TOKEN"
echo "  ✅ WA_PHONE_NUMBER_ID"
echo "  ✅ WA_VERIFY_TOKEN"
echo "  ✅ SUPABASE_SERVICE_ROLE_KEY"
echo "  ⚠️  GEMINI_API_KEY (NEW - required for menu OCR)"
echo ""
echo "Set via: Supabase Dashboard → Edge Functions → Secrets"
echo "Or CLI: supabase secrets set GEMINI_API_KEY=your_key_here"
echo ""

echo ""
echo "🧪 STEP 4: Verification Tests"
echo "-----------------------------"
echo ""

read -p "Run verification tests? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Testing profile menu RPC..."
    supabase db execute "SELECT COUNT(*) FROM profile_menu_items WHERE is_active = true"
    
    echo ""
    echo "Testing semantic search function..."
    supabase db execute "SELECT search_businesses_semantic('test', 'Rwanda', 1)"
    
    echo -e "${GREEN}✅ Database verification complete${NC}"
else
    echo -e "${YELLOW}⏭️  Skipped tests${NC}"
fi

echo ""
echo "===================================="
echo "✨ DEPLOYMENT COMPLETE"
echo "===================================="
echo ""
echo "📚 Next Steps:"
echo "  1. Set GEMINI_API_KEY in Supabase Dashboard"
echo "  2. Test via WhatsApp:"
echo "     - Send 'Profile' → Check for 'My Bars & Restaurants'"
echo "     - Test menu upload with a photo"
echo "     - Test AI ordering (Waiter)"
echo "  3. Review logs:"
echo "     - supabase functions logs wa-webhook-profile"
echo "     - supabase functions logs wa-webhook-waiter"
echo ""
echo "📖 Full Documentation: MY_BUSINESS_COMPLETE_IMPLEMENTATION.md"
echo ""
echo "🎉 Happy deploying!"
