#!/bin/bash

# World-Class Bar Manager - Directory Setup Script
# Creates all necessary directories for the application

set -e

echo "🚀 Setting up World-Class Bar Manager directories..."

BASE_DIR="/Users/jeanbosco/workspace/easymo-/bar-manager-app"

cd "$BASE_DIR"

# Create component directories
echo "📁 Creating component directories..."

mkdir -p components/dashboard
mkdir -p components/orders
mkdir -p components/tables
mkdir -p components/menu
mkdir -p components/inventory
mkdir -p components/staff
mkdir -p components/analytics
mkdir -p components/payments
mkdir -p components/customers
mkdir -p components/reservations
mkdir -p components/marketing
mkdir -p components/settings
mkdir -p components/ai
mkdir -p components/layout
mkdir -p components/print

# Create app route directories
echo "📁 Creating app routes..."

mkdir -p app/\(dashboard\)/orders/kitchen
mkdir -p app/\(dashboard\)/orders/\[orderId\]
mkdir -p app/\(dashboard\)/tables/floor-plan
mkdir -p app/\(dashboard\)/menu/editor
mkdir -p app/\(dashboard\)/menu/categories
mkdir -p app/\(dashboard\)/menu/modifiers
mkdir -p app/\(dashboard\)/inventory/items
mkdir -p app/\(dashboard\)/inventory/suppliers
mkdir -p app/\(dashboard\)/inventory/recipes
mkdir -p app/\(dashboard\)/inventory/waste
mkdir -p app/\(dashboard\)/staff/schedule
mkdir -p app/\(dashboard\)/staff/timeclock
mkdir -p app/\(dashboard\)/staff/performance
mkdir -p app/\(dashboard\)/analytics/sales
mkdir -p app/\(dashboard\)/analytics/customers
mkdir -p app/\(dashboard\)/analytics/trends
mkdir -p app/\(dashboard\)/analytics/reports
mkdir -p app/\(dashboard\)/payments/transactions
mkdir -p app/\(dashboard\)/payments/reconciliation
mkdir -p app/\(dashboard\)/payments/tips
mkdir -p app/\(dashboard\)/customers/loyalty
mkdir -p app/\(dashboard\)/customers/feedback
mkdir -p app/\(dashboard\)/reservations
mkdir -p app/\(dashboard\)/marketing/campaigns
mkdir -p app/\(dashboard\)/marketing/promotions
mkdir -p app/\(dashboard\)/settings/venue
mkdir -p app/\(dashboard\)/settings/printers
mkdir -p app/\(dashboard\)/settings/integrations
mkdir -p app/\(dashboard\)/settings/notifications
mkdir -p app/kds
mkdir -p app/pos

# Create lib directories
echo "📁 Creating lib directories..."

mkdir -p lib/printer
mkdir -p lib/scanner
mkdir -p lib/export
mkdir -p lib/ai

# Create store directories
echo "📁 Creating store directories..."

mkdir -p stores

# Create public directories
echo "📁 Creating public directories..."

mkdir -p public/sounds
mkdir -p public/icons
mkdir -p public/fonts

# Create Tauri directories
echo "📁 Creating Tauri directories..."

mkdir -p src-tauri/src/commands
mkdir -p src-tauri/icons

echo "✅ Directory structure created successfully!"
echo ""
echo "📊 Summary:"
echo "  - Components: 15 directories"
echo "  - App routes: 30+ directories"
echo "  - Lib modules: 4 directories"
echo "  - Stores: 1 directory"
echo "  - Public assets: 3 directories"
echo "  - Tauri: 2 directories"
echo ""
echo "🎯 Next steps:"
echo "  1. Run 'pnpm install' to install dependencies"
echo "  2. Create component files based on WORLD_CLASS_IMPLEMENTATION_GUIDE.md"
echo "  3. Run 'pnpm dev' to start development server"
echo "  4. Run 'pnpm tauri dev' for desktop app"
echo ""
echo "📚 See WORLD_CLASS_IMPLEMENTATION_GUIDE.md for detailed implementation instructions"
