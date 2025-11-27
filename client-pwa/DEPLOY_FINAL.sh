#!/bin/bash

# EasyMO Client PWA - Final Deployment Script
# This script handles the complete deployment process to Netlify

set -e  # Exit on error

echo "🚀 EasyMO Client PWA Deployment"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check dependencies
echo -e "${BLUE}Step 1: Checking dependencies...${NC}"
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}pnpm not found. Installing...${NC}"
    npm install -g pnpm@10.18.3
fi

if ! command -v netlify &> /dev/null; then
    echo -e "${YELLOW}Netlify CLI not found. Installing...${NC}"
    npm install -g netlify-cli
fi

echo -e "${GREEN}✓ Dependencies checked${NC}"
echo ""

# Step 2: Navigate to client-pwa directory
echo -e "${BLUE}Step 2: Navigating to client-pwa directory...${NC}"
cd "$(dirname "$0")"
echo -e "${GREEN}✓ In directory: $(pwd)${NC}"
echo ""

# Step 3: Install dependencies
echo -e "${BLUE}Step 3: Installing project dependencies...${NC}"
pnpm install --frozen-lockfile
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 4: Type check
echo -e "${BLUE}Step 4: Running type check...${NC}"
pnpm type-check
echo -e "${GREEN}✓ Type check passed${NC}"
echo ""

# Step 5: Build the project
echo -e "${BLUE}Step 5: Building the project...${NC}"
pnpm build
echo -e "${GREEN}✓ Build completed${NC}"
echo ""

# Step 6: Check if Netlify is logged in
echo -e "${BLUE}Step 6: Checking Netlify authentication...${NC}"
if ! netlify status &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Netlify. Please login:${NC}"
    netlify login
fi
echo -e "${GREEN}✓ Netlify authenticated${NC}"
echo ""

# Step 7: Deploy to Netlify
echo -e "${BLUE}Step 7: Deploying to Netlify...${NC}"
echo -e "${YELLOW}Choose deployment option:${NC}"
echo "1) Deploy to production (--prod)"
echo "2) Deploy to preview/draft"
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    echo -e "${BLUE}Deploying to PRODUCTION...${NC}"
    netlify deploy --prod --dir=.next
else
    echo -e "${BLUE}Deploying to PREVIEW...${NC}"
    netlify deploy --dir=.next
fi

echo ""
echo -e "${GREEN}✓ Deployment complete!${NC}"
echo ""

# Step 8: Post-deployment info
echo "================================"
echo -e "${GREEN}🎉 Deployment Successful!${NC}"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Test the deployed site on mobile devices"
echo "2. Try 'Add to Home Screen' feature"
echo "3. Verify QR code scanning works"
echo "4. Test cart and checkout flow"
echo "5. Check Supabase integration"
echo ""
echo "Monitor deployment:"
echo "- Netlify Dashboard: https://app.netlify.com"
echo "- Check build logs for any warnings"
echo ""
echo "Performance testing:"
echo "- Run Lighthouse audit on deployed URL"
echo "- Target: Performance 95+, PWA 100"
echo ""
echo -e "${BLUE}Happy deploying! 🚀${NC}"
