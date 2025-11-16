# Menu Integration Summary

## Implementation Overview

This implementation provides a comprehensive menu seeding solution for the EasyMO platform,
populating the `restaurant_menu_items` table with a shared menu across 97 bars.

## Files Created

### 1. SQL Seed File

**Path:** `supabase/seed/fixtures/bar_menu_items_seed.sql`

- **Purpose:** Populate menu items for every bar where `country = 'Rwanda'`
- **Structure:** Validates bar presence, deletes existing menu items for those bars, then cross-joins a menu template with the target bars
- **Records:** 17,848 total (97 bars × 184 items per bar)
- **Features:**
  - Transaction-safe (BEGIN/COMMIT)
  - Idempotent delete+insert (no duplicate rows)
  - Properly escaped special characters (apostrophes)
  - Organized by 26 menu categories
  - Stores both `category_id` (UUID) and `category_name` fields directly on each row

### 2. Documentation

**Path:** `supabase/seed/fixtures/bar_menu_items_README.md`

- **Contents:**
  - Detailed usage instructions
  - Category breakdown with item counts
  - Execution methods (Supabase CLI, psql, Dashboard)
  - Verification queries
  - Rollback procedures
  - Troubleshooting guidance

### 3. Verification Script

**Path:** `scripts/verify-menu-seed.mjs`

- **Purpose:** Automated verification of seed data integrity
- **Features:**
  - Checks total record count
  - Validates items per bar
  - Verifies all categories present
  - Samples menu items
- Detects duplicate entries
- **Usage:** `pnpm seed:verify` (added to package.json)

### 4. Menu Data JSON

**Path:** `supabase/seed/fixtures/data/rwanda_menu_items.json`

- **Purpose:** Canonical list of menu entries (category, item name, description, price placeholder)
- **Usage:** Referenced when generating the SQL seed to keep data maintenance simple and auditable

## Menu Structure

### Categories and Counts

| Category      | Count | Type   |
| ------------- | ----- | ------ |
| BEERS         | 21    | Drinks |
| BREAKFAST     | 1     | Food   |
| CIDERS        | 3     | Drinks |
| COCKTAILS     | 25    | Drinks |
| COFFEE        | 6     | Drinks |
| DESSERTS      | 4     | Food   |
| ENERGY DRINKS | 3     | Drinks |
| FAST FOOD     | 6     | Food   |
| GIN           | 6     | Drinks |
| GRILL         | 9     | Food   |
| JUICES        | 9     | Drinks |
| LIQUORS       | 9     | Drinks |
| MAIN COURSES  | 3     | Food   |
| PASTA         | 3     | Food   |
| PIZZA         | 7     | Food   |
| RUM           | 5     | Drinks |
| SIDE DISHES   | 3     | Food   |
| SODA          | 9     | Drinks |
| SOUP          | 4     | Food   |
| SPIRITS       | 9     | Drinks |
| TEA           | 3     | Drinks |
| TRADITIONAL   | 7     | Food   |
| VEGETARIAN    | 3     | Food   |
| WATER         | 3     | Drinks |
| WHISKEY       | 16    | Drinks |
| WINES         | 7     | Drinks |

**Total:** 184 items per bar

### Data Model

Each menu item includes:

- `bar_id` (UUID) - References `bars.id`
- `menu_id` (UUID, nullable) - References `menus.id`
- `category_id` (UUID) - Static UUID per category (no lookup table)
- `category_name` (TEXT) - Category label
- `name` (TEXT) - Item name
- `description` (TEXT) - Item description
- `price` (NUMERIC) - Set to 1.00 RWF initially
- `currency` (TEXT) - "RWF" (Rwandan Franc)
- `is_available` (BOOLEAN) - true by default
- `image_url` (TEXT, nullable) - For future image uploads
- `ocr_extracted` (BOOLEAN) - false (manually curated)
- `ocr_confidence` (NUMERIC, nullable) - null for manual entries

## Usage Instructions

### Running the Seed

```bash
# Option 1: Using Supabase CLI (recommended)
supabase db seed -f supabase/seed/fixtures/bar_menu_items_seed.sql

# Option 2: Using psql
psql -h localhost -U postgres -d postgres -f supabase/seed/fixtures/bar_menu_items_seed.sql

# Option 3: Via Supabase Dashboard SQL Editor
# Copy and paste the file contents into the SQL editor
```

### Verifying the Seed

```bash
# Run the verification script
pnpm seed:verify

# Or using node directly
node scripts/verify-menu-seed.mjs
```

### Manual Verification Queries

```sql
-- Check total records
SELECT COUNT(*) FROM public.restaurant_menu_items;
-- Expected: 17,848

-- Check items per bar
SELECT bar_id, COUNT(*) as item_count
FROM public.restaurant_menu_items
GROUP BY bar_id
ORDER BY item_count DESC;
-- Expected: 184 items per bar

-- Check category distribution
SELECT category_name, COUNT(*) as item_count
FROM public.restaurant_menu_items
GROUP BY category_name
ORDER BY item_count DESC;

-- Sample items
SELECT name, category_name, price, currency
FROM public.restaurant_menu_items
LIMIT 10;
```

## Target Bars

The seed selects every row from `public.bars` where `country = 'Rwanda'`. As of this release that equals 97 bars, but the script automatically adapts if more bars are added or removed.

## Integration Points

### Database Tables

1. **Primary Table:** `restaurant_menu_items`
   - Created by migration: `20260322110000_bars_restaurants_menu_system.sql`
   - Includes RLS policies for access control

2. **Referenced Tables:**
   - `bars` - Must contain all 97 bar IDs
   - `menus` - Optional reference (nullable)
   - `profiles` - For manager/owner relationships via `bar_managers`

### Access Control

- **Public Read:** Available menu items visible to all
- **Bar Managers:** Can manage their bar's menu items
- **Service Role:** Full access to all menu items

## Post-Seeding Actions

### 1. Update Prices

Bar managers should update item prices through:

- Admin panel interface
- Direct database updates
- Batch import tools

### 2. Customize Items

Bar managers can:

- Update descriptions
- Mark items unavailable
- Add custom images
- Adjust categories

### 3. Create Menu Versions

Link items to specific menu versions:

```sql
-- Create a menu version for a bar
INSERT INTO public.menus (bar_id, version, status, source)
VALUES ('bar-uuid', 1, 'published', 'manual')
RETURNING id;

-- Link items to menu
UPDATE public.restaurant_menu_items
SET menu_id = 'menu-uuid'
WHERE bar_id = 'bar-uuid';
```

## Rollback Procedure

To remove all seeded menu items:

```sql
BEGIN;

-- Delete items for specific bars
DELETE FROM public.restaurant_menu_items
WHERE bar_id IN (
  -- List all 97 bar IDs here
  '00710229-f8b1-4903-980f-ddcb3580dcf2',
  '01c7812c-b553-4594-a598-52641f057952',
  -- ... (continue for all bars)
);

-- Verify deletion
SELECT COUNT(*) FROM public.restaurant_menu_items;

COMMIT;
```

## Troubleshooting

### Common Issues

1. **Foreign Key Violations**
   - **Issue:** Bar IDs don't exist in `bars` table
   - **Solution:** Ensure bars are created before seeding menu items

2. **Duplicate Key Errors**
   - **Issue:** Menu items already exist
   - **Solution:** Run rollback procedure first, or use `ON CONFLICT DO NOTHING`

3. **Permission Errors**
   - **Issue:** Insufficient database privileges
   - **Solution:** Use service role key or database admin credentials

4. **RLS Policy Blocks**
   - **Issue:** Row Level Security blocking inserts
   - **Solution:** Seed using service role or disable RLS temporarily

### Verification Failures

If verification script shows discrepancies:

```bash
# Check database connection
pnpm diagnostics:supabase

# Check specific bar
psql -c "SELECT COUNT(*) FROM restaurant_menu_items WHERE bar_id = 'uuid';"

# Check for errors in logs
# Review Supabase logs or PostgreSQL logs
```

## Performance Considerations

- **Seeding Time:** ~5-10 seconds for 17,848 records
- **Transaction Safety:** All inserts wrapped in BEGIN/COMMIT
- **Index Impact:** Existing indexes will be updated automatically
- **Memory Usage:** PL/pgSQL loop minimizes memory footprint

## Future Enhancements

1. **Price Import:** Bulk price update tool
2. **Image Management:** Automated image upload/association
3. **Menu Variants:** Support for different menu versions per bar
4. **Translations:** Multi-language support for menu items
5. **Dietary Tags:** Vegetarian, vegan, gluten-free flags
6. **Allergen Info:** Allergen tracking and warnings

## Support

For issues or questions:

1. Check documentation in `bar_menu_items_README.md`
2. Run verification script for diagnostics
3. Review database logs for errors
4. Check RLS policies if access issues occur

## Notes

- All prices are initially set to 0.00 RWF
- Items are marked as available by default
- No images are included (image_url is NULL)
- OCR fields are false/null (manually curated data)
- Currency is RWF (Rwandan Franc) for all items

## Maintenance

### Regular Tasks

- Update prices quarterly or as needed
- Review and update descriptions
- Add seasonal items
- Mark unavailable items
- Upload item images

### Monitoring

- Track menu item views/orders
- Monitor price changes
- Audit manager modifications
- Review customer feedback
