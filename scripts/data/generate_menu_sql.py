#!/usr/bin/env python3
"""
Generate SQL INSERT statements for all bar menu items
"""

# Complete CSV data from the user
csv_lines = """Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Americano,1.6,Coffees & Teas
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

def escape_sql(text):
    """Escape single quotes for SQL"""
    if text is None:
        return ''
    return text.replace("'", "''")

def parse_csv_line(line):
    """Parse a CSV line handling commas in values"""
    parts = line.split(',')
    if len(parts) < 5:
        return None
    
    bar_name = parts[0]
    bar_id = parts[1]
    item_name = parts[2]
    try:
        price = float(parts[3])
    except ValueError:
        return None
    # Category might contain commas, so join the rest
    category = ','.join(parts[4:])
    
    return (bar_id, bar_name, item_name, price, category)

# Generate SQL
sql_statements = []
sql_statements.append("-- Upload all bar menu items")
sql_statements.append("-- Generated from CSV data\n")
sql_statements.append("BEGIN;\n")
sql_statements.append("INSERT INTO public.bar_menu_items (bar_id, bar_name, item_name, price, category) VALUES")

values = []
for line in csv_lines.strip().split('\n'):
    parsed = parse_csv_line(line)
    if parsed:
        bar_id, bar_name, item_name, price, category = parsed
        value = f"('{bar_id}', '{escape_sql(bar_name)}', '{escape_sql(item_name)}', {price}, '{escape_sql(category)}')"
        values.append(value)

# Join with commas and newlines
sql_statements.append(',\n'.join(values))
sql_statements.append(";")
sql_statements.append("\n\nCOMMIT;")

sql_content = '\n'.join(sql_statements)

# Write to file
output_file = 'supabase/migrations/20251206174200_upload_bar_menu_items_full.sql'
with open(output_file, 'w') as f:
    f.write(sql_content)

print(f"Generated SQL file: {output_file}")
print(f"Total menu items: {len(values)}")
print(f"\nFirst 3 SQL values:")
for v in values[:3]:
    print(v)
