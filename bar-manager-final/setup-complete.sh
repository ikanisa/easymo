#!/bin/bash

# Bar Manager Desktop App - Complete Setup Script
# Run this script to create all missing directories and files

set -e  # Exit on error

cd "$(dirname "$0")"

echo "🚀 Setting up Bar Manager Desktop App..."
echo ""

# Step 1: Create directories
echo "📁 Creating directories..."
mkdir -p "app/orders/[id]"
mkdir -p "app/menu/[id]/edit"
mkdir -p "app/promos/new"
echo "✅ Directories created"
echo ""

# Step 2: Copy implementation files
echo "📝 Creating implementation files..."

# Order Detail Page
if [ ! -f "app/orders/[id]/page.tsx" ]; then
  cp TEMP_order_detail_page.tsx "app/orders/[id]/page.tsx"
  echo "✅ Created app/orders/[id]/page.tsx"
else
  echo "⏭️  app/orders/[id]/page.tsx already exists"
fi

# Menu Edit Page  
if [ ! -f "app/menu/[id]/edit/page.tsx" ]; then
  cp TEMP_menu_edit_page.tsx "app/menu/[id]/edit/page.tsx"
  echo "✅ Created app/menu/[id]/edit/page.tsx"
else
  echo "⏭️  app/menu/[id]/edit/page.tsx already exists"
fi

# Promo New Page
if [ ! -f "app/promos/new/page.tsx" ]; then
  cp TEMP_new_promo_page.tsx "app/promos/new/page.tsx"
  echo "✅ Created app/promos/new/page.tsx"
else
  echo "⏭️  app/promos/new/page.tsx already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📊 Implementation Status:"
echo "  ✅ Dashboard (real-time order queue)"
echo "  ✅ Orders list (with filters)"
echo "  ✅ Order detail (just created)"
echo "  ✅ Menu list (with categories)"
echo "  ✅ Menu add (manual entry)"
echo "  ✅ Menu edit (just created)"
echo "  ✅ Promos list"
echo "  ✅ Promo creation (just created)"
echo ""
echo "🚀 Next Steps:"
echo "  1. Set bar_id in localStorage (see README)"
echo "  2. Run: npm run dev (or npm run tauri:dev for desktop)"
echo "  3. Test all features"
echo ""
echo "📖 For more info, see IMPLEMENTATION_STATUS.md"
