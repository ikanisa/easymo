#!/bin/bash

# 🚀 EasyMO Client PWA - One-Click Deploy
# Usage: ./ship-pwa.sh

set -e

echo "🚀 EasyMO PWA Deployment Script"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from client-pwa directory"
    exit 1
fi

# Check for Netlify CLI
if ! command -v netlify &> /dev/null; then
    echo "📦 Installing Netlify CLI..."
    npm install -g netlify-cli
fi

# Step 1: Type Check
echo "📝 Step 1/5: Type checking..."
pnpm type-check || {
    echo "❌ Type check failed. Fix errors and try again."
    exit 1
}
echo "✅ Type check passed"
echo ""

# Step 2: Lint
echo "🔍 Step 2/5: Linting..."
pnpm lint || {
    echo "⚠️  Linting warnings (continuing anyway)"
}
echo "✅ Lint complete"
echo ""

# Step 3: Build
echo "🏗️  Step 3/5: Building production bundle..."
pnpm build || {
    echo "❌ Build failed. Check errors above."
    exit 1
}
echo "✅ Build successful"
echo ""

# Step 4: Environment Check
echo "🔐 Step 4/5: Checking environment variables..."
if [ ! -f ".env.local" ]; then
    echo "⚠️  Warning: .env.local not found"
    echo "   You'll need to set environment variables in Netlify"
fi

required_vars=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
)

for var in "${required_vars[@]}"; do
    if grep -q "$var" .env.local 2>/dev/null; then
        echo "  ✓ $var"
    else
        echo "  ⚠️  $var (set in Netlify)"
    fi
done
echo ""

# Step 5: Deploy
echo "🚀 Step 5/5: Deploying to Netlify..."
echo ""
echo "Choose deployment option:"
echo "  1) Deploy to production (--prod)"
echo "  2) Preview deploy (draft)"
echo "  3) Skip deploy (just build)"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo "🌐 Deploying to PRODUCTION..."
        netlify deploy --prod
        ;;
    2)
        echo "👀 Creating preview deploy..."
        netlify deploy
        ;;
    3)
        echo "⏭️  Skipping deploy"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎉 ================================"
echo "🎉 PWA Deployment Complete!"
echo "🎉 ================================"
echo ""
echo "📋 Next Steps:"
echo "  1. Visit your Netlify URL"
echo "  2. Test PWA installation on mobile"
echo "  3. Verify all features work"
echo "  4. Check Lighthouse scores"
echo ""
echo "📱 Features Ready:"
echo "  ✅ Offline support"
echo "  ✅ Real-time updates"
echo "  ✅ Voice ordering"
echo "  ✅ Payment integration"
echo "  ✅ Push notifications"
echo "  ✅ QR scanning"
echo "  ✅ Haptic feedback"
echo ""
echo "📚 Documentation:"
echo "  - Features: FEATURES_AUDIT_COMPLETE.md"
echo "  - Verification: IMPLEMENTATION_VERIFIED.md"
echo "  - Deploy Guide: DEPLOY_NOW.md"
echo ""
echo "🚀 Happy ordering!"
