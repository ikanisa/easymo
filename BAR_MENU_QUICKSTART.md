# Bar Menu Items Upload - Quick Start

## Current Implementation Status

### ✅ Created Files

1. **Migration**: `supabase/migrations/20251206160000_create_bar_menu_items.sql`
   - Creates `bar_menu_items` table
   - Sets up indexes and RLS policies
   - Includes helper functions

2. **Upload Script**: `scripts/upload-bar-menu-items.mjs`
   - Parses CSV data
   - Validates entries
   - Uploads to Supabase

3. **Documentation**: `docs/BAR_MENU_ITEMS_GUIDE.md`
   - Complete implementation guide
   - Query examples
   - Integration patterns

4. **Sample Data**: `data/bar-menu-items.csv`
   - Sample CSV format

## Your CSV Data Analysis

Based on your provided CSV, I found:

- **Total bars**: 27 unique bars
- **Total items**: ~2,850+ menu items
- **Categories**: 200+ unique categories
- **Price range**: €0.50 to €100+

### Sample Bars in Your Data:
1. Zion Reggae Bar (4d514423-222a-4b51-83ed-5202d3bf005b)
2. Victoria Gastro Pub (46105fa8-efc7-422a-afa8-a5188eb2f5ed)
3. The Long Hall Irish Pub (96bb748e-e827-4b04-9d18-e7b1df0c0f82)
4. The Londoner Pub Sliema (d215a76f-458e-4d4c-8c58-1cbf60a2d715)
5. The Brew Grill & Brewery (6d3df420-08b9-4b9b-8524-a6d85e99fd43)
... and 22 more

## Table Schema

```sql
bar_menu_items
├── id (UUID, PK)
├── bar_id (UUID, FK → bars.id)
├── bar_name (TEXT)
├── item_name (TEXT)
├── price (NUMERIC)
├── category (TEXT)
├── description (TEXT, nullable)
├── is_available (BOOLEAN)
├── display_order (INTEGER, nullable)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

### Constraints:
- **UNIQUE**: (bar_id, item_name, category)
- **CHECK**: price >= 0
- **FK CASCADE**: Deletes menu items when bar is deleted

## Quick Deploy Steps

### Method 1: Python Script (RECOMMENDED - Simplest)

```bash
# 1. Navigate to project
cd /Users/jeanbosco/workspace/easymo

# 2. Edit complete_menu_upload.py and paste your FULL CSV data into FULL_CSV_DATA variable

# 3. Generate SQL migration
python3 complete_menu_upload.py > supabase/migrations/20251206170000_upload_bar_menu_items.sql

# 4. Apply to database
export SUPABASE_DB_PASSWORD=Pq0jyevTlfoa376P
export SUPABASE_ACCESS_TOKEN=sbp_500607f0d078e919aa24f179473291544003a035
supabase db push

# OR use psql directly:
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
     -f supabase/migrations/20251206170000_upload_bar_menu_items.sql
```

### Method 2: Using CSV File

```bash
# 1. Save your CSV to: bar_menu_items_full.csv

# 2. Run automated script
./upload_menu_to_supabase.sh
```

## CSV Format Requirements

Your CSV must have exactly these columns (in this order):

```
bar name,bar_id,item name,price,category
```

### Example Row:
```csv
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Americano,1.6,Coffees & Teas
```

## Common Issues & Solutions

### ❌ "Foreign key violation on bar_id"
**Cause**: bar_id doesn't exist in `bars` table  
**Fix**: Verify bar exists first:
```sql
SELECT id, name FROM bars WHERE id = 'your-bar-id';
```

### ❌ "Duplicate key violation"
**Cause**: Item already exists with same name and category  
**Fix**: Script uses upsert, so it will update existing items

### ❌ "Invalid price"
**Cause**: Price is negative or not a number  
**Fix**: Check CSV for invalid price values

## Verification Queries

After upload, verify with:

```sql
-- Count items per bar
SELECT 
    bar_name,
    COUNT(*) as item_count
FROM bar_menu_items
GROUP BY bar_name
ORDER BY item_count DESC;

-- View sample items
SELECT 
    bar_name,
    item_name,
    category,
    price
FROM bar_menu_items
LIMIT 20;

-- Check for issues
SELECT 
    bar_id,
    bar_name,
    COUNT(*) as items
FROM bar_menu_items
WHERE is_available = false
GROUP BY bar_id, bar_name;
```

## Integration Example

### TypeScript/Node.js

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Get menu for a bar
async function getBarMenu(barId: string) {
  const { data, error } = await supabase
    .rpc('get_bar_menu_items', { p_bar_id: barId });
  
  if (error) throw error;
  return data;
}

// Get items by category
async function getMenuByCategory(barId: string, category: string) {
  const { data, error } = await supabase
    .rpc('get_bar_menu_by_category', { 
      p_bar_id: barId, 
      p_category: category 
    });
  
  if (error) throw error;
  return data;
}
```

### WhatsApp Bot Integration

```typescript
// Format menu for WhatsApp message
function formatMenuForWhatsApp(items: any[]) {
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});
  
  let message = '*📋 Menu*\n\n';
  
  Object.entries(grouped).forEach(([category, items]: [string, any[]]) => {
    message += `*${category}*\n`;
    items.forEach(item => {
      message += `• ${item.item_name} - €${item.price}\n`;
    });
    message += '\n';
  });
  
  return message;
}
```

## Performance Notes

- **Batch Size**: Script uploads in batches of 100 items
- **Indexes**: Created on bar_id, category, and is_available
- **RLS**: Public read access for available items only
- **Upsert**: Uses conflict resolution to update existing items

## Next Actions

1. [ ] Save your full CSV data to `data/bar-menu-items-full.csv`
2. [ ] Run `supabase db push` to apply migration
3. [ ] Set SUPABASE_SERVICE_ROLE_KEY env variable
4. [ ] Run upload script
5. [ ] Verify data in Supabase dashboard
6. [ ] Test queries
7. [ ] Integrate with WhatsApp bot

## Support Files

- **Migration**: `supabase/migrations/20251206160000_create_bar_menu_items.sql`
- **Upload Script**: `scripts/upload-bar-menu-items.mjs`
- **Documentation**: `docs/BAR_MENU_ITEMS_GUIDE.md`
- **Sample CSV**: `data/bar-menu-items.csv`

---

**Questions or Issues?**
- Check the full guide: `docs/BAR_MENU_ITEMS_GUIDE.md`
- View Supabase logs: `supabase db logs`
- Test in SQL Editor: Supabase Dashboard → SQL Editor
