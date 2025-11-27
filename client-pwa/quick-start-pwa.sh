#!/usr/bin/env bash

# EasyMO Client PWA - Quick Implementation Script
# Automates directory creation and provides file templates

set -e

echo "🚀 EasyMO Client PWA - Implementation Helper"
echo "============================================"
echo ""

cd /Users/jeanbosco/workspace/easymo-/client-pwa

# Step 1: Create directories
echo "📁 Creating directory structure..."
mkdir -p "app/[venueSlug]/cart"
mkdir -p "app/[venueSlug]/checkout"
mkdir -p "app/[venueSlug]/order/[orderId]"
mkdir -p "app/api/order/create"
mkdir -p "app/api/order/[orderId]"
mkdir -p "app/api/payment/momo/initiate"
mkdir -p "app/api/payment/revolut/create"
mkdir -p "app/api/payment/revolut/webhook"
mkdir -p "lib/payment"
mkdir -p "components/payment"
mkdir -p "components/checkout"
mkdir -p "components/order"
echo "✅ Directories created"
echo ""

# Step 2: Show status
echo "📊 Current Status:"
echo "  ✅ Directories: Created"
echo "  ⏳ Pages: Need to copy from IMPLEMENTATION_MANUAL_GUIDE.md"
echo "  ⏳ API Routes: Need to copy from API_ROUTES_COMPLETE.md"
echo "  ⏳ Payment Components: Need to copy from API_ROUTES_COMPLETE.md"
echo ""

# Step 3: Show next steps
echo "📋 Next Steps:"
echo ""
echo "1. Copy Page Files (4 files):"
echo "   - Open: IMPLEMENTATION_MANUAL_GUIDE.md"
echo "   - Copy code for: app/[venueSlug]/page.tsx"
echo "   - Copy code for: app/[venueSlug]/cart/page.tsx"
echo "   - Copy code for: app/[venueSlug]/checkout/page.tsx"
echo "   - Copy code for: app/[venueSlug]/order/[orderId]/page.tsx"
echo ""

echo "2. Copy API Routes (5 files):"
echo "   - Open: API_ROUTES_COMPLETE.md"
echo "   - Copy FILE 1: app/api/order/create/route.ts"
echo "   - Copy FILE 2: app/api/order/[orderId]/route.ts"
echo "   - Copy FILE 3: app/api/payment/momo/initiate/route.ts"
echo "   - Copy FILE 4: app/api/payment/revolut/create/route.ts"
echo "   - Copy FILE 5: app/api/payment/revolut/webhook/route.ts"
echo ""

echo "3. Copy Payment Files (4 files):"
echo "   - Copy FILE 6: lib/payment/momo.ts"
echo "   - Copy FILE 7: lib/payment/revolut.ts"
echo "   - Copy FILE 8: components/payment/MoMoPayment.tsx"
echo "   - Copy FILE 9: components/payment/RevolutPayment.tsx"
echo ""

echo "4. Apply Database Migration:"
echo "   cd /Users/jeanbosco/workspace/easymo-"
echo "   supabase db push"
echo ""

echo "5. Test Locally:"
echo "   cd /Users/jeanbosco/workspace/easymo-/client-pwa"
echo "   pnpm dev"
echo "   # Visit: http://localhost:3002/heaven-bar?table=5"
echo ""

echo "6. Build & Deploy:"
echo "   pnpm build"
echo "   netlify deploy --prod"
echo ""

# Step 4: Create a checklist file
cat > IMPLEMENTATION_CHECKLIST.txt << 'EOF'
EasyMO Client PWA - Implementation Checklist
===========================================

[ ] Directories created (run ./quick-start-pwa.sh)

PAGES (4 files):
[ ] app/[venueSlug]/page.tsx
[ ] app/[venueSlug]/cart/page.tsx  
[ ] app/[venueSlug]/checkout/page.tsx
[ ] app/[venueSlug]/order/[orderId]/page.tsx

API ROUTES (5 files):
[ ] app/api/order/create/route.ts
[ ] app/api/order/[orderId]/route.ts
[ ] app/api/payment/momo/initiate/route.ts
[ ] app/api/payment/revolut/create/route.ts
[ ] app/api/payment/revolut/webhook/route.ts

PAYMENT (4 files):
[ ] lib/payment/momo.ts
[ ] lib/payment/revolut.ts
[ ] components/payment/MoMoPayment.tsx
[ ] components/payment/RevolutPayment.tsx

DATABASE:
[ ] Run: supabase db push
[ ] Verify seed data loaded

TESTING:
[ ] pnpm dev (local server starts)
[ ] Visit /heaven-bar?table=5
[ ] Add items to cart
[ ] Checkout flow works
[ ] Order tracking works

BUILD:
[ ] pnpm type-check (no errors)
[ ] pnpm lint (acceptable warnings)
[ ] pnpm build (successful)

DEPLOYMENT:
[ ] Environment vars set in Netlify
[ ] netlify deploy --prod
[ ] Test production URL
[ ] PWA installable on mobile

REFERENCE FILES:
- IMPLEMENTATION_MANUAL_GUIDE.md (page code)
- API_ROUTES_COMPLETE.md (API & payment code)  
- DEPLOYMENT_PACKAGE.md (full guide)
- This checklist

TOTAL TIME ESTIMATE: 2-3 hours
EOF

echo "✅ Created: IMPLEMENTATION_CHECKLIST.txt"
echo ""

echo "🎯 Ready to proceed!"
echo ""
echo "Open these files in your editor:"
echo "  1. IMPLEMENTATION_MANUAL_GUIDE.md"
echo "  2. API_ROUTES_COMPLETE.md"
echo "  3. IMPLEMENTATION_CHECKLIST.txt (track progress)"
echo ""
echo "Start copying code → Test → Deploy 🚀"
