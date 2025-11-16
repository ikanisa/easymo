# Bar Menu Items Seed Data

## Overview

This seed file populates the `restaurant_menu_items` table with a comprehensive menu shared across 97 bars in the EasyMO platform.

## File: `bar_menu_items_seed.sql`

### Statistics
- **Total Bars**: 97
- **Total Menu Items**: 184 (per bar)
- **Total Records**: 17,848 (97 bars × 184 items)
- **Categories**: 26 different menu categories

### Menu Categories Breakdown

| Category | Count | Examples |
|----------|-------|----------|
| BEERS | 21 | Amstel, Corona, Guinness, Heineken, Tusker |
| BREAKFAST | 1 | Omelette |
| CIDERSS | 3 | Savanna Cider, Smirnoff Ice |
| COCKTAILS | 25 | Mojito, Margarita, Martini, Piña Colada |
| COFFEE | 6 | Espresso, Cappuccino, Latte, Americano |
| DESSERTS | 4 | Chocolate Cake, Fruit Salad, Avocado Smoothie |
| ENERGY DRINKS | 3 | Red Bull, Monster Energy |
| FAST FOOD | 6 | Burgers, Shawarma, Samosas, Chapati |
| GIN | 6 | Bombay Sapphire, Gordon's, Hendrick's |
| GRILL | 9 | Brochettes, Steaks, BBQ Ribs, Nyama Choma |
| JUICES | 9 | Fresh juices, Inyange branded drinks |
| LIQUORS | 9 | Baileys, Jagermeister, Campari |
| MAIN COURSES | 3 | BBQ Chicken, Beef Stew, Chicken Curry |
| PASTA | 3 | Spaghetti Bolognese, Carbonara, Lasagna |
| PIZZA | 7 | Margherita, Pepperoni, Meat Lovers |
| RUM | 5 | Bacardi, Havana Club, Captain Morgan |
| SIDE DISHES | 3 | French Fries, Fried Bananas, Meat Pie |
| SODA | 9 | Coca-Cola, Fanta, Sprite, Tonic Water |
| SOUP | 4 | Pumpkin Soup, Peanut Soup, Mushroom Soup |
| SPIRITS | 9 | Vodka, Tequila, Uganda Waragi |
| TEA | 3 | Black Tea, Green Tea, Ginger Tea |
| TRADITIONAL | 7 | Isombe, Matoke, Ugali, Agatogo |
| VEGETARIAN | 3 | Kachumbari, Avocado Salad |
| WATER | 3 | Mineral Water, Sparkling Water |
| WHISKEY | 16 | Johnnie Walker, Jack Daniel's, Jameson |
| WINES | 7 | Red and White wines |

## Usage

### Prerequisites
1. Ensure the migration `20260322110000_bars_restaurants_menu_system.sql` has been applied
2. Ensure all 97 bar records exist in the `bars` table with the specified UUIDs
3. The seed now reconciles missing UUIDs by querying `public.bars`; it aborts if the final list still differs from 97 entries. Fix upstream data issues before rerunning if this happens.

### Execution

#### Using Supabase CLI (Recommended)
```bash
# Run the seed file
supabase db seed -f supabase/seed/fixtures/bar_menu_items_seed.sql
```

#### Using psql directly
```bash
psql -h localhost -U postgres -d postgres -f supabase/seed/fixtures/bar_menu_items_seed.sql
```

#### Using Supabase Dashboard
1. Go to the SQL Editor in your Supabase Dashboard
2. Copy and paste the contents of `bar_menu_items_seed.sql`
3. Execute the SQL

### Integration with Main Seed File

To include this as part of the regular seeding process, add to `supabase/seed/seed.sql`:

```sql
-- Include bar menu items
\i fixtures/bar_menu_items_seed.sql
```

## Data Structure

Each menu item includes:
- `bar_id`: UUID of the bar (from the predefined list of 97 bars)
- `name`: Item name (e.g., "Mojito", "Beef Burger")
- `category`: Category name (e.g., "COCKTAILS", "FAST FOOD")
- `description`: Item description (may be empty)
- `price`: Set to 0.00 (to be updated by bar managers)
- `currency`: "RWF" (Rwandan Franc)
- `is_available`: true (all items available by default)
- `ocr_extracted`: false (manually curated menu)

## Notes

### Price Updates
All items are seeded with a price of `0.00`. Bar managers should update prices through:
1. The admin panel
2. Direct database updates
3. OCR menu upload feature

### Customization
Individual bars can:
- Update prices for their location
- Mark items as unavailable (`is_available = false`)
- Add custom descriptions
- Upload images (`image_url`)

### Bar IDs
The seed file includes 97 pre-defined bar UUIDs. Ensure these bars exist before running the seed:
- `00710229-f8b1-4903-980f-ddcb3580dcf2`
- `01c7812c-b553-4594-a598-52641f057952`
- ... (see full list in seed file)

## Verification

After seeding, verify the data:

```sql
-- Check total records inserted
SELECT COUNT(*) FROM public.restaurant_menu_items;
-- Expected: 17,848

-- Check items per bar
SELECT bar_id, COUNT(*) as item_count 
FROM public.restaurant_menu_items 
GROUP BY bar_id 
ORDER BY item_count DESC;
-- Expected: Each bar should have 184 items

-- Check categories
SELECT category, COUNT(*) as item_count 
FROM public.restaurant_menu_items 
GROUP BY category 
ORDER BY item_count DESC;
```

## Rollback

To remove all seeded menu items:

```sql
-- Delete all menu items for the seeded bars
DELETE FROM public.restaurant_menu_items 
WHERE bar_id IN (
  '00710229-f8b1-4903-980f-ddcb3580dcf2',
  '01c7812c-b553-4594-a598-52641f057952',
  -- ... (include all 97 bar IDs)
);
```

## Support

For issues or questions:
1. Check that the `restaurant_menu_items` table exists
2. Verify bar IDs exist in the `bars` table
3. Check PostgreSQL logs for constraint violations
4. Review RLS policies if access issues occur
