#!/bin/bash

# ========================================
# Client PWA - Production Deployment
# ========================================

set -e

echo "🚀 Starting Client PWA Production Deployment..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Verify we're in the right directory
if [ ! -f "package.json" ]; then
    echo "${RED}❌ Error: package.json not found. Run this script from client-pwa directory${NC}"
    exit 1
fi

echo "${BLUE}📦 Step 1: Installing dependencies...${NC}"
pnpm install --frozen-lockfile

# Step 2: Environment check
echo ""
echo "${BLUE}🔐 Step 2: Checking environment variables...${NC}"

if [ ! -f ".env.local" ]; then
    echo "${RED}⚠️  Warning: .env.local not found. Using .env.example${NC}"
    cp .env.example .env.local
fi

# Required env vars
required_vars=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "NEXT_PUBLIC_SITE_URL"
)

for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env.local 2>/dev/null; then
        echo "${RED}❌ Missing required env var: ${var}${NC}"
        exit 1
    fi
done

echo "${GREEN}✅ Environment variables verified${NC}"

# Step 3: Type checking
echo ""
echo "${BLUE}🔍 Step 3: Type checking...${NC}"
pnpm type-check

# Step 4: Linting
echo ""
echo "${BLUE}✨ Step 4: Linting code...${NC}"
pnpm lint --max-warnings=0

# Step 5: Build
echo ""
echo "${BLUE}🏗️  Step 5: Building production bundle...${NC}"
pnpm build

# Step 6: Analyze bundle (optional)
echo ""
echo "${BLUE}📊 Step 6: Analyzing bundle size...${NC}"
if command -v next &> /dev/null; then
    npx next-bundle-analyzer || true
fi

# Step 7: Deploy to Netlify
echo ""
echo "${BLUE}🌐 Step 7: Deploying to Netlify...${NC}"

if ! command -v netlify &> /dev/null; then
    echo "${RED}❌ Netlify CLI not found. Installing...${NC}"
    npm install -g netlify-cli
fi

# Check if Netlify is linked
if [ ! -f ".netlify/state.json" ]; then
    echo "${BLUE}🔗 Linking to Netlify site...${NC}"
    netlify link
fi

# Deploy
echo "${BLUE}🚢 Deploying to production...${NC}"
netlify deploy --prod --dir=.next

# Step 8: Post-deployment checks
echo ""
echo "${BLUE}🔬 Step 8: Running post-deployment checks...${NC}"

# Get the deployed URL
DEPLOY_URL=$(netlify status --json | grep -o '"url":"[^"]*' | grep -o '[^"]*$')

if [ -n "$DEPLOY_URL" ]; then
    echo ""
    echo "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "🌍 Live URL: ${BLUE}${DEPLOY_URL}${NC}"
    echo ""
    
    # Check if site is accessible
    if command -v curl &> /dev/null; then
        HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}" "${DEPLOY_URL}")
        if [ "$HTTP_CODE" -eq 200 ]; then
            echo "${GREEN}✅ Site is accessible (HTTP ${HTTP_CODE})${NC}"
        else
            echo "${RED}⚠️  Site returned HTTP ${HTTP_CODE}${NC}"
        fi
    fi
    
    # Run Lighthouse audit (if available)
    if command -v lighthouse &> /dev/null; then
        echo ""
        echo "${BLUE}🔍 Running Lighthouse audit...${NC}"
        lighthouse "${DEPLOY_URL}" --output=json --output-path=./lighthouse-report.json --quiet || true
    fi
else
    echo "${RED}❌ Could not determine deployment URL${NC}"
    exit 1
fi

# Step 9: Git tag
echo ""
echo "${BLUE}🏷️  Step 9: Creating git tag...${NC}"
VERSION=$(node -p "require('./package.json').version")
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TAG="v${VERSION}-${TIMESTAMP}"

read -p "Create git tag ${TAG}? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git tag -a "${TAG}" -m "Production deployment ${TIMESTAMP}"
    git push origin "${TAG}"
    echo "${GREEN}✅ Tag ${TAG} created and pushed${NC}"
fi

# Final summary
echo ""
echo "${GREEN}═══════════════════════════════════════${NC}"
echo "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "📱 Client PWA: ${BLUE}${DEPLOY_URL}${NC}"
echo "📊 Version: ${BLUE}${VERSION}${NC}"
echo "🏷️  Tag: ${BLUE}${TAG}${NC}"
echo ""
echo "Next steps:"
echo "  1. Test all features on live site"
echo "  2. Verify push notifications"
echo "  3. Test payment integrations"
echo "  4. Monitor error tracking (Sentry)"
echo "  5. Check analytics dashboard"
echo ""
echo "${GREEN}Happy deploying! 🚀${NC}"
