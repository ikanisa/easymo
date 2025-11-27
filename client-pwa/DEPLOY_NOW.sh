#!/bin/bash

#################################################
# CLIENT PWA - QUICK DEPLOYMENT SCRIPT
# Deploys to Netlify production
#################################################

set -e  # Exit on error

echo "🚀 CLIENT PWA DEPLOYMENT STARTING..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check we're in the right directory
echo -e "${BLUE}📁 Checking directory...${NC}"
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this from client-pwa directory."
    exit 1
fi
echo -e "${GREEN}✅ Directory OK${NC}"
echo ""

# Step 2: Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
pnpm install --frozen-lockfile
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 3: Type check
echo -e "${BLUE}🔍 Running TypeScript check...${NC}"
pnpm exec tsc --noEmit || {
    echo -e "${YELLOW}⚠️  TypeScript errors detected (continuing anyway)${NC}"
}
echo ""

# Step 4: Lint
echo -e "${BLUE}🧹 Linting code...${NC}"
pnpm lint || {
    echo -e "${YELLOW}⚠️  Lint warnings detected (continuing anyway)${NC}"
}
echo ""

# Step 5: Build
echo -e "${BLUE}🏗️  Building production bundle...${NC}"
pnpm build
echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Step 6: Deploy to Netlify
echo -e "${BLUE}🌐 Deploying to Netlify...${NC}"
netlify deploy --prod --dir=.next
echo ""

echo -e "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo ""
echo "🎉 Your PWA is now live!"
echo ""
echo "Next steps:"
echo "1. Open the Netlify URL"
echo "2. Test on mobile device"
echo "3. Install as PWA"
echo "4. Test all features"
echo ""
echo "📱 Features to test:"
echo "   - QR code scanning"
echo "   - Voice ordering"
echo "   - Haptic feedback"
echo "   - Payment flows"
echo "   - Offline mode"
echo "   - Push notifications"
echo ""
