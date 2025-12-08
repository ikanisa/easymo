#!/bin/bash
# Deploy Buy & Sell Category Filtering Fix
# Date: 2025-12-08

set -e

echo "=========================================="
echo "Buy & Sell Category Filtering Fix"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "supabase/migrations/20251208084500_fix_buy_sell_category_filtering.sql" ]; then
  echo "❌ Error: Migration file not found"
  echo "   Please run from /Users/jeanbosco/workspace/easymo"
  exit 1
fi

echo "✅ Migration file found"
echo ""

# Try Supabase CLI first
echo "📋 Deploying via Supabase CLI..."
if command -v supabase &> /dev/null; then
  supabase db push --include-all
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration deployed successfully!"
    echo ""
    echo "📊 Testing the fix..."
    echo "Run: SELECT * FROM search_businesses_nearby(-1.9915565, 30.1059093, 'Salon', 10, 9);"
    echo ""
    exit 0
  fi
fi

echo ""
echo "⚠️  Supabase CLI failed or not available"
echo ""
echo "Manual deployment options:"
echo "1. Set DATABASE_URL and run: psql \$DATABASE_URL -f supabase/migrations/20251208084500_fix_buy_sell_category_filtering.sql"
echo "2. Apply via Supabase Dashboard"
echo "3. See: BUY_SELL_CATEGORY_FIX_SUMMARY.md"
exit 1
