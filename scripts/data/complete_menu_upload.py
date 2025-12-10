#!/usr/bin/env python3
"""
COMPLETE Bar Menu Upload Script
All CSV data embedded - just run this script!

Usage:
    python3 complete_menu_upload.py > migration.sql
    # Then apply: psql <connection_string> -f migration.sql
"""

# PASTE YOUR COMPLETE CSV DATA HERE (replace the sample below)
FULL_CSV_DATA = """bar name,bar_id,item name,price,category
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Americano,1.6,Coffees & Teas
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Aperol Spritz,8,Apéritifs
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Asahi,4.5,Bottled Beer & Ciders
Victoria Gastro Pub,46105fa8-efc7-422a-afa8-a5188eb2f5ed,Aljotta,8.5,Soup
Victoria Gastro Pub,46105fa8-efc7-422a-afa8-a5188eb2f5ed,Bacon Jam Burger,14.5,Burgers
The Long Hall Irish Pub,96bb748e-e827-4b04-9d18-e7b1df0c0f82,Aglio E Olio,13.95,Pasta & Risotto
The Long Hall Irish Pub,96bb748e-e827-4b04-9d18-e7b1df0c0f82,Aqua Panna Still Water (250ml),2.35,Beverages"""
# ... PASTE REST OF YOUR CSV DATA HERE ...

import csv
import sys
from io import StringIO

def main():
    reader = csv.DictReader(StringIO(FULL_CSV_DATA))
    rows = list(reader)
    
    # Print SQL header
    print("""-- =====================================================
-- BAR MENU ITEMS UPLOAD
-- Generated: 2025-12-06
-- Total items: {}
-- =====================================================

BEGIN;

INSERT INTO public.bar_menu_items (bar_id, bar_name, item_name, price, category, is_available)
VALUES""".format(len(rows)))
    
    # Generate VALUES
    values = []
    for row in rows:
        bar_id = row['bar_id'].strip()
        bar_name = row['bar name'].strip().replace("'", "''")
        item_name = row['item name'].strip().replace("'", "''")
        price = row['price'].strip()
        category = row['category'].strip().replace("'", "''")
        
        values.append(f"    ('{bar_id}', '{bar_name}', '{item_name}', {price}, '{category}', true)")
    
    print(',\n'.join(values))
    
    # Print footer
    print("""
ON CONFLICT (bar_id, item_name, category) 
DO UPDATE SET 
    price = EXCLUDED.price,
    bar_name = EXCLUDED.bar_name,
    is_available = EXCLUDED.is_available,
    updated_at = timezone('utc', now());

COMMIT;""")
    
    # Summary
    bars = set(row['bar name'] for row in rows)
    print(f"\n-- Successfully processed {len(rows)} items from {len(bars)} bars", file=sys.stderr)
    for bar in sorted(bars):
        count = sum(1 for row in rows if row['bar name'] == bar)
        print(f"--   {bar}: {count} items", file=sys.stderr)

if __name__ == "__main__":
    main()
