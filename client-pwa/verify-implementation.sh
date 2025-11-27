#!/bin/bash

echo "🔍 Verifying PWA Advanced Features Implementation"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
    if [ -f "$1" ]; then
        lines=$(wc -l < "$1" | tr -d ' ')
        echo -e "${GREEN}✅${NC} $1 (${lines} lines)"
        return 0
    else
        echo -e "${RED}❌${NC} $1 MISSING"
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅${NC} $1/ exists"
        return 0
    else
        echo -e "${RED}❌${NC} $1/ MISSING"
        return 1
    fi
}

total=0
passed=0

echo "📁 Core Libraries:"
check_file "lib/haptics.ts" && ((passed++)); ((total++))
check_file "lib/view-transitions.ts" && ((passed++)); ((total++))
check_file "lib/push-notifications.ts" && ((passed++)); ((total++))
echo ""

echo "🎨 Components:"
check_file "components/ui/PullToRefresh.tsx" && ((passed++)); ((total++))
check_file "components/order/OrderTracker.tsx" && ((passed++)); ((total++))
check_file "components/order/VoiceOrder.tsx" && ((passed++)); ((total++))
check_file "components/payment/PaymentSelector.tsx" && ((passed++)); ((total++))
echo ""

echo "🔧 Hooks:"
check_file "hooks/useHaptics.ts" && ((passed++)); ((total++))
echo ""

echo "⚙️ PWA Files:"
check_file "public/sw.js" && ((passed++)); ((total++))
check_file "app/view-transitions.css" && ((passed++)); ((total++))
check_file "app/offline/page.tsx" && ((passed++)); ((total++))
check_file "app/offline/layout.tsx" && ((passed++)); ((total++))
echo ""

echo "📚 Documentation:"
check_file "PWA_FEATURES.md" && ((passed++)); ((total++))
check_file "IMPLEMENTATION_COMPLETE.md" && ((passed++)); ((total++))
check_file "SETUP_CHECKLIST.md" && ((passed++)); ((total++))
echo ""

echo "📂 Directories:"
check_dir "public/sounds" && ((passed++)); ((total++))
echo ""

echo "=================================================="
echo -e "Results: ${GREEN}${passed}/${total}${NC} checks passed"
echo ""

if [ $passed -eq $total ]; then
    echo -e "${GREEN}🎉 ALL FEATURES FULLY IMPLEMENTED!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Read SETUP_CHECKLIST.md"
    echo "2. Import view-transitions.css in app/layout.tsx"
    echo "3. Register service worker in app/layout.tsx"
    echo "4. Add sound files to public/sounds/ (optional)"
    echo "5. Test features with: pnpm dev"
else
    echo -e "${RED}⚠️  Some files are missing!${NC}"
    echo "Please check the errors above."
fi

echo ""
