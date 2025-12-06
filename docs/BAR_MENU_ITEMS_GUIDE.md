# Bar Menu Items - Implementation Guide

## Overview
This document describes the implementation of the `bar_menu_items` table in Supabase and how to upload menu data from CSV.

## Database Schema

### Table: `bar_menu_items`

```sql
CREATE TABLE public.bar_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
    bar_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    is_available BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
```

### Key Features

1. **Foreign Key Relationship**: Links to `bars` table via `bar_id`
2. **Unique Constraint**: Prevents duplicate menu items per bar (bar_id + item_name + category)
3. **Indexes**: Optimized for queries by bar_id, category, and availability
4. **RLS Policies**: Public read access for available items, service role for management
5. **Auto-updated timestamps**: `updated_at` automatically updates on changes

### Helper Functions

#### `get_bar_menu_items(p_bar_id UUID)`
Retrieves all available menu items for a specific bar.

```sql
SELECT * FROM get_bar_menu_items('4d514423-222a-4b51-83ed-5202d3bf005b');
```

#### `get_bar_menu_by_category(p_bar_id UUID, p_category TEXT)`
Retrieves menu items for a specific bar and category.

```sql
SELECT * FROM get_bar_menu_by_category(
    '4d514423-222a-4b51-83ed-5202d3bf005b', 
    'Coffees & Teas'
);
```

## CSV Format

Your CSV should have the following columns:

```csv
bar name,bar_id,item name,price,category
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Americano,1.6,Coffees & Teas
```

### Column Mapping

| CSV Column  | Database Column | Type    | Required | Notes                          |
|-------------|----------------|---------|----------|--------------------------------|
| bar name    | bar_name       | TEXT    | Yes      | Display name of the bar        |
| bar_id      | bar_id         | UUID    | Yes      | Must exist in `bars` table     |
| item name   | item_name      | TEXT    | Yes      | Name of the menu item          |
| price       | price          | NUMERIC | Yes      | Must be positive number        |
| category    | category       | TEXT    | Yes      | Category/section of menu       |

## Upload Process

### Step 1: Apply Database Migration

```bash
cd /Users/jeanbosco/workspace/easymo
supabase db push
```

Or deploy specific migration:
```bash
supabase db push --include-migrations 20251206160000_create_bar_menu_items.sql
```

### Step 2: Prepare Your CSV

Save your complete CSV data to: `/Users/jeanbosco/workspace/easymo/data/bar-menu-items-full.csv`

### Step 3: Set Environment Variables

```bash
export SUPABASE_URL="your-project-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

Or use `.env` file:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

### Step 4: Run Upload Script

```bash
node scripts/upload-bar-menu-items.mjs data/bar-menu-items-full.csv
```

## Data Validation

The upload script performs the following validations:

1. ✅ **Required Fields**: bar_id, item_name, price, category
2. ✅ **Price Validation**: Must be a positive number
3. ✅ **UUID Validation**: bar_id must be valid UUID format
4. ✅ **Duplicate Detection**: Uses upsert with conflict resolution

## Query Examples

### Get All Menu Items for a Bar

```sql
SELECT 
    item_name,
    category,
    price,
    is_available
FROM bar_menu_items
WHERE bar_id = '4d514423-222a-4b51-83ed-5202d3bf005b'
    AND is_available = true
ORDER BY category, item_name;
```

### Get Menu Categories for a Bar

```sql
SELECT 
    category,
    COUNT(*) as item_count,
    MIN(price) as min_price,
    MAX(price) as max_price,
    AVG(price)::NUMERIC(10,2) as avg_price
FROM bar_menu_items
WHERE bar_id = '4d514423-222a-4b51-83ed-5202d3bf005b'
    AND is_available = true
GROUP BY category
ORDER BY category;
```

### Search Menu Items

```sql
SELECT 
    b.bar_name,
    bmi.item_name,
    bmi.category,
    bmi.price
FROM bar_menu_items bmi
JOIN bars b ON b.id = bmi.bar_id
WHERE bmi.item_name ILIKE '%burger%'
    AND bmi.is_available = true
ORDER BY bmi.price;
```

### Get Most Expensive Items

```sql
SELECT 
    bar_name,
    item_name,
    category,
    price
FROM bar_menu_items
WHERE is_available = true
ORDER BY price DESC
LIMIT 20;
```

## Integration with WhatsApp Bot

### Example: Get Menu for User

```typescript
import { supabase } from './supabase-client';

async function getBarMenu(barId: string) {
  const { data, error } = await supabase
    .rpc('get_bar_menu_items', { p_bar_id: barId });
  
  if (error) {
    console.error('Error fetching menu:', error);
    return null;
  }
  
  // Group by category
  const menu = data.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});
  
  return menu;
}
```

### Example: Format Menu for WhatsApp

```typescript
function formatMenuForWhatsApp(menu: any) {
  let message = '*📋 Our Menu*\n\n';
  
  Object.entries(menu).forEach(([category, items]: [string, any[]]) => {
    message += `*${category}*\n`;
    items.forEach((item) => {
      message += `• ${item.item_name} - €${item.price.toFixed(2)}\n`;
    });
    message += '\n';
  });
  
  return message;
}
```

## Maintenance

### Update Item Price

```sql
UPDATE bar_menu_items
SET price = 2.0
WHERE bar_id = '4d514423-222a-4b51-83ed-5202d3bf005b'
    AND item_name = 'Americano';
```

### Mark Items as Unavailable

```sql
UPDATE bar_menu_items
SET is_available = false
WHERE bar_id = '4d514423-222a-4b51-83ed-5202d3bf005b'
    AND item_name = 'Seasonal Item';
```

### Bulk Update Category

```sql
UPDATE bar_menu_items
SET category = 'Hot Beverages'
WHERE category = 'Coffees & Teas';
```

## Troubleshooting

### Issue: Foreign Key Violation

**Error**: `violates foreign key constraint "bar_menu_items_bar_id_fkey"`

**Solution**: Ensure the bar_id exists in the `bars` table first:

```sql
SELECT id, name FROM bars WHERE id = 'your-bar-id';
```

### Issue: Duplicate Key Error

**Error**: `duplicate key value violates unique constraint`

**Solution**: The combination of (bar_id, item_name, category) must be unique. Either:
- Change the item_name or category
- Use upsert to update existing items

### Issue: Price Validation Error

**Error**: `violates check constraint "bar_menu_items_price_positive"`

**Solution**: Ensure all prices are >= 0.

## Performance Considerations

1. **Batch Uploads**: Upload in batches of 100-500 items
2. **Indexes**: Already created for common queries
3. **Caching**: Consider caching menu data in your application
4. **Pagination**: For large menus, implement pagination

## Next Steps

1. ✅ Apply database migration
2. ✅ Upload CSV data
3. 🔄 Verify data in Supabase dashboard
4. 🔄 Test helper functions
5. 🔄 Integrate with WhatsApp bot

## Support

For issues or questions:
- Check logs: `supabase db logs`
- View data: Supabase Dashboard → Table Editor → bar_menu_items
- Test queries: Supabase Dashboard → SQL Editor
