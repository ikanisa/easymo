#!/bin/bash
# Waiter AI Quick Deployment Commands

echo "🍽️  Waiter AI Deployment Quick Commands"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. Apply Database Migration${NC}"
echo "   supabase db push --include-all"
echo "   OR manually via Dashboard SQL Editor"
echo ""

echo -e "${BLUE}2. Deploy Edge Function (ALREADY DONE ✅)${NC}"
echo "   supabase functions deploy waiter-ai-agent"
echo -e "   ${GREEN}Status: Deployed to https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/waiter-ai-agent${NC}"
echo ""

echo -e "${BLUE}3. Set OpenAI API Key${NC}"
echo "   supabase secrets set OPENAI_API_KEY=sk-your-key-here"
echo ""

echo -e "${BLUE}4. Test Edge Function${NC}"
echo "   # Start conversation"
echo '   curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/waiter-ai-agent \'
echo '     -H "Content-Type: application/json" \'
echo '     -H "Authorization: Bearer YOUR_ANON_KEY" \'
echo '     -d '"'"'{'
echo '       "action": "start_conversation",'
echo '       "userId": "test-user",'
echo '       "language": "en",'
echo '       "metadata": {"venue": "test"}'
echo '     }'"'"
echo ""

echo -e "${BLUE}5. View Logs${NC}"
echo "   supabase functions logs waiter-ai-agent"
echo ""

echo -e "${BLUE}6. Check Database${NC}"
echo "   supabase db inspect"
echo "   # Or via Dashboard → Table Editor"
echo ""

echo -e "${YELLOW}Frontend Implementation (Pending):${NC}"
echo "   cd waiter-pwa"
echo "   pnpm install"
echo "   # Create missing source files (see WAITER_AI_IMPLEMENTATION_STATUS.md)"
echo "   pnpm dev    # Test locally"
echo "   pnpm build  # Build for production"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Backend Status: ✅ READY${NC}"
echo -e "${YELLOW}Frontend Status: ⚠️  PENDING (templates provided)${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📚 Documentation:"
echo "   - WAITER_AI_PWA_COMPLETE_SUMMARY.md (overview)"
echo "   - WAITER_AI_IMPLEMENTATION_STATUS.md (detailed guide)"
echo ""
echo "🔗 Links:"
echo "   - Edge Function: https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/waiter-ai-agent"
echo "   - GitHub: https://github.com/ikanisa/easymo-"
echo "   - Dashboard: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt"
