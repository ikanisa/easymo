#!/bin/bash

# ============================================================================
# VERIFY PROTECTED TABLES
# ============================================================================
# Check that the protected tables exist and have data
# ============================================================================

echo "🔍 VERIFYING PROTECTED TABLES"
echo "=============================="
echo ""

# Check if supabase is configured
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not set. Using supabase link..."
    DATABASE_URL=$(supabase status | grep "DB URL" | awk '{print $3}')
fi

echo "Checking 'businesses' table..."
BUSINESS_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM public.businesses" 2>/dev/null || echo "0")
BUSINESS_COUNT=$(echo $BUSINESS_COUNT | xargs)

if [ "$BUSINESS_COUNT" -gt 0 ]; then
    echo "  ✓ businesses table exists with $BUSINESS_COUNT rows"
    psql "$DATABASE_URL" -c "\d public.businesses" | head -20
else
    echo "  ⚠️  businesses table is empty or doesn't exist"
fi

echo ""
echo "Checking 'mv_category_business_counts' table..."
MV_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM public.mv_category_business_counts" 2>/dev/null || echo "0")
MV_COUNT=$(echo $MV_COUNT | xargs)

if [ "$MV_COUNT" -gt 0 ]; then
    echo "  ✓ mv_category_business_counts exists with $MV_COUNT rows"
    psql "$DATABASE_URL" -c "\d public.mv_category_business_counts" | head -20
else
    echo "  ⚠️  mv_category_business_counts is empty or doesn't exist"
fi

echo ""
echo "Summary:"
echo "  businesses: $BUSINESS_COUNT rows"
echo "  mv_category_business_counts: $MV_COUNT rows"
