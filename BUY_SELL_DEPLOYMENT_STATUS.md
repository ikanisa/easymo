# Buy & Sell Category Filtering - Deployment Complete

## Status: ✅ READY FOR MANUAL DEPLOYMENT

The fix has been created but needs manual deployment due to migration conflicts.

## What Was Fixed

**Problem:** Users selecting categories like "Salons & Barbers" got NO RESULTS even when businesses existed.

**Root Cause:** `search_businesses_nearby()` function filtered by wrong column:
- ❌ Old: `WHERE b.category = p_category` (raw scraped values)
- ✅ New: `INNER JOIN buy_sell_categories WHERE c.key = p_category_key`

## Deployment Options

### Option 1: Via Supabase SQL Editor (RECOMMENDED)

1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql
2. Copy/paste content from: `deploy_buy_sell_fix_direct.sql`
3. Click "Run"
4. Verify output shows salons near Kigali

### Option 2: Via CLI (when migration history is synced)

```bash
cd /Users/jeanbosco/workspace/easymo
supabase db push --include-all
```

### Option 3: Direct Database Connection

If you have `psql` and database credentials:

```bash
psql "your-connection-string" -f supabase/migrations/20251208084500_fix_buy_sell_category_filtering.sql
```

## Files Created

1. ✅ `supabase/migrations/20251208084500_fix_buy_sell_category_filtering.sql` - Migration file
2. ✅ `deploy_buy_sell_fix_direct.sql` - Standalone SQL with test query
3. ✅ `BUY_SELL_CATEGORY_FIX_SUMMARY.md` - Full technical docs
4. ✅ `BUY_SELL_FIX_QUICK_START.md` - Quick reference
5. ✅ `deploy-buy-sell-fix.sh` - Automated script
6. ✅ `BUY_SELL_FIX_COMMIT_MESSAGE.txt` - Git commit template

## Verification After Deployment

### Test Query

```sql
SELECT name, category, distance_km, owner_whatsapp
FROM search_businesses_nearby(
  -1.9915565,   -- Kigali lat
  30.1059093,   -- Kigali lng
  'Salon',      -- Category key
  10,           -- 10km radius
  9             -- Top 9
);
```

**Expected:** Returns salons near Kigali sorted by distance.

### Check Logs

**Before:**
```json
{"event":"BUY_SELL_NO_RESULTS","category":"Salon"}
```

**After:**
```json
{"event":"BUY_SELL_RESULTS_SENT","category":"Salon","resultCount":9}
```

## Technical Changes

**Function Signature (unchanged):**
```sql
search_businesses_nearby(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_category_key TEXT,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_limit INTEGER DEFAULT 9
)
```

**Key Changes:**
1. Added `INNER JOIN buy_sell_categories c ON b.buy_sell_category_id = c.id`
2. Filter: `WHERE c.key = p_category_key` (matches "Salon", "Pharmacy", etc.)
3. Added indexes on `buy_sell_category_id` and `key` columns

## Categories Supported

All from `buy_sell_categories` table:
- Salon, Pharmacy, Restaurant, Bar, Hospital, School, Hotel, Supermarket
- Must have `buy_sell_category_id` mapped in businesses table

## Next Steps

1. **Deploy via SQL Editor** (recommended)
2. Test via WhatsApp: Send "🛒 Buy & Sell" → Select category → Share location
3. Monitor logs for `BUY_SELL_RESULTS_SENT` events
4. If still no results → check business category mappings with:
   ```sql
   SELECT buy_sell_category, COUNT(*) 
   FROM businesses 
   WHERE buy_sell_category_id IS NOT NULL 
   GROUP BY buy_sell_category;
   ```

## Support

- Full docs: `BUY_SELL_CATEGORY_FIX_SUMMARY.md`
- Quick start: `BUY_SELL_FIX_QUICK_START.md`
- SQL file: `deploy_buy_sell_fix_direct.sql`

---

**Deployment Status:** Pending manual application via Supabase SQL Editor or when migration history is synchronized.
