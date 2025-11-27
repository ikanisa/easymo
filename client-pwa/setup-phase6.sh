#!/bin/bash
set -e

# 🎯 CLIENT PWA - PHASE 6: CORE PAGES IMPLEMENTATION
# Creates the 4 critical dynamic route pages

echo "🚀 Starting Phase 6: Core Pages Implementation"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_DIR="/Users/jeanbosco/workspace/easymo-/client-pwa"

echo -e "${BLUE}📁 Creating directory structure...${NC}"

# Create dynamic route directories
mkdir -p "$BASE_DIR/app/[venueSlug]"
mkdir -p "$BASE_DIR/app/[venueSlug]/cart"
mkdir -p "$BASE_DIR/app/[venueSlug]/checkout"
mkdir -p "$BASE_DIR/app/[venueSlug]/order/[orderId]"

# Create API directories
mkdir -p "$BASE_DIR/app/api/venue/[slug]"
mkdir -p "$BASE_DIR/app/api/menu"
mkdir -p "$BASE_DIR/app/api/order/create"
mkdir -p "$BASE_DIR/app/api/order/[orderId]"
mkdir -p "$BASE_DIR/app/api/payment/revolut/create"
mkdir -p "$BASE_DIR/app/api/payment/revolut/webhook"

# Create component directories (if missing)
mkdir -p "$BASE_DIR/components/venue"
mkdir -p "$BASE_DIR/components/layout"
mkdir -p "$BASE_DIR/components/order"
mkdir -p "$BASE_DIR/components/checkout"
mkdir -p "$BASE_DIR/components/ui"

# Create types directory
mkdir -p "$BASE_DIR/types"

echo -e "${GREEN}✅ Directories created${NC}"
echo ""

echo -e "${BLUE}📝 Directory structure ready:${NC}"
echo "  app/"
echo "    [venueSlug]/"
echo "      ├── page.tsx          (Venue Menu)"
echo "      ├── cart/"
echo "      │   └── page.tsx      (Shopping Cart)"
echo "      ├── checkout/"
echo "      │   └── page.tsx      (Checkout)"
echo "      └── order/"
echo "          └── [orderId]/"
echo "              └── page.tsx  (Order Tracking)"
echo ""
echo "  app/api/"
echo "    ├── venue/[slug]/route.ts"
echo "    ├── menu/route.ts"
echo "    ├── order/"
echo "    │   ├── create/route.ts"
echo "    │   └── [orderId]/route.ts"
echo "    └── payment/revolut/"
echo "        ├── create/route.ts"
echo "        └── webhook/route.ts"
echo ""

echo -e "${YELLOW}⏳ Next Steps:${NC}"
echo ""
echo "1️⃣  Implement the 4 core pages"
echo "2️⃣  Create the 6 API routes"
echo "3️⃣  Build missing components"
echo "4️⃣  Test the complete flow"
echo ""
echo -e "${GREEN}✨ Phase 6 setup complete!${NC}"
echo ""
echo "Ready to create the actual page files."
echo "Run the implementation to proceed."
