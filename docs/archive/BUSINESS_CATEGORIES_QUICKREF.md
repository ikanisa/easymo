# Business Categories ↔ WhatsApp Menu - Quick Reference

## System Architecture

```
┌─────────────────────────────────────┐
│   whatsapp_home_menu_items          │
│   (What users see in WhatsApp)      │
├─────────────────────────────────────┤
│ • nearby_pharmacies  (💊 RW,UG,KE) │
│ • quincailleries     (🔧 RW,UG,KE) │
│ • shops_services     (🏪 RW,UG,KE) │
│ • property_rentals   (🏠 RW,UG,KE) │
│ • notary_services    (📜 RW only)   │
│ • bars_restaurants   (🍽️ RW,UG,KE) │
└───────────┬─────────────────────────┘
            │ menu_item_id (FK)
            ↓
┌─────────────────────────────────────┐
│   marketplace_categories            │
│   (Business type classifications)   │
├─────────────────────────────────────┤
│ • Pharmacies                         │
│ • Quincailleries                     │
│ • Shops & Services                   │
│ • Property Rentals                   │
│ • Notary Services                    │
│ • Bars & Restaurants                 │
└───────────┬─────────────────────────┘
            │ category_name (match)
            ↓
┌─────────────────────────────────────┐
│   businesses                        │
│   (Actual business listings)        │
├─────────────────────────────────────┤
│ • APA           (Shops & Services)  │
│ • Isuka         (Shops & Services)  │
│ • Saloon Mix    (Shops & Services)  │
│ • Trending      (Shops & Services)  │
└─────────────────────────────────────┘
```

## Quick Queries

### 1. Get Active Categories for a Country
```sql
SELECT mc.name, mc.icon
FROM marketplace_categories mc
JOIN whatsapp_home_menu_items wm ON mc.menu_item_id = wm.id
WHERE wm.is_active = true 
  AND 'RW' = ANY(wm.active_countries);
```

### 2. Get Businesses in a Category
```sql
SELECT name, location_text
FROM businesses
WHERE category_name = 'Pharmacies';
```

### 3. Get Everything About a Business
```sql
SELECT *
FROM business_category_menu_view
WHERE business_name = 'APA';
```

### 4. Count Businesses per Category
```sql
SELECT category_name, COUNT(*)
FROM businesses
GROUP BY category_name;
```

### 5. Check Menu-Category Links
```sql
SELECT 
  wm.name as menu,
  mc.name as category,
  wm.is_active,
  array_length(wm.active_countries, 1) as countries
FROM whatsapp_home_menu_items wm
LEFT JOIN marketplace_categories mc ON wm.id = mc.menu_item_id;
```

## Admin Panel Actions

### Toggle Menu Item
```
Admin Panel: /whatsapp-menu
Action: Click "Active" button for "Nearby Pharmacies"
Result: 
  - Menu item hidden from WhatsApp
  - Pharmacies category becomes unavailable
  - Pharmacy businesses still in DB but not discoverable
```

### Change Country Availability
```
Admin Panel: /whatsapp-menu
Action: Remove "UG" from "Property Rentals"
Result:
  - Uganda users don't see "Property Rentals" menu
  - Property Rentals category hidden in Uganda
  - Existing rentals in Uganda still exist but not searchable
```

## Current Categories & Menu Items

| Category | Menu Key | Icon | RW | UG | KE | TZ | BI | CD |
|----------|----------|------|----|----|----|----|----|----|
| Pharmacies | nearby_pharmacies | 💊 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Quincailleries | quincailleries | 🔧 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Shops & Services | shops_services | 🏪 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Property Rentals | property_rentals | 🏠 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Notary Services | notary_services | 📜 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Bars & Restaurants | bars_restaurants | 🍽️ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Menu Items WITHOUT Categories

These menu items don't have business categories (they're services):
- Nearby Drivers (mobility)
- Nearby Passengers (mobility)
- Schedule Trip (mobility)
- Motor Insurance (insurance)
- MOMO QR Code (payments)
- Customer Support (support)

## Testing

### Run Full Test
```bash
bash test-business-categories.sh
```

### Quick Checks
```bash
# Count categories
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM marketplace_categories;"

# List all with menu links
psql "$DATABASE_URL" -c "
  SELECT mc.name, wm.key, wm.is_active
  FROM marketplace_categories mc
  JOIN whatsapp_home_menu_items wm ON mc.menu_item_id = wm.id;
"

# Check businesses
psql "$DATABASE_URL" -c "
  SELECT category_name, COUNT(*) 
  FROM businesses 
  GROUP BY category_name;
"
```

## TypeScript Types

```typescript
interface MarketplaceCategory {
  id: number;
  name: string;
  slug: string;
  icon: string;
  is_active: boolean;
  sort_order: number;
  menu_item_id: string; // UUID
}

interface Business {
  id: string;
  name: string;
  category_name: string; // Links to MarketplaceCategory.name
  category_id: number;   // Links to MarketplaceCategory.id (legacy)
  owner_whatsapp: string;
  location_text: string;
  is_active: boolean;
}

interface WhatsAppMenuItem {
  id: string;
  name: string;
  key: string;
  is_active: boolean;
  active_countries: string[];
  display_order: number;
  icon: string;
}

interface BusinessCategoryMenuView {
  business_id: string;
  business_name: string;
  category_name: string;
  category_id: number;
  category_slug: string;
  category_icon: string;
  menu_item_id: string;
  menu_key: string;
  menu_active: boolean;
  menu_countries: string[];
}
```

## Common Operations

### Add New Business
```sql
INSERT INTO businesses (name, owner_whatsapp, category_name)
VALUES ('New Pharmacy', '+250788123456', 'Pharmacies');
```

### Change Business Category
```sql
UPDATE businesses
SET category_name = 'Quincailleries'
WHERE id = 'business-uuid';
```

### Add New Category
```sql
-- First, ensure menu item exists
-- Then insert category
INSERT INTO marketplace_categories (name, slug, icon, menu_item_id)
SELECT 
  'New Category',
  'new-category',
  '🆕',
  id
FROM whatsapp_home_menu_items
WHERE key = 'shops_services';
```

### Toggle Category Visibility
```sql
-- Via menu item
UPDATE whatsapp_home_menu_items
SET is_active = false
WHERE key = 'nearby_pharmacies';

-- Direct category toggle (less common)
UPDATE marketplace_categories
SET is_active = false
WHERE name = 'Pharmacies';
```

## Files

- **Migration**: `supabase/migrations/20251113120000_link_business_categories_menu.sql`
- **Test Script**: `test-business-categories.sh`
- **Full Documentation**: `BUSINESS_CATEGORIES_INTEGRATION.md`

## Status

✅ Categories created: 6  
✅ Menu items linked: 6  
✅ Businesses migrated: 4  
✅ View created: business_category_menu_view  
✅ Tests passing: All  
✅ Admin panel ready: /whatsapp-menu

---

**Database URL**: `postgresql://postgres:***@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres`  
**Last Updated**: 2025-11-13  
**Migration Version**: 20251113120000
