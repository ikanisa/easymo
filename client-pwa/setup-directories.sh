#!/bin/sh
# Client PWA - Directory Setup Script
# Run this first before creating files

set -e

echo "🚀 Creating Client PWA directory structure..."

cd "$(dirname "$0")"

# API Routes
echo "📁 Creating API route directories..."
mkdir -p "app/api/venue/[slug]/menu"
mkdir -p "app/api/order/create"
mkdir -p "app/api/order/[orderId]"
mkdir -p "app/api/payment/momo/initiate"
mkdir -p "app/api/payment/revolut/create"
mkdir -p "app/api/payment/revolut/webhook"

# Pages
echo "📄 Creating page directories..."
mkdir -p "app/[venueSlug]/cart"
mkdir -p "app/[venueSlug]/checkout"
mkdir -p "app/[venueSlug]/order/[orderId]"

# Components
echo "🧩 Creating component directories..."
mkdir -p "components/venue"
mkdir -p "components/layout"
mkdir -p "components/checkout"
mkdir -p "components/order"
mkdir -p "components/payment"
mkdir -p "components/ui"
mkdir -p "components/cart"

# Libraries
echo "📚 Creating lib directories..."
mkdir -p "lib/payment"

echo "✅ All directories created successfully!"
echo ""
echo "Next steps:"
echo "1. Copy all code files from IMPLEMENTATION_EXECUTION_PLAN.md"
echo "2. Run: pnpm install --frozen-lockfile"
echo "3. Run: cd .. && supabase db push"
echo "4. Run: pnpm dev"
