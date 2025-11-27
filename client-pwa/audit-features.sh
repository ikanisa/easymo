#!/bin/bash

# PWA Features Audit Script
# Comprehensive verification of all advanced features

echo "🔍 CLIENT PWA FEATURES AUDIT"
echo "======================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL=0
IMPLEMENTED=0
MISSING=0

check_file() {
    local file=$1
    local feature=$2
    TOTAL=$((TOTAL + 1))
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $feature"
        echo "   📄 $file"
        IMPLEMENTED=$((IMPLEMENTED + 1))
        return 0
    else
        echo -e "${RED}❌${NC} $feature"
        echo "   📄 $file (MISSING)"
        MISSING=$((MISSING + 1))
        return 1
    fi
}

check_directory() {
    local dir=$1
    local feature=$2
    TOTAL=$((TOTAL + 1))
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✅${NC} $feature"
        echo "   📁 $dir"
        IMPLEMENTED=$((IMPLEMENTED + 1))
        return 0
    else
        echo -e "${RED}❌${NC} $feature"
        echo "   📁 $dir (MISSING)"
        MISSING=$((MISSING + 1))
        return 1
    fi
}

check_in_file() {
    local file=$1
    local pattern=$2
    local feature=$3
    TOTAL=$((TOTAL + 1))
    
    if [ -f "$file" ] && grep -q "$pattern" "$file"; then
        echo -e "${GREEN}✅${NC} $feature"
        echo "   📝 Found in $file"
        IMPLEMENTED=$((IMPLEMENTED + 1))
        return 0
    else
        echo -e "${RED}❌${NC} $feature"
        echo "   📝 Not found in $file"
        MISSING=$((MISSING + 1))
        return 1
    fi
}

echo "📲 NATIVE FEEL FEATURES"
echo "------------------------"
check_file "lib/haptics.ts" "Haptic Feedback System"
check_file "lib/view-transitions.ts" "View Transitions API"
check_file "components/ui/PullToRefresh.tsx" "Pull-to-Refresh"
check_file "hooks/useSwipeNavigation.ts" "Gesture Navigation"
check_file "components/ui/BottomSheet.tsx" "Bottom Sheet Modals"
echo ""

echo "⚡ PERFORMANCE FEATURES"
echo "------------------------"
check_file "public/sw.js" "Service Worker"
check_file "components/menu/VirtualizedMenuList.tsx" "Virtual Lists"
check_file "components/ui/Skeleton.tsx" "Skeleton Screens"
echo ""

echo "🔔 ENGAGEMENT FEATURES"
echo "------------------------"
check_file "lib/push-notifications.ts" "Push Notifications"
check_file "components/ui/LottieAnimation.tsx" "Lottie Animations"
check_in_file "package.json" "canvas-confetti" "Confetti Effects"
echo ""

echo "📡 OFFLINE & REALTIME"
echo "------------------------"
check_file "public/sw.js" "Offline Caching"
check_file "components/order/OrderTracker.tsx" "Real-time Order Status"
check_in_file "lib/push-notifications.ts" "Background Sync" "Background Sync"
echo ""

echo "🧠 SMART FEATURES"
echo "------------------------"
check_file "components/order/VoiceOrder.tsx" "Voice Ordering"
check_file "lib/recommendations.ts" "Smart Recommendations"
check_file "stores/cart.ts" "Cart Store (Zustand)"
echo ""

echo "💳 PAYMENT INTEGRATION"
echo "------------------------"
check_file "components/payment/PaymentSelector.tsx" "Payment Selector"
check_in_file "components/payment/PaymentSelector.tsx" "momo_ussd" "MoMo USSD"
check_in_file "components/payment/PaymentSelector.tsx" "revolut" "Revolut"
check_in_file "components/payment/PaymentSelector.tsx" "QRCodeSVG" "QR Code Payment"
echo ""

echo "🎨 UI/UX ENHANCEMENTS"
echo "------------------------"
check_file "components/layout/BottomNav.tsx" "Bottom Navigation"
check_file "components/layout/PWAInstallPrompt.tsx" "PWA Install Prompt"
check_file "components/venue/VenueHeader.tsx" "Venue Header"
check_file "app/scan/page.tsx" "QR Scanner Page"
echo ""

echo "🌐 INTERNATIONALIZATION"
echo "------------------------"
check_directory "i18n" "i18n Directory"
check_file "i18n/locales/en.json" "English Translations"
check_file "i18n/locales/fr.json" "French Translations"
check_file "i18n/locales/rw.json" "Kinyarwanda Translations"
echo ""

echo "🔗 INTEGRATIONS"
echo "------------------------"
check_file "lib/manager-sync.ts" "Bar Manager Sync"
check_file "lib/whatsapp-bridge.ts" "WhatsApp Bridge"
echo ""

echo "📱 PWA CONFIGURATION"
echo "------------------------"
check_file "public/manifest.json" "PWA Manifest"
check_file "public/sw.js" "Service Worker"
check_directory "public/icons" "App Icons"
check_directory "public/sounds" "Sound Effects"
check_file "next.config.mjs" "Next PWA Config"
echo ""

echo "🗄️ DATABASE SCHEMA"
echo "------------------------"
check_file "supabase/migrations/20251127100000_client_pwa_schema.sql" "Client PWA Schema"
echo ""

echo "📦 DEPENDENCIES"
echo "------------------------"
check_in_file "package.json" "framer-motion" "Framer Motion"
check_in_file "package.json" "zustand" "Zustand State"
check_in_file "package.json" "@tanstack/react-virtual" "React Virtual"
check_in_file "package.json" "lottie-web" "Lottie"
check_in_file "package.json" "qr-scanner" "QR Scanner"
check_in_file "package.json" "qrcode.react" "QR Code Generator"
check_in_file "package.json" "canvas-confetti" "Confetti"
echo ""

echo "🚀 DEPLOYMENT"
echo "------------------------"
check_file "netlify.toml" "Netlify Config"
check_file "deploy-pwa.sh" "Deploy Script"
check_file ".env.example" "Environment Template"
echo ""

echo "======================================"
echo "📊 AUDIT SUMMARY"
echo "======================================"
echo -e "Total Features Checked: ${YELLOW}$TOTAL${NC}"
echo -e "Implemented: ${GREEN}$IMPLEMENTED${NC}"
echo -e "Missing: ${RED}$MISSING${NC}"
echo ""

PERCENTAGE=$((IMPLEMENTED * 100 / TOTAL))
echo -e "Implementation: ${YELLOW}$PERCENTAGE%${NC}"
echo ""

if [ $MISSING -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL FEATURES IMPLEMENTED!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some features are missing. See details above.${NC}"
    exit 1
fi
