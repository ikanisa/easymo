#!/bin/bash
set -e

# EasyMO Admin PWA - Cloudflare Pages Deployment Script
# Usage: ./deploy-cloudflare.sh [production|preview]

ENVIRONMENT=${1:-production}
PROJECT_NAME="easymo-admin-${ENVIRONMENT}"

echo "🚀 Deploying EasyMO Admin PWA to Cloudflare Pages"
echo "Environment: ${ENVIRONMENT}"
echo "Project: ${PROJECT_NAME}"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler CLI not found"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

# Check if logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "❌ Error: Not logged in to Cloudflare"
    echo "Run: wrangler login"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Navigate to monorepo root
cd "$(dirname "$0")/.."

echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

echo "🔨 Building shared packages..."
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm --filter @easymo/ui build

echo "🔨 Building admin app for Cloudflare Pages..."
cd admin-app
npm run pages:build

echo "📤 Deploying to Cloudflare Pages..."
wrangler pages deploy .vercel/output/static --project-name="${PROJECT_NAME}"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your PWA is now live at:"
echo "   https://${PROJECT_NAME}.pages.dev"
echo ""
echo "📊 View deployment details:"
echo "   https://dash.cloudflare.com/pages"
