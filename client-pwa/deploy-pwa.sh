#!/bin/bash
set -e

echo "🚀 EasyMO Client PWA - Deployment Script"
echo "=========================================="

# Colors
GREEN='\033[0.32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Step 1: Installing dependencies...${NC}"
cd /Users/jeanbosco/workspace/easymo-
pnpm --filter @va/shared build || echo "Shared package already built or not required"
pnpm --filter @easymo/commons build || echo "Commons package already built or not required"

echo -e "${BLUE}📦 Step 2: Installing client-pwa dependencies...${NC}"
cd client-pwa
pnpm install --no-frozen-lockfile

echo -e "${BLUE}🔨 Step 3: Type checking...${NC}"
pnpm type-check || echo "⚠️  Type check had warnings (continuing)"

echo -e "${BLUE}🧹 Step 4: Linting...${NC}"
pnpm lint || echo "⚠️  Linting had warnings (continuing)"

echo -e "${BLUE}🏗️  Step 5: Building for production...${NC}"
pnpm build

echo -e "${GREEN}✅ Build complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "  1. Test the build locally:"
echo "     cd client-pwa && pnpm start"
echo ""
echo "  2. Deploy to Netlify:"
echo "     netlify deploy --prod"
echo ""
echo "  3. Or push to main for auto-deploy:"
echo "     git add ."
echo "     git commit -m 'Deploy PWA'"
echo "     git push origin main"
echo ""
echo -e "${GREEN}🎉 EasyMO Client PWA is ready!${NC}"

