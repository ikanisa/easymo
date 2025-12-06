# Bar Menu Items Upload Guide

## Overview
This guide helps you upload menu items from CSV to the Supabase `bar_menu_items` table.

## Database Schema

The `bar_menu_items` table has the following structure:

```sql
CREATE TABLE public.bar_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id UUID NOT NULL REFERENCES public.bars(id),
    bar_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    is_available BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    CONSTRAINT bar_menu_items_unique_item UNIQUE (bar_id, item_name, category)
);
```

## CSV Format

Your CSV should have these columns:
```
bar name,bar_id,item name,price,category
```

Example:
```csv
bar name,bar_id,item name,price,category
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Americano,1.6,Coffees & Teas
Victoria Gastro Pub,46105fa8-efc7-422a-afa8-a5188eb2f5ed,Aljotta,8.5,Soup
```

## Upload Methods

### Method 1: Using Complete Python Script (RECOMMENDED)

1. **Edit the script** `complete_menu_upload.py`:
   - Replace the `FULL_CSV_DATA` variable with your complete CSV data
   
2. **Generate SQL**:
   ```bash
   python3 complete_menu_upload.py > supabase/migrations/20251206170000_upload_bar_menu_items.sql
   ```

3. **Apply to database**:
   ```bash
   # Using Supabase CLI
   supabase db push
   
   # OR using psql directly
   psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
        -f supabase/migrations/20251206170000_upload_bar_menu_items.sql
   ```

### Method 2: Using CSV File

1. **Save your CSV data** to `bar_menu_items_full.csv`

2. **Run the upload script**:
   ```bash
   ./upload_menu_to_supabase.sh
   ```

### Method 3: Manual SQL Generation

1. **Create CSV file** with your data
2. **Use Python to generate SQL**:
   ```python
   import csv
   
   with open('menu_items.csv', 'r') as f:
       reader = csv.DictReader(f)
       for row in reader:
           print(f"('{row['bar_id']}', '{row['bar name']}', '{row['item name']}', {row['price']}, '{row['category']}', true),")
   ```

3. **Wrap in SQL transaction** and apply

## Database Connection

```bash
# Connection String
postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres

# PAT Token  
sbp_500607f0d078e919aa24f179473291544003a035
```

## Verification

After upload, verify your data:

```sql
-- Count items per bar
SELECT bar_name, COUNT(*) as items 
FROM bar_menu_items 
GROUP BY bar_name 
ORDER BY bar_name;

-- Get menu for specific bar
SELECT * FROM get_bar_menu_items('4d514423-222a-4b51-83ed-5202d3bf005b');

-- Get items by category
SELECT * FROM get_bar_menu_by_category('4d514423-222a-4b51-83ed-5202d3bf005b', 'Coffees & Teas');
```

## Key Features

- **UPSERT Logic**: Automatically updates existing items or inserts new ones
- **Conflict Resolution**: Uses `(bar_id, item_name, category)` as unique key
- **SQL Injection Protection**: All strings are properly escaped
- **RLS Policies**: Public can read available items, service role can manage all
- **Helper Functions**: Built-in functions for querying menus

## Troubleshooting

### Issue: "relation bar_menu_items does not exist"
**Solution**: Run the table creation migration first:
```bash
supabase db push
# OR apply: supabase/migrations/20251206160000_create_bar_menu_items.sql
```

### Issue: "bars" table foreign key constraint
**Solution**: Ensure bars exist in the `bars` table before inserting menu items.

### Issue: Duplicate item errors
**Solution**: The UPSERT will handle this automatically via `ON CONFLICT`.

## File Locations

- **Table Schema**: `supabase/migrations/20251206160000_create_bar_menu_items.sql`
- **Upload Script**: `complete_menu_upload.py`
- **Shell Script**: `upload_menu_to_supabase.sh`
- **This Guide**: `BAR_MENU_UPLOAD_GUIDE.md`

## Example Query Usage

```sql
-- Get full menu
SELECT * FROM bar_menu_items WHERE bar_id = '4d514423-222a-4b51-83ed-5202d3bf005b';

-- Get by category
SELECT item_name, price FROM bar_menu_items 
WHERE bar_id = '4d514423-222a-4b51-83ed-5202d3bf005b' 
  AND category = 'Coffees & Teas'
ORDER BY price;

-- Categories for a bar
SELECT DISTINCT category FROM bar_menu_items 
WHERE bar_id = '4d514423-222a-4b51-83ed-5202d3bf005b'
ORDER BY category;
```

## Next Steps

1. ✅ Create/verify table exists (`20251206160000_create_bar_menu_items.sql`)
2. ✅ Prepare your complete CSV data
3. ✅ Run `complete_menu_upload.py` to generate SQL
4. ✅ Apply migration using `supabase db push` or `psql`
5. ✅ Verify data with sample queries

## Support

For issues or questions:
- Check migration files in `supabase/migrations/`
- Review helper functions: `get_bar_menu_items()`, `get_bar_menu_by_category()`
- Ensure RLS policies are correctly configured
