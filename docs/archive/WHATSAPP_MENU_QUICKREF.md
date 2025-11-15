# WhatsApp Home Menu - Quick Reference

## 🎯 What Was Implemented

A complete dynamic menu management system for WhatsApp that:
- ✅ Loads menu items from database (no hardcoding)
- ✅ Shows different menus per country (RW, UG, KE, TZ, BI, CD)
- ✅ Provides admin panel for real-time management
- ✅ Takes effect immediately for new WhatsApp sessions

## 🚀 Quick Start

### Access Admin Panel
```
URL: http://localhost:3000/whatsapp-menu
```

### Toggle Menu Items
1. Click status button: `Active` ↔ `Inactive`
2. Click country codes: `RW` `UG` `KE` etc. (blue = active)
3. Changes save automatically
4. Click "Refresh" to reload

### Test from WhatsApp
- Rwanda number (+250...): Sees all 12 items
- Uganda number (+256...): Sees 9 items (no Motor Insurance, MOMO QR, Notary)
- Other countries default to Rwanda menu

## 📊 Current Menu Items

| Order | Item | Key | Rwanda | Uganda | Kenya |
|-------|------|-----|--------|--------|-------|
| 1 | 🚖 Nearby Drivers | nearby_drivers | ✓ | ✓ | ✓ |
| 2 | 🧍 Nearby Passengers | nearby_passengers | ✓ | ✓ | ✓ |
| 3 | 🚦 Schedule Trip | schedule_trip | ✓ | ✓ | ✓ |
| 4 | 🛡️ Motor Insurance | motor_insurance | ✓ | ✗ | ✗ |
| 5 | 💊 Nearby Pharmacies | nearby_pharmacies | ✓ | ✓ | ✓ |
| 6 | 🔧 Quincailleries | quincailleries | ✓ | ✓ | ✓ |
| 7 | 🏪 Shops & Services | shops_services | ✓ | ✓ | ✓ |
| 8 | 🏠 Property Rentals | property_rentals | ✓ | ✓ | ✓ |
| 9 | 📱 MOMO QR Code | momo_qr | ✓ | ✗ | ✗ |
| 10 | 🍽️ Bars & Restaurants | bars_restaurants | ✓ | ✓ | ✓ |
| 11 | 📜 Notary Services | notary_services | ✓ | ✗ | ✗ |
| 12 | 💬 Customer Support | customer_support | ✓ | ✓ | ✓ |

## 🗄️ Database Access

### View All Items
```bash
export DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

psql "$DATABASE_URL" -c "SELECT name, key, is_active FROM whatsapp_home_menu_items ORDER BY display_order;"
```

### Test Country Filter
```sql
-- Rwanda menu
SELECT name FROM whatsapp_home_menu_items 
WHERE is_active = true AND 'RW' = ANY(active_countries)
ORDER BY display_order;

-- Uganda menu  
SELECT name FROM whatsapp_home_menu_items 
WHERE is_active = true AND 'UG' = ANY(active_countries)
ORDER BY display_order;
```

### Toggle Item Status
```sql
-- Deactivate
UPDATE whatsapp_home_menu_items 
SET is_active = false 
WHERE key = 'motor_insurance';

-- Reactivate
UPDATE whatsapp_home_menu_items 
SET is_active = true 
WHERE key = 'motor_insurance';
```

### Update Country Availability
```sql
-- Add Kenya to Motor Insurance
UPDATE whatsapp_home_menu_items 
SET active_countries = array_append(active_countries, 'KE')
WHERE key = 'motor_insurance';

-- Remove Kenya from Motor Insurance
UPDATE whatsapp_home_menu_items 
SET active_countries = array_remove(active_countries, 'KE')
WHERE key = 'motor_insurance';
```

## 🧪 Testing

### Run Demo Script
```bash
bash demo-whatsapp-menu.sh
```

### Test API Endpoints
```bash
# GET all menu items
curl http://localhost:3000/api/whatsapp-menu

# PATCH update item
curl -X PATCH http://localhost:3000/api/whatsapp-menu \
  -H "Content-Type: application/json" \
  -d '{"id":"<uuid>","is_active":false}'
```

### Test WhatsApp Integration
1. Deploy wa-webhook to Supabase
2. Send message from test number
3. Verify menu appears with correct items
4. Toggle item in admin panel
5. Start new WhatsApp session
6. Verify change reflected

## 📁 File Locations

### Core Files
- **Dynamic Menu Logic**: `supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts`
- **Home Menu Integration**: `supabase/functions/wa-webhook/flows/home.ts`
- **Admin Page**: `admin-app/app/(panel)/whatsapp-menu/page.tsx`
- **Admin Client**: `admin-app/app/(panel)/whatsapp-menu/WhatsAppMenuClient.tsx`
- **Table Component**: `admin-app/components/whatsapp-menu/WhatsAppMenuTable.tsx`
- **API Route**: `admin-app/app/api/whatsapp-menu/route.ts`
- **Types**: `admin-app/types/whatsapp-menu.ts`

### Migration
- **Database Setup**: `supabase/migrations/20260322100000_whatsapp_home_menu_config.sql`

### Translations
- **English**: `supabase/functions/wa-webhook/i18n/messages/en.json`
- **French**: `supabase/functions/wa-webhook/i18n/messages/fr.json`

## 🔍 Troubleshooting

### Menu Not Showing in WhatsApp
1. Check database: `psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM whatsapp_home_menu_items WHERE is_active = true;"`
2. Verify wa-webhook deployed
3. Check Supabase logs for errors
4. Ensure country codes match phone number

### Admin Panel Not Loading
1. Check API: `curl http://localhost:3000/api/whatsapp-menu`
2. Verify Supabase connection
3. Check browser console for errors
4. Ensure table exists and has data

### Changes Not Reflecting
1. Verify update succeeded in database
2. Start completely new WhatsApp session
3. Check RLS policies allow updates
4. Clear browser cache

## 💡 Common Operations

### Disable Item Globally
```sql
UPDATE whatsapp_home_menu_items SET is_active = false WHERE key = 'bars_restaurants';
```

### Enable Item for Specific Countries
```sql
UPDATE whatsapp_home_menu_items 
SET active_countries = ARRAY['RW', 'KE'] 
WHERE key = 'motor_insurance';
```

### Change Display Order
```sql
UPDATE whatsapp_home_menu_items SET display_order = 1 WHERE key = 'momo_qr';
UPDATE whatsapp_home_menu_items SET display_order = 2 WHERE key = 'nearby_drivers';
```

### Add New Menu Item
```sql
INSERT INTO whatsapp_home_menu_items 
(name, key, is_active, active_countries, display_order, icon)
VALUES 
('New Feature', 'new_feature', true, ARRAY['RW', 'UG'], 13, '✨');
```

## 📞 Support

**Database URL**: `postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres`

**Admin Panel**: http://localhost:3000/whatsapp-menu

**Documentation**: See `WHATSAPP_MENU_IMPLEMENTATION.md` for full details

---

**Status**: ✅ Ready for Testing  
**Last Updated**: 2025-11-13
