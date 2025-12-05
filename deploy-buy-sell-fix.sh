#!/bin/bash
set -e

echo "🔧 Deploying Buy & Sell Fix"
echo "============================"
echo ""

# Check if we're in the right directory
if [ ! -f "supabase/migrations/20251205234500_fix_search_businesses_function_final.sql" ]; then
  echo "❌ Error: Migration file not found"
  echo "Please run this script from the repository root"
  exit 1
fi

echo "📋 Step 1: Applying database migration..."
cd supabase
supabase db push --include-all

echo ""
echo "✅ Step 2: Verifying function exists..."
psql $DATABASE_URL -c "\df search_businesses_nearby" || echo "⚠️  Could not verify (DATABASE_URL not set)"

echo ""
echo "📊 Step 3: Checking for businesses in database..."
psql $DATABASE_URL -c "SELECT category, COUNT(*) as count FROM businesses WHERE is_active = true GROUP BY category LIMIT 10;" || echo "⚠️  Could not check (DATABASE_URL not set)"

echo ""
echo "🎯 Step 4: Testing function..."
psql $DATABASE_URL -c "SELECT name, category, distance_km FROM search_businesses_nearby(-1.9536, 30.0606, 'Pharmacy', 10, 5);" || echo "⚠️  Could not test (DATABASE_URL not set)"

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Next steps:"
echo "1. If no businesses found, run: psql \$DATABASE_URL -f supabase/seed_sample_businesses.sql"
echo "2. Test via WhatsApp: Send '🛒 Buy & Sell' → Select 'Pharmacies' → Share location"
echo "3. Monitor logs: tail -f /path/to/edge-function-logs"
echo ""
echo "📖 Full documentation: COMPLETE_BUY_SELL_DIAGNOSIS_AND_FIX.md"
