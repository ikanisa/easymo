#!/bin/bash

# EasyMO Client PWA - Quick Deploy Script
# This script deploys the Client PWA to Netlify

set -e

echo "🚀 EasyMO Client PWA - Deployment Script"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: package.json not found${NC}"
  echo "Please run this script from the client-pwa directory"
  exit 1
fi

echo -e "${YELLOW}📦 Step 1: Installing dependencies...${NC}"
pnpm install --frozen-lockfile

echo ""
echo -e "${YELLOW}🔍 Step 2: Type checking...${NC}"
pnpm type-check

echo ""
echo -e "${YELLOW}🔨 Step 3: Building production bundle...${NC}"
pnpm build

echo ""
echo -e "${GREEN}✅ Build successful!${NC}"
echo ""
echo -e "${YELLOW}📊 Build Statistics:${NC}"
du -sh .next
echo ""

echo -e "${YELLOW}🌐 Step 4: Deploying to Netlify...${NC}"
echo ""

# Check if netlify-cli is installed
if ! command -v netlify &> /dev/null; then
  echo -e "${YELLOW}⚠️  Netlify CLI not found. Installing...${NC}"
  npm install -g netlify-cli
fi

# Check if user is logged in
if ! netlify status &> /dev/null; then
  echo -e "${YELLOW}🔐 Please login to Netlify:${NC}"
  netlify login
fi

echo ""
echo -e "${YELLOW}Choose deployment option:${NC}"
echo "1) Deploy to production (--prod)"
echo "2) Deploy to preview (draft)"
read -p "Enter choice [1-2]: " choice

case $choice in
  1)
    echo ""
    echo -e "${YELLOW}🚀 Deploying to PRODUCTION...${NC}"
    netlify deploy --prod
    ;;
  2)
    echo ""
    echo -e "${YELLOW}🚀 Deploying to PREVIEW...${NC}"
    netlify deploy
    ;;
  *)
    echo -e "${RED}❌ Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${YELLOW}📱 Next Steps:${NC}"
echo "1. Test the deployed site on mobile devices"
echo "2. Add to home screen and test PWA features"
echo "3. Verify QR scanner, cart, and payment flows"
echo "4. Check Lighthouse scores (target: 95+)"
echo ""
echo -e "${GREEN}🎉 Happy testing!${NC}"
