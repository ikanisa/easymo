#!/bin/bash

set -e  # Exit on any error

echo "🚀 Bar Manager Desktop App - Final Implementation Script"
echo "========================================================="
echo ""

cd "$(dirname "$0")"

# Step 1: Create missing directories
echo "📁 Step 1: Creating missing directories..."
mkdir -p "app/orders/[id]"
mkdir -p "app/menu/[id]/edit"
mkdir -p "app/promos/new"
echo "   ✅ Directories created"
echo ""

# Step 2: Move TEMP files to proper locations
echo "📄 Step 2: Moving files to proper locations..."

if [ -f "TEMP_order_detail_page.tsx" ]; then
  cp "TEMP_order_detail_page.tsx" "app/orders/[id]/page.tsx"
  echo "   ✅ Order detail page created"
else
  echo "   ⚠️  TEMP_order_detail_page.tsx not found"
fi

if [ -f "TEMP_menu_edit_page.tsx" ]; then
  cp "TEMP_menu_edit_page.tsx" "app/menu/[id]/edit/page.tsx"
  echo "   ✅ Menu edit page created"
else
  echo "   ⚠️  TEMP_menu_edit_page.tsx not found"
fi

if [ -f "TEMP_new_promo_page.tsx" ]; then
  cp "TEMP_new_promo_page.tsx" "app/promos/new/page.tsx"
  echo "   ✅ Promo creation page created"
else
  echo "   ⚠️  TEMP_new_promo_page.tsx not found"
fi

echo ""

# Step 3: Verify files exist
echo "🔍 Step 3: Verifying files..."
if [ -f "app/orders/[id]/page.tsx" ]; then
  echo "   ✅ app/orders/[id]/page.tsx exists"
else
  echo "   ❌ app/orders/[id]/page.tsx MISSING"
fi

if [ -f "app/menu/[id]/edit/page.tsx" ]; then
  echo "   ✅ app/menu/[id]/edit/page.tsx exists"
else
  echo "   ❌ app/menu/[id]/edit/page.tsx MISSING"
fi

if [ -f "app/promos/new/page.tsx" ]; then
  echo "   ✅ app/promos/new/page.tsx exists"
else
  echo "   ❌ app/promos/new/page.tsx MISSING"
fi

echo ""

# Step 4: List all app routes
echo "📋 Step 4: Current app structure..."
echo "   Orders:"
ls -1 app/orders/ | sed 's/^/      - /'
echo "   Menu:"
ls -1 app/menu/ | sed 's/^/      - /'
echo "   Promos:"
ls -1 app/promos/ | sed 's/^/      - /'
echo ""

# Step 5: Clean up TEMP files (optional)
read -p "🗑️  Do you want to delete TEMP files? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  rm -f TEMP_order_detail_page.tsx
  rm -f TEMP_menu_edit_page.tsx
  rm -f TEMP_edit_menu_page.tsx
  rm -f TEMP_new_promo_page.tsx
  echo "   ✅ TEMP files deleted"
else
  echo "   ⏭️  Keeping TEMP files as backup"
fi

echo ""
echo "="=========================================================
echo "✅ Implementation Complete!"
echo "========================================================="
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Start the dev server:"
echo "   pnpm dev"
echo ""
echo "2. Test the new pages:"
echo "   • http://localhost:3000/orders"
echo "   • http://localhost:3000/orders/[id]"
echo "   • http://localhost:3000/menu"
echo "   • http://localhost:3000/menu/[id]/edit"
echo "   • http://localhost:3000/promos/new"
echo ""
echo "3. Launch Tauri desktop app:"
echo "   pnpm tauri dev"
echo ""
echo "4. Build production desktop app:"
echo "   pnpm tauri build"
echo ""
echo "📚 For more details, see: IMPLEMENTATION_STATUS_FINAL.md"
echo ""
