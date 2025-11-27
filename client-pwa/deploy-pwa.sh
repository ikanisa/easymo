#!/bin/bash
# Client PWA Complete Deployment Script

set -e

echo "🚀 EasyMO Client PWA - Production Deployment"
echo "============================================="
echo ""

# Colors
GREEN='\033[0.32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Environment Check
echo -e "${YELLOW}Step 1: Checking environment...${NC}"
if [ ! -f ".env.local" ]; then
    echo -e "${RED}❌ Error: .env.local not found${NC}"
    echo "Create .env.local with:"
    echo "  NEXT_PUBLIC_SUPABASE_URL=your_url"
    echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key"
    exit 1
fi
echo -e "${GREEN}✅ Environment configured${NC}"
echo ""

# Step 2: Install Dependencies
echo -e "${YELLOW}Step 2: Installing dependencies...${NC}"
pnpm install
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 3: Type Check
echo -e "${YELLOW}Step 3: Running type check...${NC}"
pnpm type-check
echo -e "${GREEN}✅ Type check passed${NC}"
echo ""

# Step 4: Lint
echo -e "${YELLOW}Step 4: Running linter...${NC}"
pnpm lint --max-warnings=0
echo -e "${GREEN}✅ Linting passed${NC}"
echo ""

# Step 5: Build
echo -e "${YELLOW}Step 5: Building for production...${NC}"
pnpm build
echo -e "${GREEN}✅ Build complete${NC}"
echo ""

# Step 6: Netlify Deploy
echo -e "${YELLOW}Step 6: Deploying to Netlify...${NC}"
if ! command -v netlify &> /dev/null; then
    echo -e "${RED}❌ Netlify CLI not installed${NC}"
    echo "Install with: npm install -g netlify-cli"
    exit 1
fi

netlify deploy --prod --dir=.next

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo "Next steps:"
echo "1. Test PWA installation on mobile"
echo "2. Verify all features work in production"
echo "3. Monitor error tracking and analytics"
echo ""
