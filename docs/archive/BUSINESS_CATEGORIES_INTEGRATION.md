# Business Categories and WhatsApp Menu Integration

## Overview
Successfully integrated business categories with WhatsApp home menu system, creating a unified category management system across the platform.

## What Was Implemented

### 1. Database Schema Updates

#### marketplace_categories Table
- Added `menu_item_id UUID` - Links to whatsapp_home_menu_items
- Populated with 6 business categories
- Each category linked to corresponding menu item

#### businesses Table
- Added `category_name TEXT` - Human-readable category
- Updated existing businesses to use category names
- Maintains `category_id` for backward compatibility

#### whatsapp_home_menu_items Table
- Added `menu_item_id UUID` - For future self-reference
- Already has 12 menu items configured

### 2. Business Categories Created

| ID | Category | Slug | Icon | Menu Key | Countries |
|----|----------|------|------|----------|-----------|
| 9 | Pharmacies | pharmacies | 💊 | nearby_pharmacies | RW,UG,KE,TZ,BI,CD |
| 10 | Quincailleries | quincailleries | 🔧 | quincailleries | RW,UG,KE,TZ,BI,CD |
| 11 | Shops & Services | shops-services | 🏪 | shops_services | RW,UG,KE,TZ,BI,CD |
| 12 | Property Rentals | property-rentals | 🏠 | property_rentals | RW,UG,KE,TZ,BI,CD |
| 13 | Notary Services | notary-services | 📜 | notary_services | RW only |
| 14 | Bars & Restaurants | bars-restaurants | 🍽️ | bars_restaurants | RW,UG,KE,TZ,BI,CD |

### 3. Relationship Structure

```
whatsapp_home_menu_items (menu entries)
    ↑
    | menu_item_id (FK)
    |
marketplace_categories (business types)
    ↑
    | category_name (name match)
    |
businesses (actual listings)
```

### 4. View Created: business_category_menu_view

A convenience view that joins all three tables:
```sql
SELECT * FROM business_category_menu_view;
```

Returns:
- business_id, business_name
- category_name, category_id, category_slug, category_icon
- menu_item_id, menu_key, menu_active, menu_countries

## Key Features

### ✅ Unified Category System
- Single source of truth for business categories
- Categories automatically inherit menu item properties
- Country availability controlled at menu level

### ✅ Dynamic Visibility
- Toggle menu item → hides/shows category
- Change country availability → filters categories
- Real-time effect on business listings

### ✅ Backward Compatible
- Existing businesses migrated automatically
- `category_id` still works
- New `category_name` provides clearer semantics

### ✅ Type Safety
- Foreign key constraints ensure data integrity
- Categories must link to valid menu items
- Businesses must use valid category names

## Database Queries

### Get Businesses by Menu Item
```sql
SELECT b.name, b.category_name
FROM businesses b
JOIN marketplace_categories mc ON b.category_name = mc.name
JOIN whatsapp_home_menu_items wm ON mc.menu_item_id = wm.id
WHERE wm.key = 'shops_services';
```

### Get Categories for a Country
```sql
SELECT mc.name, mc.icon
FROM marketplace_categories mc
JOIN whatsapp_home_menu_items wm ON mc.menu_item_id = wm.id
WHERE wm.is_active = true 
  AND 'RW' = ANY(wm.active_countries);
```

### Check Category-Menu Linking
```sql
SELECT 
  mc.name as category,
  wm.name as menu_item,
  wm.is_active,
  wm.active_countries
FROM marketplace_categories mc
JOIN whatsapp_home_menu_items wm ON mc.menu_item_id = wm.id;
```

### Get All Info for a Business
```sql
SELECT * 
FROM business_category_menu_view
WHERE business_name = 'APA';
```

## Admin Panel Impact

### WhatsApp Menu Management (/whatsapp-menu)
Now controls both:
1. **Menu visibility** - Which items appear in WhatsApp
2. **Category visibility** - Which business types are searchable

Example:
- Deactivate "Nearby Pharmacies" menu item
- → Pharmacies category hidden
- → Pharmacy businesses still exist but not discoverable via menu

### Category-Specific Effects

| Action | Menu Item | Category Impact |
|--------|-----------|-----------------|
| Toggle Active | nearby_pharmacies | Shows/hides Pharmacies |
| Remove Country | property_rentals (UG) | Property Rentals unavailable in Uganda |
| Reorder | shops_services | Changes display priority |

## API Usage

### Fetch Categories for User
```typescript
// Based on user's country from phone number
const country = getCountryFromPhone(user.phone); // "RW"

const { data: categories } = await supabase
  .from('marketplace_categories')
  .select(`
    id,
    name,
    slug,
    icon,
    whatsapp_home_menu_items!inner (
      is_active,
      active_countries
    )
  `)
  .eq('whatsapp_home_menu_items.is_active', true)
  .contains('whatsapp_home_menu_items.active_countries', [country]);
```

### Get Businesses by Category
```typescript
const { data: businesses } = await supabase
  .from('businesses')
  .select('*')
  .eq('category_name', 'Pharmacies')
  .eq('is_active', true);
```

### Use the View
```typescript
const { data } = await supabase
  .from('business_category_menu_view')
  .select('*')
  .eq('menu_active', true)
  .contains('menu_countries', [country]);
```

## Testing

### Run Full Test Suite
```bash
bash test-business-categories.sh
```

### Manual Tests
```bash
export DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

# List all categories with menu links
psql "$DATABASE_URL" -c "
  SELECT mc.name, wm.key, wm.is_active
  FROM marketplace_categories mc
  JOIN whatsapp_home_menu_items wm ON mc.menu_item_id = wm.id;
"

# Count businesses per category
psql "$DATABASE_URL" -c "
  SELECT category_name, COUNT(*)
  FROM businesses
  GROUP BY category_name;
"

# Test country filtering
psql "$DATABASE_URL" -c "
  SELECT mc.name
  FROM marketplace_categories mc
  JOIN whatsapp_home_menu_items wm ON mc.menu_item_id = wm.id
  WHERE 'UG' = ANY(wm.active_countries);
"
```

## Migration Details

**File**: `supabase/migrations/20251113120000_link_business_categories_menu.sql`

**Steps**:
1. Add `menu_item_id` to whatsapp_home_menu_items
2. Add `category_name` to businesses
3. Add `menu_item_id` to marketplace_categories
4. Create indexes for performance
5. Insert 6 categories linked to menu items
6. Migrate existing businesses to use category_name
7. Create business_category_menu_view
8. Add documentation comments

**Safe to Re-run**: Uses `ON CONFLICT` clauses

## Current State

### Categories: 6 active
- All linked to WhatsApp menu items
- All have icons and slugs
- Sorted by sort_order

### Businesses: 4 total
- All assigned to "Shops & Services"
- All have category_name populated
- All linked through the system

### Menu Items: 12 total
- 6 have linked categories
- 6 are service-only (no business listings)

## Future Enhancements

### 1. Category Management UI
Add admin panel page for managing categories:
- Create/edit/delete categories
- Assign menu items
- Set icons and descriptions
- Reorder categories

### 2. Business Form Integration
Update business creation forms:
- Dropdown of valid categories
- Category-specific fields
- Real-time validation

### 3. Analytics
Track category usage:
- Most searched categories
- Category performance by country
- Business distribution

### 4. Sub-categories
Extend the system:
- Add parent_category_id
- Support nested categories
- Filter by subcategory

## Troubleshooting

### Category Not Showing in Menu
1. Check if menu item is active:
   ```sql
   SELECT is_active FROM whatsapp_home_menu_items WHERE key = 'pharmacies';
   ```
2. Check country availability:
   ```sql
   SELECT active_countries FROM whatsapp_home_menu_items WHERE key = 'pharmacies';
   ```
3. Verify category link:
   ```sql
   SELECT mc.*, wm.* 
   FROM marketplace_categories mc
   LEFT JOIN whatsapp_home_menu_items wm ON mc.menu_item_id = wm.id
   WHERE mc.name = 'Pharmacies';
   ```

### Business Has No Category
```sql
-- Find businesses without category
SELECT id, name, category_name 
FROM businesses 
WHERE category_name IS NULL;

-- Fix by assigning default
UPDATE businesses 
SET category_name = 'Shops & Services' 
WHERE category_name IS NULL;
```

### Category-Menu Link Broken
```sql
-- Find unlinked categories
SELECT mc.* 
FROM marketplace_categories mc
LEFT JOIN whatsapp_home_menu_items wm ON mc.menu_item_id = wm.id
WHERE wm.id IS NULL;

-- Fix by linking to correct menu item
UPDATE marketplace_categories
SET menu_item_id = (
  SELECT id FROM whatsapp_home_menu_items WHERE key = 'shops_services'
)
WHERE name = 'Shops & Services' AND menu_item_id IS NULL;
```

## Summary

✅ **Complete Integration** - Business categories now fully integrated with WhatsApp menu system  
✅ **6 Categories** - Pharmacies, Quincailleries, Shops & Services, Property Rentals, Notary Services, Bars & Restaurants  
✅ **Dynamic Control** - Toggle menu items to control category visibility  
✅ **Country-Specific** - Categories inherit country availability from menu items  
✅ **View Created** - Easy querying with business_category_menu_view  
✅ **Backward Compatible** - Existing businesses migrated, old category_id still works  
✅ **Tested** - Full test suite confirms all relationships working  

---

**Migration**: `20251113120000_link_business_categories_menu.sql`  
**Test Script**: `test-business-categories.sh`  
**Status**: ✅ Complete and Tested  
**Database**: ✅ All relationships verified
