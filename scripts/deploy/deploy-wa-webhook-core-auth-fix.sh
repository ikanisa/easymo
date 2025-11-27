#!/bin/bash
set -euo pipefail

echo "🔐 WhatsApp Webhook Core - Authentication Fix Deployment"
echo "========================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if WA_APP_SECRET is set
echo ""
echo "📋 Pre-deployment Checklist:"
echo ""

echo -n "1. Checking if supabase CLI is installed... "
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}FAILED${NC}"
    echo "   Install: npm install -g supabase"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

echo -n "2. Checking if logged in to Supabase... "
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}FAILED${NC}"
    echo "   Run: supabase login"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

echo -n "3. Checking current project link... "
if ! supabase status &> /dev/null; then
    echo -e "${YELLOW}WARNING${NC}"
    echo "   Not linked to a project. Run: supabase link --project-ref <ref>"
else
    echo -e "${GREEN}OK${NC}"
fi

echo ""
echo "⚠️  IMPORTANT: You MUST set WA_APP_SECRET before deploying"
echo ""
echo "   Get your WhatsApp App Secret:"
echo "   1. Go to: https://developers.facebook.com/apps"
echo "   2. Select your WhatsApp app"
echo "   3. Settings → Basic → App Secret (click 'Show')"
echo ""
echo "   Then set the secret:"
echo -e "   ${GREEN}supabase secrets set WA_APP_SECRET=<your_secret>${NC}"
echo ""
read -p "Have you set WA_APP_SECRET? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Deployment cancelled${NC}"
    echo "Set the secret first, then re-run this script"
    exit 1
fi

echo ""
echo "🚀 Deploying wa-webhook-core with authentication fix..."
echo ""

# Deploy the function
if supabase functions deploy wa-webhook-core; then
    echo ""
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "📊 Next Steps:"
    echo ""
    echo "1. Monitor logs for authentication events:"
    echo -e "   ${GREEN}supabase functions logs wa-webhook-core${NC}"
    echo ""
    echo "2. Watch for these events:"
    echo "   ✅ CORE_WEBHOOK_RECEIVED → Webhook authenticated successfully"
    echo "   ⚠️  CORE_AUTH_FAILED → Invalid signature (check app secret)"
    echo "   ❌ CORE_AUTH_CONFIG_ERROR → WA_APP_SECRET not configured"
    echo ""
    echo "3. Test with WhatsApp Business Platform:"
    echo "   • Go to your app's Webhooks settings"
    echo "   • Click 'Test' button to send a test event"
    echo "   • Should now return 200 OK (not 401)"
    echo ""
    echo "📖 Full documentation: WA_WEBHOOK_CORE_AUTH_FIX.md"
else
    echo ""
    echo -e "${RED}❌ Deployment failed${NC}"
    echo ""
    echo "Common issues:"
    echo "• Not linked to project: supabase link --project-ref <ref>"
    echo "• Not logged in: supabase login"
    echo "• Network issues: Check internet connection"
    exit 1
fi
