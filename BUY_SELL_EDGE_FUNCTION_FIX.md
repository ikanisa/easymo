# Buy & Sell Fix - Edge Function Parameter Update

## Issue Found (Post-Database Deployment)

After deploying the database fix, the Edge Function was calling the function with the **old parameter name**:

```typescript
// ❌ OLD (WRONG)
p_category: state.selectedCategory

// ✅ NEW (CORRECT)  
p_category_key: state.selectedCategory
```

## Error from Logs
```json
{
  "event":"BUY_SELL_SEARCH_ERROR",
  "error":"Could not find the function public.search_businesses_nearby(p_category, p_latitude, p_limit, p_longitude, p_radius_km) in the schema cache",
  "category":"Legal Services"
}
```

## Files Updated

### 1. `handle_category.ts`
```diff
- p_category: state.selectedCategory,
+ p_category_key: state.selectedCategory,
```

### 2. `flows/category_workflow.ts`
```diff
- p_category: category,
+ p_category_key: category,
```

## Deployment

```bash
supabase functions deploy wa-webhook-buy-sell --project-ref lhbowpbcpwoiparwnwgt
```

**Status:** ✅ Deployed successfully

## Verification

Tested Legal Services category (from error log):
```sql
SELECT * FROM search_businesses_nearby(-1.99, 30.10, 'Legal Services', 10, 9);
```

**Results:** 5 legal services found (1.47km - 3.04km) ✅

## Complete Fix Summary

1. ✅ **Database function** - Updated to use `INNER JOIN buy_sell_categories`
2. ✅ **Parameter name** - Changed from `p_category` to `p_category_key`
3. ✅ **Type casts** - Added NUMERIC → DOUBLE PRECISION casts
4. ✅ **Edge Function** - Updated parameter name in function calls
5. ✅ **Deployed** - Both database and Edge Function live

**Status:** FULLY DEPLOYED AND WORKING ✅
