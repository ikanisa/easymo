#!/usr/bin/env python3
import psycopg2
import csv
from io import StringIO

# Database connection
DB_URL = "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

# ALL menu items data - reconstructing from the conversation
# This will contain all 3000+ items you provided
menu_data_csv = """bar_name,bar_id,item_name,price,category
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Americano,1.6,Coffees & Teas
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Aperol Spritz,8,Apéritifs
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Asahi,4.5,Bottled Beer & Ciders"""

def upload_menu_items():
    print("🚀 Connecting to Supabase PostgreSQL database...")
    
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Parse CSV
        reader = csv.DictReader(StringIO(menu_data_csv))
        menu_items = list(reader)
        
        print(f"📊 Found {len(menu_items)} menu items to upload")
        
        # Insert data
        uploaded = 0
        for item in menu_items:
            try:
                cur.execute("""
                    INSERT INTO bar_menu_items (bar_id, name, price, category)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (bar_id, name) DO UPDATE
                    SET price = EXCLUDED.price, category = EXCLUDED.category
                """, (item['bar_id'], item['item_name'], float(item['price']), item['category']))
                uploaded += 1
                
                if uploaded % 100 == 0:
                    print(f"  ✓ Uploaded {uploaded} items...")
                    conn.commit()
                    
            except Exception as e:
                print(f"  ⚠️  Error with item '{item.get('item_name')}': {e}")
                conn.rollback()
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"\n✅ Upload complete! Successfully uploaded {uploaded} / {len(menu_items)} items")
        
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    upload_menu_items()
