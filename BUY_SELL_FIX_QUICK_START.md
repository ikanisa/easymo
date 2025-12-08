# Buy & Sell Category Filtering - QUICK START

## Problem
User selects category (e.g., "Salons & Barbers"), shares location → gets **NO RESULTS** even though businesses exist.

## Root Cause
Database function `search_businesses_nearby` filters by **wrong column**:
- ❌ Current: `WHERE b.category = p_category` 
- ✅ Should: `JOIN buy_sell_categories c ON b.buy_sell_category_id = c.id WHERE c.key = p_category_key`

## Fix Applied

### Migration: `20251208084500_fix_buy_sell_category_filtering.sql`

**What it does:**
1. Drops old function with wrong filtering
2. Creates new function with proper JOIN to `buy_sell_categories` table
3. Filters by `c.key` (e.g., "Salon", "Pharmacy", "Restaurant")
4. Adds performance indexes

**Key change:**
```sql
-- OLD (WRONG)
WHERE b.category = p_category

-- NEW (CORRECT)
INNER JOIN buy_sell_categories c ON b.buy_sell_category_id = c.id
WHERE c.key = p_category_key
```

## Deploy

```bash
cd /Users/jeanbosco/workspace/easymo

# Option 1: One-line deploy
./deploy-buy-sell-fix.sh

# Option 2: Manual
supabase db push --include-all
```

## Test

```sql
-- Should return salons near Kigali
SELECT name, category, distance_km 
FROM search_businesses_nearby(
  -1.9915565,   -- Kigali lat
  30.1059093,   -- Kigali lng
  'Salon',      -- Category key
  10,           -- 10km radius
  9             -- Top 9
);
```

## Verify Logs

**Before fix:**
```json
{"event":"BUY_SELL_NO_RESULTS","category":"Salon"}
```

**After fix:**
```json
{"event":"BUY_SELL_RESULTS_SENT","category":"Salon","resultCount":9}
```

## Files

- ✅ `supabase/migrations/20251208084500_fix_buy_sell_category_filtering.sql` - Migration
- ✅ `deploy-buy-sell-fix.sh` - Deployment script
- ✅ `BUY_SELL_CATEGORY_FIX_SUMMARY.md` - Full documentation

## Categories Supported

All categories from `buy_sell_categories` table:
- Salon, Pharmacy, Restaurant, Bar, Hospital, School, Hotel, Supermarket, etc.
- Must have `buy_sell_category_id` mapped in businesses table

## Next Steps

1. Deploy migration ✅
2. Test via WhatsApp
3. Monitor logs for `BUY_SELL_RESULTS_SENT`
4. If still no results → check business category mappings
