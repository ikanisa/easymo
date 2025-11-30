#!/bin/bash
#
# Netlify Deployment Script for EasyMO Admin App
# Usage: ./deploy-netlify.sh [production|preview]
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ADMIN_APP_DIR="admin-app"
DEPLOY_TYPE="${1:-preview}"

echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  EasyMO Admin App - Netlify Deployment          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo -e "${RED}❌ Netlify CLI not found${NC}"
    echo -e "${YELLOW}Installing Netlify CLI...${NC}"
    npm install -g netlify-cli
fi

# Check if we're in the right directory
if [ ! -d "$ADMIN_APP_DIR" ]; then
    echo -e "${RED}❌ Error: admin-app directory not found${NC}"
    echo -e "${YELLOW}Please run this script from the repository root${NC}"
    exit 1
fi

cd "$ADMIN_APP_DIR"

echo -e "${BLUE}📋 Pre-deployment Checklist${NC}"
echo ""

# Step 1: Check Node version
REQUIRED_NODE_VERSION="20.18.0"
CURRENT_NODE_VERSION=$(node --version | sed 's/v//')
echo -e "${YELLOW}1/7${NC} Checking Node.js version..."
if [[ "$CURRENT_NODE_VERSION" == "$REQUIRED_NODE_VERSION"* ]]; then
    echo -e "${GREEN}   ✓ Node.js $CURRENT_NODE_VERSION${NC}"
else
    echo -e "${RED}   ✗ Node.js version mismatch${NC}"
    echo -e "${YELLOW}   Expected: $REQUIRED_NODE_VERSION, Found: $CURRENT_NODE_VERSION${NC}"
    exit 1
fi

# Step 2: Install dependencies
echo -e "${YELLOW}2/7${NC} Installing dependencies..."
npm ci --prefer-offline --no-audit > /dev/null 2>&1
echo -e "${GREEN}   ✓ Dependencies installed${NC}"

# Step 3: Type check
echo -e "${YELLOW}3/7${NC} Running type check..."
if npm run typecheck > /dev/null 2>&1; then
    echo -e "${GREEN}   ✓ Type check passed${NC}"
else
    echo -e "${RED}   ✗ Type check failed${NC}"
    echo -e "${YELLOW}   Run 'npm run typecheck' for details${NC}"
    exit 1
fi

# Step 4: Lint
echo -e "${YELLOW}4/7${NC} Running linter..."
if npm run lint > /dev/null 2>&1; then
    echo -e "${GREEN}   ✓ Linting passed${NC}"
else
    echo -e "${YELLOW}   ⚠ Linting warnings (non-blocking)${NC}"
fi

# Step 5: Security check
echo -e "${YELLOW}5/7${NC} Running security check..."
if grep -r "SERVICE_ROLE" .env* 2>/dev/null | grep -q "NEXT_PUBLIC"; then
    echo -e "${RED}   ✗ SECURITY VIOLATION: Service role in NEXT_PUBLIC_* variable${NC}"
    exit 1
else
    echo -e "${GREEN}   ✓ Security check passed${NC}"
fi

# Step 6: Build
echo -e "${YELLOW}6/7${NC} Building application..."
if npm run build > /tmp/build.log 2>&1; then
    BUILD_SIZE=$(du -sh .next 2>/dev/null | cut -f1 || echo "N/A")
    echo -e "${GREEN}   ✓ Build completed (Size: $BUILD_SIZE)${NC}"
else
    echo -e "${RED}   ✗ Build failed${NC}"
    echo -e "${YELLOW}   Last 10 lines of build log:${NC}"
    tail -10 /tmp/build.log
    exit 1
fi

# Step 7: Deploy
echo -e "${YELLOW}7/7${NC} Deploying to Netlify..."
echo ""

if [ "$DEPLOY_TYPE" == "production" ]; then
    echo -e "${RED}🚀 Deploying to PRODUCTION${NC}"
    echo -e "${YELLOW}   Are you sure? (y/N)${NC}"
    read -r confirmation
    
    if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}   Deployment cancelled${NC}"
        exit 0
    fi
    
    DEPLOY_CMD="netlify deploy --prod --dir=.next"
else
    echo -e "${BLUE}🔍 Deploying PREVIEW${NC}"
    DEPLOY_CMD="netlify deploy --dir=.next"
fi

if $DEPLOY_CMD; then
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ Deployment Successful!                      ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [ "$DEPLOY_TYPE" == "production" ]; then
        echo -e "${GREEN}🌐 Production URL:${NC} https://easymo-admin.netlify.app"
    else
        echo -e "${BLUE}🔗 Preview URL will be shown above${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}📊 Next Steps:${NC}"
    echo -e "   1. Test the deployment"
    echo -e "   2. Verify API endpoints: /api/health"
    echo -e "   3. Check AI features (chat, voice, images)"
    echo -e "   4. Monitor Netlify dashboard for errors"
    
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

# Cleanup
rm -f /tmp/build.log

echo ""
echo -e "${BLUE}Deployment complete at $(date)${NC}"
