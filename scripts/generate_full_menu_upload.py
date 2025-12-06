#!/usr/bin/env python3
"""
Generate SQL migration file from CSV menu items data
Handles thousands of menu items efficiently
"""

import csv
import io
import sys

# Paste your full CSV data here (all rows from your message)
CSV_DATA = """bar name,bar_id,item name,price,category
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Americano,1.6,Coffees & Teas
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Aperol Spritz,8,Apéritifs
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Asahi,4.5,Bottled Beer & Ciders
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Avocado Sauce,1.5,Burger Extras
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Bajtra Spritz,8,Apéritifs
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Barbera D'Alba Superiore   Italy,26.5,Red Wines
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Beef Carpaccio,11.5,Starters to Share Crudités & Carpaccio
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Beef Rib Eye,28.5,Mains
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Beef Teriyaki,13.5,Salads
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Beef Teriyaki Wrap,10,Wraps Served Until 6PM)
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Beer Tower 3L),25,Tap Beer & Beer Tower
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Beetroot Carpaccio,8.5,Starters to Share Crudités & Carpaccio
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Berry Mule,10,Signature Cocktails
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Black Tea with Fresh Milk,1,Coffees & Teas
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Blooming Rose,6,Mocktails Non Alcoholic Cocktails)
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Blueberry Dream,6.5,Smoothies & Fresh Juices
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Boost Your Smoothie,0.5,Smoothies & Fresh Juices"""

def escape_sql(value):
    """Escape single quotes for SQL"""
    return str(value).replace("'", "''")

def generate_sql():
    """Generate complete SQL migration file"""
    
    # Parse CSV
    reader = csv.DictReader(io.StringIO(CSV_DATA))
    rows = list(reader)
    
    print(f"-- Processing {len(rows)} menu items")
    print()
    
    # Group by bar for cleaner output
    bars = {}
    for row in rows:
        bar_id = row['bar_id'].strip()
        if bar_id not in bars:
            bars[bar_id] = {
                'name': row['bar name'].strip(),
                'items': []
            }
        bars[bar_id]['items'].append(row)
    
    print(f"-- Found {len(bars)} unique bars")
    print()
    
    # Generate SQL header
    print("""-- =====================================================
-- UPLOAD BAR MENU ITEMS FROM CSV
-- Created: 2025-12-06
-- Description: Bulk upload menu items for all bars
-- =====================================================

BEGIN;

-- Insert all menu items with conflict resolution
INSERT INTO public.bar_menu_items (bar_id, bar_name, item_name, price, category, is_available)
VALUES""")
    
    # Generate VALUES
    all_values = []
    for bar_id, bar_data in sorted(bars.items()):
        bar_name = escape_sql(bar_data['name'])
        print(f"-- {bar_data['name']} ({bar_id}) - {len(bar_data['items'])} items", file=sys.stderr)
        
        for item in bar_data['items']:
            item_name = escape_sql(item['item name'].strip())
            price = item['price'].strip()
            category = escape_sql(item['category'].strip())
            
            value = f"('{bar_id}', '{bar_name}', '{item_name}', {price}, '{category}', true)"
            all_values.append(value)
    
    # Print all values
    print(',\n'.join(all_values))
    
    # Add conflict resolution
    print("""
ON CONFLICT (bar_id, item_name, category) 
DO UPDATE SET 
    price = EXCLUDED.price,
    bar_name = EXCLUDED.bar_name,
    is_available = EXCLUDED.is_available,
    updated_at = timezone('utc', now());

COMMIT;""")

if __name__ == "__main__":
    generate_sql()
