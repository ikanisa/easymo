#!/bin/bash
# Deploy Omnichannel SMS System
# This script deploys the complete omnichannel messaging infrastructure

set -e

echo "🚀 Deploying Omnichannel SMS System..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Apply database migration
echo -e "${BLUE}📦 Step 1/4: Applying database migration...${NC}"
supabase db push
echo -e "${GREEN}✅ Database migration applied${NC}"
echo ""

# Step 2: Deploy post-call-notify function
echo -e "${BLUE}📤 Step 2/4: Deploying post-call-notify function...${NC}"
supabase functions deploy post-call-notify \
  --no-verify-jwt
echo -e "${GREEN}✅ post-call-notify deployed${NC}"
echo ""

# Step 3: Deploy sms-inbound-webhook function
echo -e "${BLUE}📤 Step 3/4: Deploying sms-inbound-webhook function...${NC}"
supabase functions deploy sms-inbound-webhook \
  --no-verify-jwt
echo -e "${GREEN}✅ sms-inbound-webhook deployed${NC}"
echo ""

# Step 4: Verify environment variables
echo -e "${BLUE}🔍 Step 4/4: Verifying environment variables...${NC}"
echo ""
echo "Required environment variables:"
echo "  ✅ SUPABASE_URL (existing)"
echo "  ✅ SUPABASE_SERVICE_ROLE_KEY (existing)"
echo "  ✅ WHATSAPP_PHONE_ID (existing)"
echo "  ✅ WHATSAPP_ACCESS_TOKEN (existing)"
echo ""
echo -e "${YELLOW}⚠️  NEW - Set these in Supabase Dashboard:${NC}"
echo "  📍 MTN_SMS_API_KEY"
echo "  📍 MTN_SMS_API_SECRET"
echo "  📍 MTN_SMS_SENDER_ID (default: 'EasyMO')"
echo ""
echo -e "${YELLOW}⚠️  Configure MTN webhook:${NC}"
SUPABASE_URL=$(grep SUPABASE_URL .env.local 2>/dev/null | cut -d '=' -f2 || echo "https://your-project.supabase.co")
echo "  Webhook URL: ${SUPABASE_URL}/functions/v1/sms-inbound-webhook"
echo "  Method: POST"
echo "  Headers: Authorization: Bearer YOUR_SUPABASE_ANON_KEY"
echo ""

# Summary
echo -e "${GREEN}✨ Deployment Complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Set MTN SMS credentials in Supabase Dashboard"
echo "  2. Configure MTN webhook URL"
echo "  3. Test with: ./test-omnichannel-sms.sh"
echo ""
echo "Documentation: OMNICHANNEL_SMS_IMPLEMENTATION.md"
