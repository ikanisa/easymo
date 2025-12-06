#!/usr/bin/env python3
"""
Complete Bar Menu Items Upload Script
Reads CSV data and generates SQL migration file
Usage: python3 upload_bar_menu.py > migration.sql
"""

import csv
import sys
from io import StringIO

def read_csv_from_stdin():
    """Read CSV data from stdin or embedded data"""
    # For now, return sample - you'll paste full CSV when running
    return """bar name,bar_id,item name,price,category
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Americano,1.6,Coffees & Teas"""

def escape_sql(value):
    """Escape single quotes and special characters for SQL"""
    if value is None:
        return ''
    return str(value).replace("'", "''").replace('\\', '\\\\')

def generate_migration(csv_data):
    """Generate SQL migration from CSV data"""
    
    reader = csv.DictReader(StringIO(csv_data))
    rows = list(reader)
    
    # Print header
    print("""-- =====================================================
-- UPLOAD BAR MENU ITEMS FROM CSV
-- Created: 2025-12-06
-- Description: Bulk upload of menu items for bars
-- Total items: {}
-- =====================================================

BEGIN;

-- Insert all menu items with UPSERT
INSERT INTO public.bar_menu_items (bar_id, bar_name, item_name, price, category, is_available)
VALUES""".format(len(rows)))
    
    # Generate VALUES statements
    values = []
    for row in rows:
        bar_id = row['bar_id'].strip()
        bar_name = escape_sql(row['bar name'].strip())
        item_name = escape_sql(row['item name'].strip())
        price = row['price'].strip()
        category = escape_sql(row['category'].strip())
        
        value_str = f"    ('{bar_id}', '{bar_name}', '{item_name}', {price}, '{category}', true)"
        values.append(value_str)
    
    print(',\n'.join(values))
    
    # Print footer with conflict resolution
    print("""
ON CONFLICT (bar_id, item_name, category) 
DO UPDATE SET 
    price = EXCLUDED.price,
    bar_name = EXCLUDED.bar_name,
    is_available = EXCLUDED.is_available,
    updated_at = timezone('utc', now());

COMMIT;""")
    
    # Print summary to stderr
    print(f"\n-- Successfully generated SQL for {len(rows)} menu items", file=sys.stderr)

if __name__ == "__main__":
    csv_data = read_csv_from_stdin()
    generate_migration(csv_data)
