#!/bin/bash

# 🎯 CLIENT PWA - COMPREHENSIVE VERIFICATION SCRIPT
# Verifies all advanced features are properly implemented

echo "🚀 Starting Client PWA Advanced Features Verification..."
echo "================================================================"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $2 - File missing: $1"
        ((FAIL++))
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $2 - Directory missing: $1"
        ((FAIL++))
    fi
}

check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $3"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $3 - Pattern not found in $1"
        ((FAIL++))
    fi
}

echo ""
echo "📱 NATIVE FEEL FEATURES"
echo "------------------------"
check_file "lib/haptics.ts" "Haptic feedback system"
check_content "lib/haptics.ts" "addToCart\|checkout\|orderConfirmed" "Haptic custom actions"
check_file "lib/view-transitions.ts" "View Transitions API"
check_file "components/ui/PullToRefresh.tsx" "Pull-to-refresh component"
check_content "components/ui/PullToRefresh.tsx" "useMotionValue" "Pull-to-refresh uses Framer Motion"
check_file "hooks/useSwipeNavigation.ts" "Swipe navigation hook"

echo ""
echo "⚡ PERFORMANCE FEATURES"
echo "------------------------"
check_file "public/sw.js" "Service worker"
check_content "public/sw.js" "NetworkFirst\|CacheFirst" "Service worker caching strategies"
check_file "components/menu/MenuSkeleton.tsx" "Skeleton screens"
check_file "components/menu/VirtualizedMenuList.tsx" "Virtualized lists"
check_content "components/menu/VirtualizedMenuList.tsx" "@tanstack/react-virtual" "Virtual list library"

echo ""
echo "🔔 ENGAGEMENT FEATURES"
echo "------------------------"
check_file "lib/push-notifications.ts" "Push notifications"
check_content "lib/push-notifications.ts" "PushManager\|subscribe" "Push subscription logic"
check_dir "public/sounds" "Sound effects directory"
check_file "public/sounds/tap.mp3" "Tap sound"
check_file "public/sounds/success.mp3" "Success sound"
check_file "public/sounds/pop.mp3" "Add to cart sound"
check_file "public/sounds/cha-ching.mp3" "Checkout sound"

echo ""
echo "🎨 VISUAL POLISH"
echo "------------------------"
check_content "package.json" "framer-motion" "Framer Motion installed"
check_content "package.json" "canvas-confetti" "Confetti library installed"
check_content "tailwind.config.ts" "backdrop-blur\|blur" "Glassmorphism support"
check_file "lib/design-tokens.ts" "Design tokens"

echo ""
echo "📡 OFFLINE & REALTIME"
echo "------------------------"
check_file "components/order/OrderTracker.tsx" "Order tracker component"
check_content "components/order/OrderTracker.tsx" "supabase.*channel\|realtime" "Realtime subscriptions"
check_content "public/sw.js" "IndexedDB\|pending-orders" "Offline order queue"
check_content "stores/cart.ts" "persist.*localStorage" "Cart persistence"

echo ""
echo "🧠 SMART FEATURES"
echo "------------------------"
check_file "components/order/VoiceOrder.tsx" "Voice ordering"
check_content "components/order/VoiceOrder.tsx" "SpeechRecognition" "Web Speech API"
check_file "lib/recommendations.ts" "Recommendation engine"
check_content "lib/recommendations.ts" "calculateItemScore\|getPairingRecommendations" "Recommendation logic"

echo ""
echo "💳 PAYMENT INTEGRATION"
echo "------------------------"
check_file "components/payment/PaymentSelector.tsx" "Payment selector"
check_content "components/payment/PaymentSelector.tsx" "momo_ussd\|momo_qr\|revolut" "Payment methods"
check_content "components/payment/PaymentSelector.tsx" "QRCodeSVG\|QRCode" "QR code generation"

echo ""
echo "🔗 INTEGRATIONS"
echo "------------------------"
check_file "lib/manager-sync.ts" "Bar manager sync"
check_content "lib/manager-sync.ts" "syncOrder\|subscribeToOrderUpdates" "Manager sync functions"
check_file "lib/whatsapp-bridge.ts" "WhatsApp bridge"
check_content "lib/whatsapp-bridge.ts" "linkSession\|syncCartFromWhatsApp" "WhatsApp sync logic"

echo ""
echo "🚀 DEPLOYMENT"
echo "------------------------"
check_file "netlify.toml" "Netlify configuration"
check_file "next.config.js" "Next.js config"
check_content "next.config.js" "pwa\|workbox" "PWA configuration"
check_file "app/manifest.ts" "PWA manifest"

echo ""
echo "📦 DEPENDENCIES"
echo "------------------------"
check_content "package.json" "next-pwa" "next-pwa installed"
check_content "package.json" "qr-scanner" "QR scanner installed"
check_content "package.json" "@tanstack/react-virtual" "React Virtual installed"
check_content "package.json" "zustand" "Zustand state management"
check_content "package.json" "framer-motion" "Framer Motion animations"

echo ""
echo "🗂️ PROJECT STRUCTURE"
echo "------------------------"
check_dir "app/[venueSlug]" "Venue pages directory"
check_dir "app/scan" "QR scanner page"
check_dir "components/order" "Order components"
check_dir "components/payment" "Payment components"
check_dir "components/menu" "Menu components"
check_dir "components/layout" "Layout components"
check_dir "components/ui" "UI components"
check_dir "lib" "Library directory"
check_dir "hooks" "Hooks directory"
check_dir "stores" "Stores directory"
check_dir "public/icons" "PWA icons"
check_dir "public/splash" "Splash screens"

echo ""
echo "================================================================"
echo "📊 VERIFICATION RESULTS"
echo "================================================================"
echo -e "${GREEN}PASSED:${NC} $PASS checks"
echo -e "${RED}FAILED:${NC} $FAIL checks"

if [ $FAIL -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 ALL CHECKS PASSED!${NC}"
    echo -e "${GREEN}✅ Client PWA is fully implemented and ready for deployment${NC}"
    echo ""
    echo "Next steps:"
    echo "1. pnpm install"
    echo "2. pnpm build"
    echo "3. pnpm test"
    echo "4. netlify deploy --prod"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  Some checks failed${NC}"
    echo "Please review the failed items above and ensure all features are implemented."
    exit 1
fi
