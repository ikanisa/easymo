# Buy & Sell Category Filtering Fix

## Date
2025-12-08

## Issue
When users select a category from Buy & Sell (e.g., "Salons & Barbers") and share their location, they get **NO RESULTS** even though matching businesses exist in the database.

### Root Cause Analysis

**Log Evidence:**
```json
{"event":"BUY_SELL_CATEGORY_SELECTED","userId":"49c7130e-33e8-46db-a631-74df6ff74483","category":"Salon","categoryName":"Salons & Barbers"}
{"event":"BUY_SELL_LOCATION_RECEIVED","userId":"49c7130e-33e8-46db-a631-74df6ff74483","category":"Salon","latitude":-1.9915565252304,"longitude":30.105909347534}
{"event":"BUY_SELL_NO_RESULTS","userId":"49c7130e-33e8-46db-a631-74df6ff74483","category":"Salon","latitude":-1.9915565252304,"longitude":30.105909347534}
```

**Problem Identified:**

1. **Wrong Database Column Filter:**
   - Current function: `WHERE b.category = p_category`
   - Database has: `buy_sell_category` and `buy_sell_category_id` columns
   - Passed value: `"Salon"` (the key from `buy_sell_categories` table)
   - The old `category` column contains raw scraped categories (e.g., "beauty_salon", "hair_salon")

2. **Column Naming Already Correct:**
   - The migration `20251205234500_fix_search_businesses_function_final.sql` correctly uses `b.lat` and `b.lng`
   - No lat/lng naming issue exists

## Solution

### Migration: `20251208084500_fix_buy_sell_category_filtering.sql`

**Changes:**

1. **Proper JOIN with buy_sell_categories:**
   ```sql
   INNER JOIN public.buy_sell_categories c 
     ON b.buy_sell_category_id = c.id
   WHERE 
     c.key = p_category_key  -- Match by category key
   ```

2. **Uses Correct Columns:**
   - `buy_sell_category_id` - UUID FK to buy_sell_categories
   - `c.key` - Matches "Salon", "Pharmacy", "Restaurant", etc.

3. **Returns Proper Category Name:**
   ```sql
   COALESCE(b.buy_sell_category, b.category, 'General') AS category
   ```

4. **Added Performance Indexes:**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_businesses_buy_sell_category_id 
     ON public.businesses (buy_sell_category_id) 
     WHERE buy_sell_category_id IS NOT NULL;
   
   CREATE INDEX IF NOT EXISTS idx_buy_sell_categories_key 
     ON public.buy_sell_categories (key);
   ```

## Database Schema Reference

### businesses Table
```sql
- buy_sell_category TEXT         -- Human-readable: "Salons & Barbers"
- buy_sell_category_id UUID       -- FK to buy_sell_categories.id
- lat DECIMAL(10, 8)              -- Latitude
- lng DECIMAL(11, 8)              -- Longitude  
- category TEXT                   -- Old scraped category (legacy)
```

### buy_sell_categories Table
```sql
- id UUID PRIMARY KEY
- key TEXT UNIQUE                 -- "Salon", "Pharmacy", "Restaurant"
- name TEXT                       -- "Salons & Barbers", "Pharmacies"
- icon TEXT                       -- "💇", "💊", "🍽️"
```

## Workflow Verification

1. **User selects category:**
   ```
   Input: "💇 Salons & Barbers"
   ID: "category_Salon"
   ```

2. **System extracts key:**
   ```typescript
   const categoryKey = "category_Salon".replace("category_", ""); // "Salon"
   ```

3. **Lookup category:**
   ```sql
   SELECT key, name, icon FROM buy_sell_categories WHERE key = 'Salon'
   -- Returns: { key: "Salon", name: "Salons & Barbers", icon: "💇" }
   ```

4. **Store in state:**
   ```json
   {
     "selectedCategory": "Salon",
     "categoryName": "Salons & Barbers",
     "categoryIcon": "💇"
   }
   ```

5. **Search nearby businesses:**
   ```sql
   SELECT * FROM search_businesses_nearby(
     p_latitude := -1.9915565,
     p_longitude := 30.1059093,
     p_category_key := 'Salon',  -- NOW MATCHES!
     p_radius_km := 10,
     p_limit := 9
   )
   ```

## Deployment

### Apply Migration

```bash
# Option 1: Via Supabase CLI
cd /Users/jeanbosco/workspace/easymo
supabase db push --include-all

# Option 2: Direct SQL (if DATABASE_URL is set)
psql $DATABASE_URL -f supabase/migrations/20251208084500_fix_buy_sell_category_filtering.sql
```

### Verification

```sql
-- Test the function
SELECT * FROM search_businesses_nearby(
  -1.9915565252304,   -- Kigali latitude
  30.105909347534,    -- Kigali longitude
  'Salon',            -- Category key
  10,                 -- 10km radius
  9                   -- Top 9 results
);

-- Should return salons & barbers near that location
```

## Expected Behavior After Fix

1. User selects "💇 Salons & Barbers"
2. User shares location (lat: -1.99, lng: 30.10)
3. System finds businesses with:
   - `buy_sell_category_id` matching "Salon" category
   - Within 10km radius
   - Sorted by distance
4. Returns top 9 closest salons/barbers

## Files Changed

- ✅ `supabase/migrations/20251208084500_fix_buy_sell_category_filtering.sql` (NEW)

## Files Verified (No Changes Needed)

- ✅ `supabase/functions/wa-webhook-buy-sell/handle_category.ts` - Uses correct category.key
- ✅ `supabase/migrations/20251205234500_fix_search_businesses_function_final.sql` - Lat/lng correct
- ✅ `supabase/migrations/20251207141000_complete_category_mapping.sql` - Categories mapped

## Testing Checklist

- [ ] Deploy migration
- [ ] Test with "Salon" category in Kigali
- [ ] Test with "Pharmacy" category
- [ ] Test with "Restaurant" category
- [ ] Verify distance calculations
- [ ] Verify top 9 limit works
- [ ] Check performance (should use indexes)

## Observability

After deployment, logs should show:
```json
{"event":"BUY_SELL_CATEGORY_SELECTED","category":"Salon","categoryName":"Salons & Barbers"}
{"event":"BUY_SELL_LOCATION_RECEIVED","category":"Salon","latitude":-1.99,"longitude":30.10}
{"event":"BUY_SELL_RESULTS_SENT","category":"Salon","resultCount":9}  // SUCCESS!
```

No more `BUY_SELL_NO_RESULTS` for categories with mapped businesses.
