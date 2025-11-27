#!/bin/bash

# Quick Git Push to Main
# This script commits and pushes the Client PWA to main branch

set -e

echo "📤 Pushing Client PWA to main branch"
echo "===================================="
echo ""

# Navigate to repo root
cd "$(dirname "$0")/.."

echo "Current directory: $(pwd)"
echo ""

# Show status
echo "📋 Current git status:"
git status --short

echo ""
read -p "Proceed with commit and push? (y/n): " confirm

if [ "$confirm" != "y" ]; then
  echo "❌ Aborted"
  exit 0
fi

# Add client-pwa changes
echo ""
echo "➕ Adding client-pwa files..."
git add client-pwa/

# Commit
echo ""
echo "💾 Committing changes..."
git commit -m "feat(client-pwa): Complete PWA implementation - ready for deployment

✅ All 6 phases complete:
- Phase 1: Project setup, dependencies, configuration
- Phase 2: Base UI components (Button, Card, Sheet)
- Phase 3: Menu browsing with categories
- Phase 4: Cart management (Zustand with persistence)
- Phase 5: Payment integration (MoMo USSD + Revolut Link)
- Phase 6: Realtime order tracking, QR scanner, PWA features

🎯 Features implemented:
- Menu browsing with touch-optimized UI
- Category tabs with horizontal scroll
- Cart with drag-to-dismiss bottom sheet
- Order tracking with realtime updates
- Payment flow (MoMo USSD, Revolut Link)
- QR code scanner for table ordering
- PWA manifest and service worker
- Offline menu caching
- Responsive design (mobile-first)
- TypeScript types for all components
- Supabase integration
- Zustand state management

📱 Ready for deployment to Netlify

Deployment instructions: See client-pwa/DEPLOY_NOW.md
"

# Push to main
echo ""
echo "🚀 Pushing to main..."
git push origin main

echo ""
echo "✅ Successfully pushed to main!"
echo ""
echo "📋 Next steps:"
echo "1. cd client-pwa"
echo "2. chmod +x deploy-now.sh"
echo "3. ./deploy-now.sh"
echo ""
echo "Or deploy via Netlify Dashboard (see DEPLOY_NOW.md)"
