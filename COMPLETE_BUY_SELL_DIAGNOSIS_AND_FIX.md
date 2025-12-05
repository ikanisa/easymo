# Buy & Sell Feature - Complete Diagnosis and Fix

## Executive Summary

**Problem**: Users selecting business categories (e.g., "Pharmacies") in WhatsApp get no results.

**Root Cause**: Database function `search_businesses_nearby` has column name mismatch - uses `b.latitude`/`b.longitude` but table has `b.lat`/`b.lng`.

**Status**: ✅ Fix migration created and ready to deploy

---

## Detailed Analysis

### 1. Error Logs Analysis

```
{"event":"BUY_SELL_SEARCH_ERROR","userId":"49c7130e...","error":"Could not find the function public.search_businesses_nearby(p_category, p_latitude, p_limit, p_longitude, p_radius_km) in the schema cache","category":"Pharmacy"}
```

This error indicates the Supabase client is looking for a function with specific parameter order but can't find it in the schema cache.

### 2. Code Flow (Working Correctly)

**File**: `supabase/functions/wa-webhook-buy-sell/handle_category.ts`

```typescript
const { data: businesses, error } = await supabase.rpc(
  "search_businesses_nearby",
  {
    p_latitude: latitude,      // ✅ Correct parameter
    p_longitude: longitude,     // ✅ Correct parameter
    p_category: state.selectedCategory,  // ✅ Correct parameter
    p_radius_km: 10,           // ✅ Correct parameter
    p_limit: 9,                // ✅ Correct parameter
  }
);
```

The code is calling the function correctly with the right parameters.

### 3. Database Schema Issues

#### Businesses Table Structure (from backup migration)

```sql
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY,
  owner_whatsapp text NOT NULL,
  name text NOT NULL,
  description text,
  catalog_url text,
  location_text text,
  lat double precision,        -- ⚠️ Uses 'lat' not 'latitude'
  lng double precision,        -- ⚠️ Uses 'lng' not 'longitude'
  category text,
  is_active boolean DEFAULT true,
  created_at timestamptz
);
```

**Key Finding**: The table uses `lat`/`lng` columns, NOT `latitude`/`longitude`.

#### Function Signature History

**Migration 20251205231800_fix_search_businesses_nearby.sql** (Latest before fix):
```sql
CREATE FUNCTION search_businesses_nearby(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_category TEXT,
  p_radius_km DOUBLE PRECISION,
  p_limit INTEGER
)
...
SELECT b.latitude, b.longitude  -- ❌ WRONG: These columns don't exist
FROM businesses b
WHERE b.latitude IS NOT NULL    -- ❌ WRONG: Column doesn't exist
```

This function would fail at runtime with "column does not exist" error.

### 4. Migration Conflicts

Multiple migrations created conflicting versions:

1. **20251205210000_fix_buy_sell_schema.sql** - Wrong signature (search_term, user_lat, user_lng...)
2. **20251205213000_unify_business_registry.sql** - Adds `lat`/`lng` columns to businesses table
3. **20251205231800_fix_search_businesses_nearby.sql** - Correct signature but wrong column names
4. **20251205233000_recreate_search_businesses_nearby.sql** - Still uses wrong column names

---

## The Solution

### Created Migration: `20251205234500_fix_search_businesses_function_final.sql`

This migration:

1. **Drops all wrong function signatures**
2. **Creates function with correct signature matching the code**
3. **Uses correct column names (lat/lng) from the actual table**
4. **Maps output columns to match expected names (latitude/longitude)**
5. **Adds proper indexes for performance**

#### Key Fix - Column Mapping

```sql
SELECT
  b.lat AS latitude,   -- ✅ Maps lat -> latitude in output
  b.lng AS longitude,  -- ✅ Maps lng -> longitude in output
FROM public.businesses b
WHERE 
  b.lat IS NOT NULL    -- ✅ Uses correct column name
  AND b.lng IS NOT NULL
  AND b.is_active = true
```

This allows the function to:
- Query using the actual column names (`lat`, `lng`)
- Return data with the expected column names (`latitude`, `longitude`)

---

## Additional Issues Found

### 1. Missing Business Data

**Finding**: The `businesses` table might be empty or have no businesses in the requested categories.

**Check needed**: 
```sql
SELECT category, COUNT(*) 
FROM businesses 
WHERE is_active = true 
GROUP BY category;
```

### 2. Category Name Mismatch

**Finding**: The buy_sell_categories table has categories like:
- `Pharmacy`
- `Salon`
- `Beauty Shop`

But businesses in the businesses table might use different category names like:
- `pharmacy` (lowercase)
- `Pharmacies` (plural)
- `Health & Wellness`

**Solution needed**: Either:
1. Normalize category names in businesses table
2. Use fuzzy matching in the search function
3. Create category mapping table

### 3. Location Data Quality

**Potential issue**: Businesses might have NULL lat/lng values.

**Check needed**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE lat IS NULL OR lng IS NULL) as missing_location,
  COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) as has_location,
  COUNT(*) as total
FROM businesses
WHERE is_active = true;
```

---

## Deployment Steps

1. **Apply the fix migration**:
   ```bash
   cd supabase
   supabase db push --include-all
   ```

2. **Verify function exists**:
   ```sql
   SELECT routine_name, routine_type 
   FROM information_schema.routines 
   WHERE routine_name = 'search_businesses_nearby';
   ```

3. **Test the function**:
   ```sql
   SELECT * FROM search_businesses_nearby(
     -1.9915568828583,  -- Kigali latitude
     30.105907440186,   -- Kigali longitude
     'Pharmacy',
     10,
     9
   );
   ```

4. **Check for businesses**:
   ```sql
   SELECT id, name, category, lat, lng, is_active
   FROM businesses
   WHERE category = 'Pharmacy'
   LIMIT 10;
   ```

5. **If no businesses found**, seed sample data:
   ```sql
   INSERT INTO businesses (name, category, lat, lng, owner_whatsapp, is_active)
   VALUES 
     ('City Pharmacy', 'Pharmacy', -1.9536, 30.0606, '250788123456', true),
     ('Health Plus Pharmacy', 'Pharmacy', -1.9447, 30.0589, '250788123457', true),
     ('Care Pharmacy', 'Pharmacy', -1.9510, 30.0920, '250788123458', true);
   ```

---

## Testing Checklist

- [ ] Migration applied successfully
- [ ] Function exists in database
- [ ] Function can be called without errors
- [ ] Businesses table has data for tested categories
- [ ] WhatsApp user can select category
- [ ] WhatsApp user can share location
- [ ] System returns nearby businesses
- [ ] Business details are displayed correctly

---

## Files Involved

### Edge Functions
- `supabase/functions/wa-webhook-buy-sell/handle_category.ts` - Handles location and search
- `supabase/functions/wa-webhook-buy-sell/flows/category_workflow.ts` - Workflow logic
- `supabase/functions/wa-webhook-buy-sell/show_categories.ts` - Shows category list

### Migrations
- `20251205234500_fix_search_businesses_function_final.sql` - **THE FIX**
- `20251205224954_align_buy_sell_categories_with_businesses.sql` - Category setup
- `20251205213000_unify_business_registry.sql` - Table structure
- `backup_20251114_104454/20251003160000_phase_a_legacy_cleaned.sql` - Original schema

### Database Tables
- `businesses` - Main business directory
- `buy_sell_categories` - Category definitions with localization
- `chat_state` - User session state

---

## Microservices Architecture

### Buyer Service (`services/buyer-service`)
Currently minimal implementation - just config and server setup. 
**Not actively used** in the buy/sell flow.

### Vendor Service (`services/vendor-service`)
Currently minimal implementation - just config files.
**Not actively used** in the buy/sell flow.

### Current Architecture
The buy/sell feature is implemented as:
- **Edge Functions** (Deno): Handle WhatsApp webhook, user interaction
- **Database Functions** (PostgreSQL): Business search logic
- **Supabase Client**: Direct database queries from edge functions

**No microservices are currently involved** in the buy/sell flow.

---

## Recommendations

### Immediate (Critical)
1. ✅ Apply the fix migration
2. Verify businesses table has sample data for testing
3. Test end-to-end flow with real WhatsApp number
4. Monitor error logs for any remaining issues

### Short-term
1. Add business data seeding script
2. Normalize category names across system
3. Add better error messages when no businesses found
4. Implement category synonym matching

### Long-term
1. Consider implementing buyer-service microservice for complex queries
2. Add business verification workflow
3. Implement business owner dashboard
4. Add business ratings and reviews
5. Integrate with Google Places API for automatic business data

