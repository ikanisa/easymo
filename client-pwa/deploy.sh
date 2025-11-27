#!/bin/bash
set -e

echo "🚀 EasyMO Client PWA - Netlify Deployment"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from client-pwa directory"
  exit 1
fi

# Check for Netlify CLI
if ! command -v netlify &> /dev/null; then
  echo "📦 Installing Netlify CLI..."
  npm install -g netlify-cli
fi

# Check environment variables
if [ ! -f ".env.local" ]; then
  echo "⚠️  Warning: .env.local not found"
  echo "   Make sure to set environment variables in Netlify Dashboard"
fi

echo ""
echo "🔨 Building PWA..."
pnpm build

echo ""
echo "📤 Deploying to Netlify..."
echo "   (You'll be prompted to login if not already authenticated)"
echo ""

# Deploy
netlify deploy --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Post-deployment checklist:"
echo "   1. Set environment variables in Netlify Dashboard"
echo "   2. Test PWA installation on mobile device"
echo "   3. Verify Supabase connection"
echo "   4. Run Lighthouse audit"
echo ""
echo "See DEPLOY.md for full deployment guide"
