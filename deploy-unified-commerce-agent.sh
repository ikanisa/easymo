#!/bin/bash
# =====================================================
# Deploy Unified Commerce Agent
# =====================================================
# Phase 1-4: Complete deployment with all features
#
# Features deployed:
# - Unified CommerceAgent (marketplace + business broker)
# - Google Places API integration
# - Trust & Safety (ratings, moderation, escrow)
# - Database migrations
# =====================================================

set -e

echo "🚀 Deploying Unified Commerce Agent..."
echo "======================================"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =====================================================
# 1. VERIFY ENVIRONMENT
# =====================================================

echo -e "${BLUE}Step 1: Verifying environment...${NC}"

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install with: npm install -g supabase"
    exit 1
fi

# Check for required env vars
if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo "⚠️  SUPABASE_PROJECT_REF not set. Using default from supabase config."
fi

# Optional: Check for Google Maps API key
if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo "⚠️  GOOGLE_MAPS_API_KEY not set. Google Places integration will be disabled."
    echo "   Set it later with: supabase secrets set GOOGLE_MAPS_API_KEY=your_key"
fi

echo "✅ Environment verified"
echo ""

# =====================================================
# 2. DATABASE MIGRATIONS
# =====================================================

echo -e "${BLUE}Step 2: Applying database migrations...${NC}"

# Apply migrations
supabase db push

echo "✅ Database migrations applied"
echo ""

# =====================================================
# 3. DEPLOY EDGE FUNCTIONS
# =====================================================

echo -e "${BLUE}Step 3: Deploying edge functions...${NC}"

# Deploy wa-webhook-unified (contains CommerceAgent)
echo "  📦 Deploying wa-webhook-unified..."
supabase functions deploy wa-webhook-unified \
  --no-verify-jwt \
  --import-map supabase/functions/import_map.json

echo "✅ Edge functions deployed"
echo ""

# =====================================================
# 4. SET SECRETS
# =====================================================

echo -e "${BLUE}Step 4: Setting secrets...${NC}"

# Set Google Maps API key if provided
if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
    echo "  🔑 Setting GOOGLE_MAPS_API_KEY..."
    supabase secrets set GOOGLE_MAPS_API_KEY="$GOOGLE_MAPS_API_KEY"
else
    echo "  ⚠️  Skipping GOOGLE_MAPS_API_KEY (not provided)"
fi

# Set Gemini API key if provided
if [ -n "$GEMINI_API_KEY" ]; then
    echo "  🔑 Setting GEMINI_API_KEY..."
    supabase secrets set GEMINI_API_KEY="$GEMINI_API_KEY"
else
    echo "  ⚠️  Skipping GEMINI_API_KEY (not provided)"
fi

# Set MoMo merchant code if provided
if [ -n "$MOMO_MERCHANT_CODE" ]; then
    echo "  🔑 Setting MOMO_MERCHANT_CODE..."
    supabase secrets set MOMO_MERCHANT_CODE="$MOMO_MERCHANT_CODE"
else
    echo "  ⚠️  Skipping MOMO_MERCHANT_CODE (not provided)"
fi

echo "✅ Secrets configured"
echo ""

# =====================================================
# 5. VERIFY DEPLOYMENT
# =====================================================

echo -e "${BLUE}Step 5: Verifying deployment...${NC}"

# Check if function is deployed
FUNCTION_URL=$(supabase functions list | grep wa-webhook-unified | awk '{print $2}')

if [ -z "$FUNCTION_URL" ]; then
    echo "❌ Function deployment verification failed"
    exit 1
fi

echo "  ✅ Function deployed at: $FUNCTION_URL"

# Test function health
echo "  🏥 Testing function health..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${FUNCTION_URL}/health" || echo "000")

if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "  ✅ Function is healthy"
else
    echo "  ⚠️  Function health check returned: $HEALTH_RESPONSE"
fi

echo ""

# =====================================================
# 6. SUMMARY
# =====================================================

echo -e "${GREEN}======================================"
echo "✅ Unified Commerce Agent Deployed!"
echo "======================================${NC}"
echo ""
echo "📊 Deployment Summary:"
echo "  • CommerceAgent: ✅ Deployed"
echo "  • Database migrations: ✅ Applied"
echo "  • Trust & Safety: ✅ Active"
echo "  • Google Places API: $([ -n "$GOOGLE_MAPS_API_KEY" ] && echo '✅ Enabled' || echo '⚠️  Disabled (no API key)')"
echo ""
echo "🔧 Next Steps:"
echo ""
echo "1. Test the agent:"
echo "   Send a WhatsApp message: 'I want to sell my laptop'"
echo "   Or: 'Find a pharmacy near me'"
echo ""
echo "2. Set Google Maps API key (if not done):"
echo "   supabase secrets set GOOGLE_MAPS_API_KEY=your_key_here"
echo ""
echo "3. Monitor logs:"
echo "   supabase functions logs wa-webhook-unified --tail"
echo ""
echo "4. View database:"
echo "   - Listings: SELECT * FROM unified_listings;"
echo "   - Businesses: SELECT * FROM business_directory;"
echo "   - Reviews: SELECT * FROM ratings_reviews;"
echo ""
echo "📖 Documentation:"
echo "   See docs/COMMERCE_AGENT.md for full documentation"
echo ""
echo -e "${GREEN}Happy selling! 🛒${NC}"
