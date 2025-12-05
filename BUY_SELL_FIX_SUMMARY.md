# Buy & Sell Feature - Fix Summary

## Problem
Users selecting business categories (e.g., "Pharmacies") get error:
```
"Could not find the function public.search_businesses_nearby(...) in the schema cache"
```

## Root Cause
Database function `search_businesses_nearby` references columns `b.latitude` and `b.longitude`, but the `businesses` table uses `b.lat` and `b.lng`.

## Solution Applied

### ✅ Created Migration
**File**: `supabase/migrations/20251205234500_fix_search_businesses_function_final.sql`

**What it does**:
1. Drops all incorrect function signatures
2. Creates function with correct signature matching the code
3. Uses correct column names (`lat`/`lng`) from the actual table
4. Maps output to expected names (`latitude`/`longitude`)
5. Adds performance indexes

### ✅ Created Deployment Script
**File**: `deploy-buy-sell-fix.sh`

Automates:
- Migration deployment
- Function verification
- Database checks
- Testing

### ✅ Created Sample Data
**File**: `supabase/seed_sample_businesses.sql`

Provides:
- 25+ sample businesses across all categories
- Kigali, Rwanda locations
- Sample data for Burundi (multi-country testing)

## Deployment

```bash
# 1. Apply the fix
./deploy-buy-sell-fix.sh

# 2. If businesses table is empty, seed sample data
psql $DATABASE_URL -f supabase/seed_sample_businesses.sql

# 3. Test via WhatsApp
# Send: 🛒 Buy & Sell → Select Pharmacies → Share location
```

## Architecture Summary

### Current Stack
- **Edge Functions** (Deno): WhatsApp webhook handlers
- **PostgreSQL Functions**: Business search with PostGIS-like Haversine
- **Supabase Client**: Direct database access from edge functions

### Key Files
```
supabase/functions/wa-webhook-buy-sell/
├── handle_category.ts              # Handles category selection & location
├── flows/category_workflow.ts      # Workflow state management
├── show_categories.ts              # Category list display
└── db/index.ts                     # Database queries

supabase/migrations/
├── 20251205224954_align_buy_sell_categories_with_businesses.sql
├── 20251205234500_fix_search_businesses_function_final.sql  ← THE FIX
└── seed_sample_businesses.sql      # Sample data

Database Tables:
├── businesses                      # Main business directory (lat/lng columns)
├── buy_sell_categories            # Category definitions with i18n
└── chat_state                     # User session state
```

### Buyer & Vendor Microservices
**Status**: Currently minimal/unused

The buy/sell feature runs entirely in:
1. Supabase Edge Functions (TypeScript/Deno)
2. PostgreSQL database functions
3. Direct Supabase client queries

No microservices are involved in the current implementation.

## Testing Checklist

- [ ] Migration applied: `supabase db push --include-all`
- [ ] Function exists: `\df search_businesses_nearby`
- [ ] Sample data loaded: `SELECT COUNT(*) FROM businesses`
- [ ] WhatsApp flow: Buy & Sell → Category → Location → Results
- [ ] Multi-country: Test with Burundi phone number
- [ ] Edge cases: Empty results, no location, invalid category

## Additional Issues to Address

1. **Category Normalization**: Ensure business categories match exactly with `buy_sell_categories.key`
2. **Data Quality**: Some businesses might have NULL lat/lng
3. **Error Messages**: Improve UX when no businesses found
4. **Performance**: Monitor query performance with large datasets

## Documentation
- **Full Analysis**: `COMPLETE_BUY_SELL_DIAGNOSIS_AND_FIX.md`
- **This Summary**: `BUY_SELL_FIX_SUMMARY.md`

