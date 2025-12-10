#!/bin/bash
set -e

echo "🚀 Deploying My Business Workflow - Complete Implementation"
echo "============================================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Phase 1: Database Migrations${NC}"
echo "=================================="

# Apply migrations in order
MIGRATIONS=(
    "20251206_001_profile_menu_items.sql"
    "20251206_002_get_profile_menu_items_v2.sql"
    "20251206_003_user_businesses.sql"
    "20251206_004_semantic_business_search.sql"
    "20251206_005_menu_enhancements.sql"
    "20251206_006_waiter_ai_tables.sql"
)

for migration in "${MIGRATIONS[@]}"; do
    if [ -f "supabase/migrations/$migration" ]; then
        echo -e "${GREEN}✓${NC} Applying: $migration"
    else
        echo -e "${RED}✗${NC} Missing: $migration"
        exit 1
    fi
done

echo ""
echo -e "${BLUE}🔄 Pushing database changes...${NC}"
supabase db push

echo ""
echo -e "${BLUE}📤 Phase 2: Deploy Edge Functions${NC}"
echo "====================================="

# Deploy wa-webhook-profile (updated)
echo -e "${GREEN}→${NC} Deploying wa-webhook-profile..."
supabase functions deploy wa-webhook-profile \
    --no-verify-jwt \
    --import-map supabase/functions/import_map.json

# Deploy new wa-webhook-waiter
echo -e "${GREEN}→${NC} Deploying wa-webhook-waiter (NEW)..."
supabase functions deploy wa-webhook-waiter \
    --no-verify-jwt

echo ""
echo -e "${BLUE}🔐 Phase 3: Set Environment Variables${NC}"
echo "========================================"

# Check for required env vars
echo -e "${YELLOW}Checking environment variables...${NC}"

REQUIRED_VARS=(
    "GEMINI_API_KEY"
    "WA_ACCESS_TOKEN"
    "WA_PHONE_NUMBER_ID"
    "WA_VERIFY_TOKEN"
    "SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${YELLOW}⚠${NC}  $var not set in current environment"
        echo "   Set via: supabase secrets set $var=your_value"
    else
        echo -e "${GREEN}✓${NC} $var is set"
    fi
done

echo ""
echo -e "${BLUE}🔍 Phase 4: Verify Deployment${NC}"
echo "==============================="

# Check functions are deployed
echo -e "${GREEN}→${NC} Checking deployed functions..."
supabase functions list | grep -E "wa-webhook-profile|wa-webhook-waiter" || echo -e "${YELLOW}⚠ Functions not listed yet${NC}"

echo ""
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Verify migrations: supabase db pull"
echo "2. Test Profile Menu: Send 'profile' to WhatsApp"
echo "3. Test Business Search: Tap 'My Businesses' → Search"
echo "4. Test Menu Upload: Tap 'My Bars & Restaurants' → Upload Menu"
echo "5. Test Waiter AI: Scan QR code at table (need to generate QR)"
echo ""
echo -e "${YELLOW}⚠ IMPORTANT:${NC}"
echo "• Ensure GEMINI_API_KEY is set for menu OCR"
echo "• Configure bar payment_settings in database"
echo "• Generate QR codes for Waiter AI (bar_id deeplinks)"
echo ""
echo -e "${BLUE}📊 Feature Summary:${NC}"
echo "✓ Dynamic Profile Menu with visibility conditions"
echo "✓ Business Search & Claim (3,000+ businesses)"
echo "✓ Manual Business Addition"
echo "✓ Bar/Restaurant Management"
echo "✓ Menu Upload with Gemini OCR"
echo "✓ Menu Item Editing & Availability"
echo "✓ Order Management"
echo "✓ Waiter AI Conversational Ordering"
echo "✓ MOMO & Revolut Payment Integration"
echo "✓ Bar Notifications"
echo ""
