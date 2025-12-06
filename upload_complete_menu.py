#!/usr/bin/env python3
"""
Upload bar menu items to Supabase from CSV data
"""
import json
import csv
from io import StringIO

# Your complete CSV data
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
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Boost Your Smoothie,0.5,Smoothies & Fresh Juices
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Bruschetta Mare e Monti,13,Starters to Share   Sharing Platters
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Caponata,3,Sides & Extras"""

# Parse CSV and create JSON output
def parse_csv_to_json():
    csv_file = StringIO(CSV_DATA)
    reader = csv.DictReader(csv_file)
    
    menu_items = []
    for row in reader:
        try:
            item = {
                "bar_id": row["bar_id"],
                "bar_name": row["bar name"],
                "item_name": row["item name"],
                "price": float(row["price"]),
                "category": row["category"]
            }
            menu_items.append(item)
        except (ValueError, KeyError) as e:
            print(f"Error parsing row: {row}, error: {e}")
            continue
    
    return menu_items

# Generate JavaScript/Node upload script
menu_items = parse_csv_to_json()
print(f"Parsed {len(menu_items)} menu items")
print(f"\nFirst 3 items:")
for item in menu_items[:3]:
    print(json.dumps(item, indent=2))

# Save to JSON file
with open('menu_items.json', 'w') as f:
    json.dump(menu_items, f, indent=2)
print(f"\nSaved {len(menu_items)} items to menu_items.json")
