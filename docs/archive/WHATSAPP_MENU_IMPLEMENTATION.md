# WhatsApp Dynamic Home Menu Implementation

## Overview
Successfully implemented dynamic WhatsApp home menu management system that allows:
- Dynamic menu items loaded from database instead of hardcoded values
- Country-specific menu item availability
- Admin panel for real-time menu management
- Immediate effect on new WhatsApp sessions

## Changes Made

### 1. Database Layer (Already Exists ✅)
**Table:** `whatsapp_home_menu_items`
- Fields: id, name, key, is_active, active_countries[], display_order, icon
- 12 menu items seeded with default configuration
- RLS policies enabled for security
- Located in: `supabase/migrations/20260322100000_whatsapp_home_menu_config.sql`

### 2. WhatsApp Webhook Integration
**New File:** `supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts`
- `fetchActiveMenuItems(countryCode)` - Fetches active menu items for specific country
- `getMenuItemId(key)` - Maps menu keys to internal IDS
- `getMenuItemTranslationKeys(key)` - Maps menu keys to i18n translation keys
- Supports all existing menu items with proper type safety

**Modified:** `supabase/functions/wa-webhook/flows/home.ts`
- Replaced hardcoded `BASE_ROW_DEFS` with dynamic database fetch
- Added country detection from phone number (E.164 format)
- Country mapping: +250→RW, +256→UG, +254→KE, +255→TZ, +257→BI, +243→CD
- Maintains backward compatibility with existing features (insurance gate, admin menu)

**Translation Updates:**
- Added "notary_services" translations to English and French
- Files: `supabase/functions/wa-webhook/i18n/messages/en.json`, `fr.json`

### 3. Admin Panel Management

**New Page:** `admin-app/app/(panel)/whatsapp-menu/page.tsx`
- Server-side data fetching with Supabase
- Force dynamic rendering for real-time updates

**New Component:** `admin-app/app/(panel)/whatsapp-menu/WhatsAppMenuClient.tsx`
- Interactive menu management interface
- Real-time toggle for active/inactive status
- Country availability toggle buttons (RW, UG, KE, TZ, BI, CD)
- Refresh functionality
- Error handling and loading states

**New Component:** `admin-app/components/whatsapp-menu/WhatsAppMenuTable.tsx`
- Sortable table with display order
- Visual country badges with active/inactive states
- Click-to-toggle functionality for both status and countries
- Responsive design with proper styling

**New API:** `admin-app/app/api/whatsapp-menu/route.ts`
- GET endpoint: Fetch all menu items ordered by display_order
- PATCH endpoint: Update menu item (status, countries, etc.)
- Proper error handling and validation

**New Types:** `admin-app/types/whatsapp-menu.ts`
- Zod schemas for validation
- TypeScript types exported for consistency

**New Queries:** `admin-app/lib/queries/whatsapp-menu.ts`
- React Query helper functions
- Query keys for cache management

**Navigation Update:** `admin-app/components/layout/nav-items.ts`
- Added "WhatsApp menu" (📱) to System section
- Located between "WhatsApp health" and "Settings"

### 4. Testing Infrastructure
**New File:** `test-whatsapp-menu.sh`
- Database connectivity test
- Country-specific filtering validation
- Active/inactive status toggle test
- Country availability matrix display

## How It Works

### WhatsApp User Flow
1. User sends message to WhatsApp bot
2. System extracts country code from phone number (+250... → RW)
3. `fetchActiveMenuItems("RW")` queries database for active items in Rwanda
4. Menu items are filtered, translated, and displayed to user
5. User sees only items marked active for their country

### Admin Management Flow
1. Admin navigates to `/whatsapp-menu` in admin panel
2. Sees all 12 menu items in a table sorted by display_order
3. Can click status button to toggle active/inactive
4. Can click country codes (RW, UG, etc.) to toggle availability
5. Changes are saved to database via API
6. New WhatsApp sessions immediately reflect changes

### Country Detection Logic
```typescript
Phone: +250788123456 → Country: RW (Rwanda)
Phone: +256771234567 → Country: UG (Uganda)
Phone: +254712345678 → Country: KE (Kenya)
Default: RW (if no match)
```

## Current Menu Items (12 total)
1. 🚖 Nearby Drivers (nearby_drivers)
2. 🧍 Nearby Passengers (nearby_passengers)
3. 🚦 Schedule Trip (schedule_trip)
4. 🛡️ Motor Insurance (motor_insurance) - RW only
5. 💊 Nearby Pharmacies (nearby_pharmacies)
6. 🔧 Quincailleries (quincailleries)
7. 🏪 Shops & Services (shops_services)
8. 🏠 Property Rentals (property_rentals)
9. 📱 MOMO QR Code (momo_qr) - RW only
10. 🍽️ Bars & Restaurants (bars_restaurants)
11. 📜 Notary Services (notary_services) - RW only
12. 💬 Customer Support (customer_support)

## Database Schema
```sql
CREATE TABLE whatsapp_home_menu_items (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  active_countries TEXT[] DEFAULT '{}',
  display_order INTEGER NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## API Endpoints

### GET /api/whatsapp-menu
Returns all menu items ordered by display_order.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Nearby Drivers",
      "key": "nearby_drivers",
      "is_active": true,
      "active_countries": ["RW", "UG", "KE"],
      "display_order": 1,
      "icon": "🚖"
    }
  ]
}
```

### PATCH /api/whatsapp-menu
Updates a specific menu item.

**Request:**
```json
{
  "id": "uuid",
  "is_active": false,
  "active_countries": ["RW", "UG"]
}
```

## Testing Instructions

### 1. Database Testing
```bash
export DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

# Check active items
psql "$DATABASE_URL" -c "SELECT name, key, is_active, active_countries FROM whatsapp_home_menu_items ORDER BY display_order;"

# Test country filter (Rwanda)
psql "$DATABASE_URL" -c "SELECT name FROM whatsapp_home_menu_items WHERE is_active = true AND 'RW' = ANY(active_countries);"
```

### 2. Admin Panel Testing
```bash
# Start admin app
cd admin-app
npm run dev

# Visit: http://localhost:3000/whatsapp-menu
# Test:
# - Toggle status buttons (Active ↔ Inactive)
# - Toggle country codes (blue = active, gray = inactive)
# - Click Refresh to reload data
# - Verify changes persist after refresh
```

### 3. WhatsApp Integration Testing
1. Deploy wa-webhook function to Supabase
2. Send test message from +250... number (Rwanda)
3. Verify menu shows all items active for RW
4. In admin panel, deactivate "Motor Insurance"
5. Start new WhatsApp session
6. Verify "Motor Insurance" no longer appears

### 4. Edge Cases to Test
- Toggle all countries off for an item (should disappear for everyone)
- Toggle item inactive (should disappear globally)
- Test with non-East African number (should default to RW menu)
- Test with Uganda number (+256) - should see UG-specific menu
- Test concurrent updates from multiple admin sessions

## Files Modified/Created Summary

### Created (11 files)
1. `supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts`
2. `admin-app/types/whatsapp-menu.ts`
3. `admin-app/lib/queries/whatsapp-menu.ts`
4. `admin-app/app/api/whatsapp-menu/route.ts`
5. `admin-app/app/(panel)/whatsapp-menu/page.tsx`
6. `admin-app/app/(panel)/whatsapp-menu/WhatsAppMenuClient.tsx`
7. `admin-app/components/whatsapp-menu/WhatsAppMenuTable.tsx`
8. `test-whatsapp-menu.sh`

### Modified (4 files)
1. `supabase/functions/wa-webhook/flows/home.ts`
2. `supabase/functions/wa-webhook/i18n/messages/en.json`
3. `supabase/functions/wa-webhook/i18n/messages/fr.json`
4. `admin-app/components/layout/nav-items.ts`

## Key Features

✅ **Dynamic Menu Loading** - No hardcoded menu items, all from database
✅ **Country-Specific Availability** - Different menus for RW, UG, KE, TZ, BI, CD
✅ **Real-Time Management** - Admin can toggle items without code changes
✅ **Immediate Effect** - Changes apply to new WhatsApp sessions instantly
✅ **Backward Compatible** - Existing features (insurance gate, admin menu) preserved
✅ **Type Safety** - Full TypeScript coverage with Zod validation
✅ **i18n Support** - English and French translations maintained
✅ **RLS Security** - Row-level security policies in place
✅ **Audit Trail** - created_at, updated_at timestamps tracked
✅ **Observability** - Logging for menu fetch failures

## Deployment Checklist

- [x] Database table exists with seeded data
- [x] WhatsApp webhook code updated
- [x] Admin panel pages created
- [x] API endpoints implemented
- [x] Navigation updated
- [x] Translations added
- [ ] Deploy wa-webhook edge function to Supabase
- [ ] Deploy admin app to production
- [ ] Test with real WhatsApp numbers from different countries
- [ ] Monitor logs for any errors
- [ ] Document for team

## Next Steps (Future Enhancements)

1. **Display Order Management** - Drag-and-drop reordering in admin panel
2. **Menu Item Creation** - Add new menu items from admin panel
3. **Icon Picker** - Visual emoji/icon selector
4. **Name Editing** - Allow changing display names per country
5. **Description Editing** - Custom descriptions per country
6. **Analytics** - Track which menu items are most used per country
7. **A/B Testing** - Test different menu configurations
8. **Scheduling** - Time-based activation/deactivation
9. **Bulk Operations** - Enable/disable multiple items at once
10. **Export/Import** - Menu configuration backup and restore

## Support

For questions or issues:
1. Check database logs: `psql "$DATABASE_URL" -c "SELECT * FROM whatsapp_home_menu_items;"`
2. Check admin API: `curl http://localhost:3000/api/whatsapp-menu`
3. Check WhatsApp webhook logs in Supabase dashboard
4. Review error messages in admin panel UI

---

**Implementation Date:** 2025-11-13  
**Status:** ✅ Ready for Testing  
**Database:** ✅ Table exists with 12 items  
**Code:** ✅ All changes committed  
**Admin Panel:** ✅ Accessible at /whatsapp-menu
