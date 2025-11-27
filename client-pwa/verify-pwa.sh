#!/bin/bash

echo "🔍 CLIENT PWA - IMPLEMENTATION VERIFICATION"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1"
    return 0
  else
    echo -e "${RED}✗${NC} $1 (missing)"
    return 1
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $1/"
    return 0
  else
    echo -e "${RED}✗${NC} $1/ (missing)"
    return 1
  fi
}

echo "📁 Directory Structure"
echo "--------------------"
check_dir "app"
check_dir "components"
check_dir "lib"
check_dir "hooks"
check_dir "stores"
check_dir "types"
check_dir "public"
echo ""

echo "🎯 Core Pages"
echo "------------"
check_file "app/page.tsx"
check_file "app/layout.tsx"
check_file "app/manifest.ts"
check_file "app/scan/page.tsx"
check_file "app/[venueSlug]/page.tsx"
check_file "app/offline/page.tsx"
echo ""

echo "🔧 Hooks"
echo "-------"
check_file "hooks/useCart.ts"
check_file "hooks/useHaptics.ts"
check_file "hooks/useViewTransition.ts"
echo ""

echo "🧩 Components"
echo "------------"
check_file "components/menu/MenuContent.tsx"
check_file "components/menu/MenuSkeleton.tsx"
check_file "components/menu/VirtualizedMenuList.tsx"
check_file "components/menu/CategoryTabs.tsx"
check_file "components/layout/BottomNav.tsx"
check_file "components/layout/CartFab.tsx"
check_file "components/venue/VenueHeader.tsx"
check_file "components/ui/PullToRefresh.tsx"
echo ""

echo "📦 Stores"
echo "--------"
check_file "stores/cart.ts"
check_file "stores/cart.store.ts"
echo ""

echo "📚 Libraries"
echo "-----------"
check_file "lib/haptics.ts"
check_file "lib/view-transitions.ts"
check_file "lib/push-notifications.ts"
check_file "lib/recommendations.ts"
check_file "lib/manager-sync.ts"
check_file "lib/whatsapp-bridge.ts"
check_file "lib/utils.ts"
echo ""

echo "🎨 Types"
echo "-------"
check_file "types/menu.ts"
check_file "types/venue.ts"
echo ""

echo "⚙️  Configuration"
echo "----------------"
check_file "package.json"
check_file "tsconfig.json"
check_file "next.config.js"
check_file "tailwind.config.ts"
echo ""

echo "📖 Documentation"
echo "---------------"
check_file "README.md"
check_file "PWA_FEATURES.md"
check_file "SETUP_CHECKLIST.md"
check_file "IMPLEMENTATION_FINAL.md"
echo ""

echo "🔍 Dependencies Check"
echo "-------------------"
if [ -f "package.json" ]; then
  deps=(
    "zustand"
    "immer"
    "framer-motion"
    "@tanstack/react-query"
    "@tanstack/react-virtual"
    "@supabase/supabase-js"
  )
  
  for dep in "${deps[@]}"; do
    if grep -q "\"$dep\"" package.json; then
      echo -e "${GREEN}✓${NC} $dep"
    else
      echo -e "${YELLOW}?${NC} $dep (not found in package.json)"
    fi
  done
fi
echo ""

echo "🎉 VERIFICATION COMPLETE"
echo "======================="
echo ""
echo "Next steps:"
echo "1. Run: pnpm install"
echo "2. Run: pnpm dev"
echo "3. Visit: http://localhost:3002"
echo "4. Test PWA features in Chrome DevTools"
echo ""
