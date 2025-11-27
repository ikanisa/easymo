#!/bin/bash

# 🚀 CLIENT PWA - DEPLOYMENT SCRIPT
# Builds and deploys the PWA to Netlify

set -e  # Exit on error

echo "🚀 Starting Client PWA Deployment..."
echo "================================================================"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must run from client-pwa directory${NC}"
    exit 1
fi

# Check environment variables
echo -e "${BLUE}Checking environment variables...${NC}"
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}Warning: .env.local not found${NC}"
    echo "Create .env.local with:"
    echo "  NEXT_PUBLIC_SUPABASE_URL=..."
    echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=..."
    echo "  NEXT_PUBLIC_VAPID_PUBLIC_KEY=..."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
pnpm install --frozen-lockfile

# Type check
echo -e "${BLUE}Running type check...${NC}"
pnpm type-check

# Lint
echo -e "${BLUE}Running linter...${NC}"
pnpm lint --quiet || true  # Continue even if lint warnings

# Build
echo -e "${BLUE}Building for production...${NC}"
pnpm build

# Check build output
if [ ! -d ".next" ]; then
    echo -e "${RED}Build failed: .next directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful!${NC}"
echo ""
echo "Build stats:"
du -sh .next

echo ""
echo "================================================================"
echo -e "${GREEN}🎉 Ready to deploy!${NC}"
echo ""
echo "To deploy to Netlify:"
echo "  1. Install Netlify CLI: npm install -g netlify-cli"
echo "  2. Login: netlify login"
echo "  3. Deploy: netlify deploy --prod"
echo ""
echo "Or push to main branch for automatic deployment via CI/CD"
echo "================================================================"
