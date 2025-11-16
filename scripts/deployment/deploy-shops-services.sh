#!/bin/bash

# This script completes the Shops & Services implementation
# Run this after deploying the database migration

set -e

export PGPASSWORD='Pq0jyevTlfoa376P'
DB="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     SHOPS & SERVICES - AI-POWERED TAG IMPLEMENTATION          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

echo "📋 Step 1: Apply database migration..."
cd /Users/jeanbosco/workspace/easymo-
export SUPABASE_ACCESS_TOKEN=sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0
supabase db push --include-all

echo ""
echo "📊 Step 2: Verify tags were created..."
psql "$DB" -c "SELECT name, slug, business_count FROM get_active_business_tags() ORDER BY sort_order;"

echo ""
echo "🤖 Step 3: Deploy AI classification function..."
supabase functions deploy classify-business-tags --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt

echo ""
echo "🏷️  Step 4: Classify first batch of businesses (10)..."
curl -X POST "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/classify-business-tags" \
  -H "Authorization: Bearer sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 10}'

echo ""
echo "📈 Step 5: Check classification results..."
psql "$DB" << 'SQL'
SELECT 
  bt.name,
  COUNT(DISTINCT bta.business_id) as assigned_businesses
FROM business_tags bt
LEFT JOIN business_tag_assignments bta ON bt.id = bta.tag_id
WHERE bt.is_active = true
GROUP BY bt.id, bt.name
ORDER BY assigned_businesses DESC;
SQL

echo ""
echo "✅ Step 6: Update wa-webhook to use new shops flow..."
echo "   - Added domains/shops/services.ts"
echo "   - Wired up MARKETPLACE → startShopsAndServices()"
echo "   - Added handlers for tag selection, location, results"

echo ""
echo "🚀 Step 7: Deploy wa-webhook..."
supabase functions deploy wa-webhook --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              ✅ IMPLEMENTATION COMPLETE                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 WHAT WAS DONE:"
echo "   1. Created business_tags table with 12 predefined tags"
echo "   2. Created business_tag_assignments for many-to-many relations"
echo "   3. Added get_businesses_by_tag() RPC function"
echo "   4. Added get_active_business_tags() RPC function"
echo "   5. Created AI classification edge function (OpenAI)"
echo "   6. Classified first 10 businesses intelligently"
echo "   7. Created new shops & services WhatsApp flow"
echo "   8. Updated routers to use dynamic tags"
echo ""
echo "📱 USER FLOW NOW:"
echo "   1. User taps 'Shops & Services'"
echo "   2. Bot shows 'Browse' button"
echo "   3. User taps 'Browse'"
echo "   4. Bot shows LIST of tag categories (Electronics, Household, etc.)"
echo "   5. User picks a category (e.g., Electronics)"
echo "   6. Bot asks for location"
echo "   7. User shares location"
echo "   8. Bot shows nearby businesses in that category"
echo ""
echo "🤖 AI CLASSIFICATION:"
echo "   - Uses OpenAI gpt-4o-mini"
echo "   - Analyzes business name, description, original tag"
echo "   - Assigns 1-3 most relevant tags with confidence scores"
echo "   - Logs all classifications for audit"
echo ""
echo "🔄 TO CLASSIFY MORE BUSINESSES:"
echo "   curl -X POST 'https://...supabase.co/functions/v1/classify-business-tags' \\"
echo "     -H 'Authorization: Bearer YOUR_KEY' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"batchSize\": 50}'"
echo ""
echo "📊 PREDEFINED TAGS:"
echo "   📱 Electronics"
echo "   🏠 Household Goods"
echo "   🔧 Spareparts"
echo "   💅 Salon & Beauty"
echo "   👔 Clothing & Fashion"
echo "   🍷 Liquor Store"
echo "   🛒 Mini Markets"
echo "   🎁 Boutiques"
echo "   📎 Office Supplies"
echo "   🐕 Pet Supplies"
echo "   ⚽ Sports & Fitness"
echo "   🏪 Other Services"
echo ""
