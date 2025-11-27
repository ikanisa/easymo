# Dynamic Profile Menu System - COMPLETE

**Date**: 2025-11-27  
**Status**: ✅ **IMPLEMENTED & DEPLOYED** (Migration pending manual application)

## Critical Scalability Enhancement

### Problem Solved
**Before**: Profile menu items hardcoded in TypeScript - required code deployment to:
- Add/remove menu items
- Change display order
- Enable/disable features per country  
- Add translations
- Target specific user segments

**After**: Database-driven dynamic menu system - manage everything via SQL:
- ✅ Add menu items: Simple INSERT statement
- ✅ Change order: UPDATE display_order
- ✅ Country rollouts: UPDATE available_countries array
- ✅ A/B testing: Enable/disable via flag
- ✅ No code deployments needed!

---

## Database Schema

### Table: `profile_menu_items`

```sql
CREATE TABLE profile_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  item_key text NOT NULL UNIQUE, -- e.g., 'my_businesses'
  display_order integer NOT NULL DEFAULT 0,
  
  -- Display (Multilingual)
  icon text NOT NULL, -- Emoji
  title_en text NOT NULL,
  title_fr text,
  title_rw text,
  title_sw text, -- Swahili
  title_pt text, -- Portuguese
  title_es text, -- Spanish
  description_en text NOT NULL,
  description_fr text,
  description_rw text,
  description_sw text,
  description_pt text,
  description_es text,
  
  -- Routing
  action_type text CHECK (action_type IN ('route', 'ai_agent', 'function', 'external')),
  action_target text NOT NULL, -- IDS constant or AI agent ID
  
  -- Feature Flags
  enabled boolean DEFAULT true,
  requires_verification boolean DEFAULT false,
  requires_premium boolean DEFAULT false,
  
  -- Country Availability
  available_countries text[] DEFAULT ARRAY['RW', 'KE', 'TZ', 'UG', 'BI', 'CD'],
  excluded_countries text[] DEFAULT ARRAY[]::text[],
  
  -- Access Control
  required_permissions text[] DEFAULT ARRAY[]::text[],
  user_roles text[] DEFAULT ARRAY[]::text[],
  
  -- Analytics
  track_analytics boolean DEFAULT true,
  analytics_event_name text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

---

## RPC Function

### `get_profile_menu_items(user_id, country_code, language)`

Intelligently fetches menu items with:
- ✅ Country filtering
- ✅ Language localization
- ✅ Permission checking
- ✅ Proper ordering

```sql
SELECT * FROM get_profile_menu_items(
  '00000000-0000-0000-0000-000000000000',
  'KE',  -- Kenya
  'sw'   -- Swahili
);
```

---

## Pre-populated Menu Items

All 9 current profile items included with translations:

1. ✏️ **Edit Profile** - All countries
2. 💎 **Wallet & Tokens** - All countries
3. 📱 **MoMo QR Code** - Only RW, UG, TZ (mobile money)
4. 🏪 **My Businesses** - All countries
5. 💼 **My Jobs** - All countries
6. 🏠 **My Properties** - All countries
7. 🚗 **My Vehicles** - RW, KE, TZ, UG (insurance available)
8. 📍 **Saved Locations** - All countries
9. ← **Back to Menu** - All countries

---

## Implementation

### Dynamic Loading in `profile/home.ts`

```typescript
// Get user's country
const countryCode = await getUserCountry(ctx);
const language = ctx.locale || "en";

// Fetch from database
const menuItems = await fetchProfileMenuItems(ctx, countryCode, language);

// Falls back to hardcoded if DB fails
if (!menuItems) {
  menuItems = getFallbackMenuItems();
}

// Build WhatsApp list message
const rows = menuItems.map(item => ({
  id: item.action_target,
  title: `${item.icon} ${item.title}`,
  description: item.description
}));
```

---

## Country-Specific Configuration

### Example: MoMo QR Only in RW, UG, TZ

```sql
INSERT INTO profile_menu_items (
  item_key,
  icon,
  title_en,
  description_en,
  action_type,
  action_target,
  available_countries
) VALUES (
  'momo_qr',
  '📱',
  'MoMo QR Code',
  'Generate QR for payments',
  'route',
  'MOMO_QR',
  ARRAY['RW', 'UG', 'TZ']  -- Only these countries!
);
```

### Example: Disable Vehicles in DRC

```sql
UPDATE profile_menu_items
SET excluded_countries = ARRAY['CD']
WHERE item_key = 'my_vehicles';
```

---

## Management Examples

### Add New Menu Item

```sql
INSERT INTO profile_menu_items (
  item_key,
  display_order,
  icon,
  title_en,
  title_fr,
  title_rw,
  description_en,
  description_fr,
  description_rw,
  action_type,
  action_target,
  available_countries
) VALUES (
  'my_subscriptions',
  3.5, -- Between wallet (3) and businesses (4)
  '⭐',
  'My Subscriptions',
  'Mes abonnements',
  'Amakuru yanjye',
  'Manage your premium subscriptions',
  'Gérer vos abonnements premium',
  'Gahunda y''amakuru yawe',
  'route',
  'MY_SUBSCRIPTIONS',
  ARRAY['RW', 'KE'] -- Beta rollout to RW & KE first
);
```

**No code deployment needed!**

### Change Display Order

```sql
UPDATE profile_menu_items
SET display_order = 2.5
WHERE item_key = 'momo_qr';
-- Now appears between Wallet (2) and Subscriptions (3)
```

### Enable/Disable Feature

```sql
-- Temporarily disable vehicles in production
UPDATE profile_menu_items
SET enabled = false
WHERE item_key = 'my_vehicles';

-- Re-enable later
UPDATE profile_menu_items
SET enabled = true
WHERE item_key = 'my_vehicles';
```

### Regional Rollout

```sql
-- Start with Rwanda only
UPDATE profile_menu_items
SET available_countries = ARRAY['RW']
WHERE item_key = 'new_feature';

-- Expand to East Africa
UPDATE profile_menu_items
SET available_countries = ARRAY['RW', 'KE', 'TZ', 'UG']
WHERE item_key = 'new_feature';

-- Full rollout
UPDATE profile_menu_items
SET available_countries = ARRAY['RW', 'KE', 'TZ', 'UG', 'BI', 'CD']
WHERE item_key = 'new_feature';
```

---

## Multilingual Support

Automatic language selection based on user's locale:

```sql
-- English user sees:
"My Businesses" / "Manage your business listings"

-- French user sees:  
"Mes entreprises" / "Gérer vos annonces d'entreprise"

-- Kinyarwanda user sees:
"Ubucuruzi bwanjye" / "Gahunda y'ubucuruzi bwawe"
```

Falls back to English if translation missing.

---

## Analytics Tracking

Each menu item can track clicks:

```sql
UPDATE profile_menu_items
SET 
  track_analytics = true,
  analytics_event_name = 'profile.vehicles_clicked'
WHERE item_key = 'my_vehicles';
```

Logged automatically when item is clicked.

---

## Access Control

### Require Verification

```sql
UPDATE profile_menu_items
SET requires_verification = true
WHERE item_key = 'my_businesses';
-- Only verified users can see "My Businesses"
```

### Premium Features

```sql
UPDATE profile_menu_items
SET requires_premium = true
WHERE item_key = 'advanced_analytics';
```

### Permission-Based

```sql
UPDATE profile_menu_items
SET required_permissions = ARRAY['business.manage', 'business.create']
WHERE item_key = 'my_businesses';
```

---

## Deployment Status

✅ **Database Schema**: Created in migration  
✅ **Default Data**: All 9 items pre-populated  
✅ **RPC Function**: `get_profile_menu_items()` ready  
✅ **Application Code**: `profile/home.ts` uses dynamic loading  
✅ **Fallback**: Hardcoded menu if DB unavailable  
✅ **Deployed**: wa-webhook-profile service live  
⏳ **Migration**: Pending manual application

---

## Migration Application

```bash
# Apply the migration
supabase db push

# Verify table created
psql -c "SELECT item_key, title_en, available_countries FROM profile_menu_items ORDER BY display_order;"

# Test RPC function
psql -c "SELECT * FROM get_profile_menu_items(
  '00000000-0000-0000-0000-000000000000',
  'RW',
  'en'
);"
```

---

## Benefits

### For Development Team
- ✅ No code changes for menu updates
- ✅ Fast feature rollouts via SQL
- ✅ Easy A/B testing
- ✅ Regional beta testing
- ✅ Emergency disable without deployment

### For Product Team
- ✅ Country-specific features
- ✅ Gradual rollouts
- ✅ Quick experimentation
- ✅ Analytics per item
- ✅ User segmentation

### For Users
- ✅ Localized menus
- ✅ Country-appropriate features
- ✅ Relevant options only
- ✅ Consistent experience

---

## Future Enhancements

1. **Admin UI**: Web interface to manage menu items
2. **Scheduling**: Enable/disable items on specific dates
3. **User Segmentation**: Show different menus per user type
4. **Dynamic Icons**: Support image URLs, not just emojis
5. **Deep Linking**: External URLs for web features
6. **Conditions**: Complex visibility rules (e.g., "show if balance > 1000")

---

## Testing

```sql
-- Check menu for Kenya user in Swahili
SELECT * FROM get_profile_menu_items(
  'user-uuid',
  'KE',
  'sw'
);

-- Check menu for Rwanda user in French
SELECT * FROM get_profile_menu_items(
  'user-uuid',
  'RW',
  'fr'
);

-- Verify MoMo QR not shown in DRC
SELECT * FROM get_profile_menu_items(
  'user-uuid',
  'CD',
  'fr'
) WHERE item_key = 'momo_qr'; -- Should return empty
```

---

## Impact

**CRITICAL FOR SCALABILITY**: 
- Add new countries without code changes
- Roll out features gradually
- Disable broken features instantly
- Test in production safely
- Manage 6 countries independently

This system makes EasyMO truly multi-country scalable.
