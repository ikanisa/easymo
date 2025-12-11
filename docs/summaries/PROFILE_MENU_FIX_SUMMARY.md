# Profile Menu Items - Fix Summary

**Date**: December 10, 2025  
**Status**: ✅ Ready to Deploy

## What Was Fixed

### 1. Database Misalignment

- **Problem**: Code called `profile_menu_items` table and `get_profile_menu_items_v2()` function
  that didn't exist
- **Solution**: Created migration `20251210075000_fix_profile_menu_items_alignment.sql`
  - Creates proper `profile_menu_items` table with JSONB translations
  - Creates `get_profile_menu_items_v2()` RPC function with business filtering
  - Inserts 10 default menu items with multi-language support

### 2. Code Cleanup

- **File**: `supabase/functions/wa-webhook-profile/profile/menu_items.ts`
  - Removed duplicate imports and function definitions
  - Standardized to use `RouterContext` pattern
  - Proper error handling and observability logging

- **File**: `supabase/functions/wa-webhook-profile/profile/home_dynamic.ts`
  - Updated to call `get_profile_menu_items_v2` instead of old `get_profile_menu_items`
  - Now passes user_id for proper business filtering

## Files Changed

```
✅ Created: supabase/migrations/20251210075000_fix_profile_menu_items_alignment.sql
✅ Fixed:   supabase/functions/wa-webhook-profile/profile/menu_items.ts
✅ Fixed:   supabase/functions/wa-webhook-profile/profile/home_dynamic.ts
✅ Created: deploy-profile-menu-fix.sh
✅ Created: PROFILE_MENU_ITEMS_REVIEW.md (detailed documentation)
```

## How It Works Now

### Dynamic Menu Loading

```
User opens Profile → Code calls get_profile_menu_items_v2(user_id, country, language)
                   ↓
            Database checks:
            - User's country (RW, TZ, KE, UG, etc.)
            - User's language (en, fr, rw, sw, etc.)
            - User's businesses (has bar/restaurant?)
                   ↓
            Returns filtered menu items with:
            - Localized titles/descriptions
            - Conditional items (e.g., "My Bars" only for owners)
            - Proper icons and action targets
```

### Menu Items Included

| Order | Key                 | Icon | Countries      | Conditional                          |
| ----- | ------------------- | ---- | -------------- | ------------------------------------ |
| 1     | edit_profile        | ✏️   | All            | No                                   |
| 2     | wallet_tokens       | 💎   | All            | No                                   |
| 3     | momo_qr             | 📱   | RW, TZ, UG     | No                                   |
| 4     | my_businesses       | 🏪   | All            | No                                   |
| 5     | my_jobs             | 💼   | All            | No                                   |
| 6     | my_properties       | 🏠   | All            | No                                   |
| 7     | my_vehicles         | 🚗   | RW, TZ, KE, UG | No                                   |
| 8     | saved_locations     | 📍   | All            | No                                   |
| 35    | my_bars_restaurants | 🍺   | All            | **Yes** (bar/restaurant owners only) |
| 999   | back_menu           | ←    | All            | No                                   |

## Deployment

```bash
# Option 1: Use automated script
./deploy-profile-menu-fix.sh

# Option 2: Manual steps
supabase db push
supabase functions deploy wa-webhook-profile
```

## Testing Checklist

- [ ] Migration applies without errors
- [ ] Table `profile_menu_items` has 10 rows
- [ ] Function `get_profile_menu_items_v2` returns data
- [ ] Regular user sees 8-9 items (no "My Bars")
- [ ] Bar owner sees "My Bars & Restaurants" item
- [ ] Language switching works (en/fr/rw)
- [ ] Country filtering works (MoMo QR only in RW/TZ/UG)
- [ ] WhatsApp bot displays profile menu correctly

## Observability

### Events Logged

- `PROFILE_MENU_FETCHED` - Success with item count
- `PROFILE_MENU_FETCH_ERROR` - Database errors
- `PROFILE_MENU_FETCH_EXCEPTION` - Code exceptions

### Metrics to Monitor

- Menu fetch success rate
- Average items per country
- Bar/restaurant owner detection rate
- Language distribution

## Future Enhancements

### Easy to Add New Items

```sql
INSERT INTO profile_menu_items (item_key, display_order, icon, translations, action_type, action_target)
VALUES ('premium_features', 25, '⭐',
  '{"en": {"title": "Premium", "description": "Exclusive features"}}'::JSONB,
  'route', 'PREMIUM');
```

### Easy to Update Translations

```sql
UPDATE profile_menu_items
SET translations = jsonb_set(translations, '{sw}',
  '{"title": "Biashara Zangu", "description": "Simamia biashara"}'::JSONB)
WHERE item_key = 'my_businesses';
```

### Easy to Add Conditional Visibility

```sql
-- Only for premium users
UPDATE profile_menu_items
SET visibility_conditions = '{"is_premium": true}'::JSONB
WHERE item_key = 'premium_features';

-- Only for users with specific business categories
UPDATE profile_menu_items
SET requires_business_category = ARRAY['hotel', 'lodging']
WHERE item_key = 'hospitality_tools';
```

## Impact

✅ **Before**: Menu items hardcoded, not localized, same for all users  
✅ **After**: Dynamic, localized, personalized based on user context

✅ **Before**: Adding menu items requires code changes  
✅ **After**: Add via SQL INSERT, no code deployment needed

✅ **Before**: No analytics on menu usage  
✅ **After**: Full observability with structured events

---

**Ready to deploy!** Run `./deploy-profile-menu-fix.sh` when ready.
