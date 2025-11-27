#!/bin/bash

# Waiter AI PWA - Quick Deployment Script
# This script deploys the Waiter AI PWA to Vercel

set -e

echo "🍽️  Waiter AI - Quick Deployment Script"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to waiter-pwa directory
cd "$(dirname "$0")/waiter-pwa" || exit 1

echo -e "${YELLOW}📁 Working directory: $(pwd)${NC}"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
    echo -e "${GREEN}✅ Vercel CLI installed${NC}"
    echo ""
fi

# Check environment variables
echo -e "${YELLOW}🔍 Checking environment variables...${NC}"
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}⚠️  .env.local not found!${NC}"
    echo "Please create .env.local with required variables:"
    echo "  NEXT_PUBLIC_SUPABASE_URL=..."
    echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=..."
    echo "  NEXT_PUBLIC_RESTAURANT_ID=..."
    exit 1
fi
echo -e "${GREEN}✅ Environment file found${NC}"
echo ""

# Run build first to catch any errors
echo -e "${YELLOW}🔨 Building project...${NC}"
pnpm build
echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Deploy to Vercel
echo -e "${YELLOW}🚀 Deploying to Vercel...${NC}"
echo ""

vercel --prod

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "  1. Visit the deployment URL provided above"
echo "  2. Test the PWA thoroughly"
echo "  3. Set up custom domain (optional)"
echo "  4. Monitor analytics in Vercel dashboard"
echo ""
echo "📚 Documentation:"
echo "  - WAITER_AI_DEPLOYMENT_READY.md"
echo "  - WAITER_AI_QUICK_REFERENCE.md"
echo ""
echo "🎉 Happy deploying!"
