#!/usr/bin/env python3
"""
Geocode businesses using their address, city, and country
Uses a free geocoding service (Nominatim OpenStreetMap)
"""

import psycopg2
import requests
import time
from urllib.parse import quote

# Database connection
DB_URL = "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

def geocode_address(address, city, country):
    """Geocode an address using Nominatim (OpenStreetMap)"""
    try:
        # Build search query
        parts = []
        if address:
            parts.append(address)
        if city:
            parts.append(city)
        if country:
            parts.append(country)
        
        query = ", ".join(parts)
        if not query:
            return None, None
        
        # Call Nominatim API
        url = f"https://nominatim.openstreetmap.org/search?q={quote(query)}&format=json&limit=1"
        headers = {'User-Agent': 'EasyMO-Business-Geocoder/1.0'}
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        if data and len(data) > 0:
            return float(data[0]['lat']), float(data[0]['lon'])
        
        return None, None
    except Exception as e:
        print(f"  Error geocoding '{query}': {e}")
        return None, None

def main():
    print("🌍 Starting geocoding of businesses without coordinates...")
    
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    # Get businesses without coordinates
    cur.execute("""
        SELECT id, name, address, city, country 
        FROM businesses 
        WHERE (lat IS NULL OR lng IS NULL) 
          AND address IS NOT NULL
        ORDER BY id
        LIMIT 500
    """)
    
    businesses = cur.fetchall()
    total = len(businesses)
    print(f"Found {total} businesses to geocode (max 500 per run)")
    
    success_count = 0
    fail_count = 0
    
    for i, (biz_id, name, address, city, country) in enumerate(businesses, 1):
        print(f"\n[{i}/{total}] {name[:50]}")
        print(f"  Address: {address}, {city}, {country}")
        
        lat, lng = geocode_address(address, city, country)
        
        if lat and lng:
            cur.execute("""
                UPDATE businesses 
                SET lat = %s, lng = %s, updated_at = NOW()
                WHERE id = %s
            """, (lat, lng, biz_id))
            conn.commit()
            print(f"  ✅ Geocoded: {lat}, {lng}")
            success_count += 1
        else:
            print(f"  ❌ Failed to geocode")
            fail_count += 1
        
        # Rate limiting - Nominatim requires 1 request per second
        if i < total:
            time.sleep(1.1)
    
    cur.close()
    conn.close()
    
    print(f"\n{'='*60}")
    print(f"✅ Geocoding complete!")
    print(f"  Success: {success_count}")
    print(f"  Failed: {fail_count}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
