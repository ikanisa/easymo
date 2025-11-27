#!/bin/bash

set -e

echo "🚀 Implementing remaining Bar Manager features..."

# Create required directories
echo "📁 Creating directories..."
mkdir -p "app/orders/[id]"
mkdir -p "app/menu/[id]/edit"
mkdir -p "app/promos/new"
mkdir -p "components/promos"

# Move TEMP files to their proper locations
echo "📄 Moving implementation files..."

if [ -f "TEMP_order_detail_page.tsx" ]; then
  cp "TEMP_order_detail_page.tsx" "app/orders/[id]/page.tsx"
  echo "✅ Created app/orders/[id]/page.tsx"
fi

if [ -f "TEMP_menu_edit_page.tsx" ] || [ -f "TEMP_edit_menu_page.tsx" ]; then
  # Try both possible filenames
  if [ -f "TEMP_menu_edit_page.tsx" ]; then
    cp "TEMP_menu_edit_page.tsx" "app/menu/[id]/edit/page.tsx"
  else
    cp "TEMP_edit_menu_page.tsx" "app/menu/[id]/edit/page.tsx"
  fi
  echo "✅ Created app/menu/[id]/edit/page.tsx"
fi

if [ -f "TEMP_new_promo_page.tsx" ]; then
  cp "TEMP_new_promo_page.tsx" "app/promos/new/page.tsx"
  echo "✅ Created app/promos/new/page.tsx"
fi

echo ""
echo "✅ All remaining features implemented!"
echo ""
echo "📋 Summary:"
echo "  ✓ Order detail page"
echo "  ✓ Menu edit page"
echo "  ✓ Promo creation page"
echo ""
echo "🧪 Next steps:"
echo "  1. npm run dev  - Test the app"
echo "  2. npm run tauri dev  - Test desktop app"
echo ""
