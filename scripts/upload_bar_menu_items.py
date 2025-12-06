#!/usr/bin/env python3
"""
Script to convert CSV menu items to SQL INSERT statements
"""

import csv
import io

# CSV data embedded in script
csv_data = """bar name,bar_id,item name,price,category
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
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Boost Your Smoothie,0.5,Smoothies & Fresh Juices
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Bruschetta Mare e Monti,13,Starters to Share   Sharing Platters
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Caponata,3,Sides & Extras
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Cappuccino,2.5,Coffees & Teas"""

def escape_sql_string(s):
    """Escape single quotes for SQL"""
    return s.replace("'", "''")

def generate_insert_statements():
    """Generate SQL INSERT statements from CSV data"""
    
    reader = csv.DictReader(io.StringIO(csv_data))
    
    statements = []
    current_bar = None
    values = []
    
    for row in reader:
        bar_id = row['bar_id'].strip()
        bar_name = escape_sql_string(row['bar name'].strip())
        item_name = escape_sql_string(row['item name'].strip())
        price = row['price'].strip()
        category = escape_sql_string(row['category'].strip())
        
        # If we're starting a new bar, output previous batch
        if current_bar and current_bar != bar_id:
            if values:
                statements.append(f"INSERT INTO public.bar_menu_items (bar_id, bar_name, item_name, price, category, is_available)\nVALUES\n{','.join(values)}\nON CONFLICT (bar_id, item_name, category) DO UPDATE\nSET price = EXCLUDED.price, bar_name = EXCLUDED.bar_name, updated_at = timezone('utc', now());\n")
                values = []
        
        current_bar = bar_id
        value = f"    ('{bar_id}', '{bar_name}', '{item_name}', {price}, '{category}', true)"
        values.append(value)
    
    # Output final batch
    if values:
        statements.append(f"INSERT INTO public.bar_menu_items (bar_id, bar_name, item_name, price, category, is_available)\nVALUES\n{',\n'.join(values)}\nON CONFLICT (bar_id, item_name, category) DO UPDATE\nSET price = EXCLUDED.price, bar_name = EXCLUDED.bar_name, updated_at = timezone('utc', now());\n")
    
    return statements

if __name__ == "__main__":
    print("BEGIN;")
    print()
    print("-- Upload bar menu items")
    print("-- Generated from CSV data")
    print()
    
    statements = generate_insert_statements()
    for stmt in statements:
        print(stmt)
    
    print("COMMIT;")
