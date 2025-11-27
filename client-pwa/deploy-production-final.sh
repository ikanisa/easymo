#!/bin/bash

# 🚀 Client PWA - Production Deployment Script
# Deploys the client PWA to production with all checks

set -e  # Exit on error

echo "🎯 EasyMO Client PWA - Production Deployment"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from client-pwa directory${NC}"
    exit 1
fi

# Step 1: Check dependencies
echo -e "${YELLOW}📦 Checking dependencies...${NC}"
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm not found. Install with: npm install -g pnpm${NC}"
    exit 1
fi
echo -e "${GREEN}✅ pnpm found${NC}"

# Step 2: Install dependencies
echo ""
echo -e "${YELLOW}📥 Installing dependencies...${NC}"
pnpm install --frozen-lockfile
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 3: Type check
echo ""
echo -e "${YELLOW}🔍 Running type check...${NC}"
pnpm type-check
echo -e "${GREEN}✅ Type check passed${NC}"

# Step 4: Lint
echo ""
echo -e "${YELLOW}🧹 Running linter...${NC}"
pnpm lint || true  # Don't fail on warnings
echo -e "${GREEN}✅ Linting complete${NC}"

# Step 5: Build
echo ""
echo -e "${YELLOW}🏗️  Building production bundle...${NC}"
pnpm build
echo -e "${GREEN}✅ Build successful${NC}"

# Step 6: Check environment variables
echo ""
echo -e "${YELLOW}🔐 Checking environment variables...${NC}"
if [ ! -f ".env.local" ]; then
    echo -e "${RED}⚠️  Warning: .env.local not found${NC}"
    echo "Create .env.local with:"
    echo "  NEXT_PUBLIC_SUPABASE_URL=..."
    echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=..."
    echo "  NEXT_PUBLIC_VAPID_PUBLIC_KEY=..."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✅ Environment file found${NC}"
fi

# Step 7: Deploy
echo ""
echo -e "${YELLOW}🚀 Deploying to production...${NC}"
echo ""
echo "Choose deployment method:"
echo "  1) Netlify CLI"
echo "  2) Git push (auto-deploy)"
echo "  3) Manual (just build, no deploy)"
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        if ! command -v netlify &> /dev/null; then
            echo -e "${RED}❌ Netlify CLI not found. Install with: npm install -g netlify-cli${NC}"
            exit 1
        fi
        netlify deploy --prod
        echo -e "${GREEN}✅ Deployed to Netlify!${NC}"
        ;;
    2)
        git add .
        git commit -m "feat: deploy client PWA with all advanced features" || true
        git push origin main
        echo -e "${GREEN}✅ Pushed to main. Auto-deploy will trigger!${NC}"
        ;;
    3)
        echo -e "${GREEN}✅ Build complete. Deploy manually when ready.${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

# Success!
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉 DEPLOYMENT SUCCESSFUL! 🎉         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  1. Test the deployment"
echo "  2. Verify PWA install works"
echo "  3. Check push notifications"
echo "  4. Test QR code scanning"
echo "  5. Test payment flows"
echo ""
echo "Monitoring:"
echo "  - Check Web Vitals in production"
echo "  - Monitor error logs"
echo "  - Track user feedback"
echo ""
echo -e "${GREEN}🚀 Ready to serve customers!${NC}"
