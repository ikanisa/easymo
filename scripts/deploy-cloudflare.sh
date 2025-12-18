#!/bin/bash
# EasyMO Cloudflare Pages Deployment Script
# Deploys Admin Panel PWA
# Internal use only - not for public deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 EasyMO Cloudflare Deployment"
echo "================================"

# Check for wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Install with: npm install -g wrangler"
    exit 1
fi

# Check authentication
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not authenticated. Run: wrangler login"
    exit 1
fi

deploy_admin() {
    echo ""
    echo "📦 Building Admin Panel..."
    cd "$ROOT_DIR/admin-app"
    pnpm install
    pnpm pages:build
    
    echo "🚀 Deploying Admin Panel to Cloudflare Pages..."
    pnpm pages:deploy
    echo "✅ Admin Panel deployed!"
}

case "${1:-admin}" in
    admin)
        deploy_admin
        ;;
    *)
        echo "Usage: $0 [admin]"
        echo "  admin  - Deploy Admin Panel (default)"
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Configure environment variables in Cloudflare Dashboard"
echo "2. Set up Cloudflare Access for internal-only access"
echo "3. Test the deployments"
