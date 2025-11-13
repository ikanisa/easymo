#!/usr/bin/env python3
"""
Extract latitude and longitude from Google Maps URLs in business table
Handles multiple Google Maps URL formats without requiring Geocoding API
"""

import os
import sys
import re
import psycopg2
from urllib.parse import urlparse, parse_qs, unquote
from typing import Optional, Tuple

# Configuration
DATABASE_URL = "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

def extract_coords_from_maps_url(url: str) -> Optional[Tuple[float, float]]:
    """
    Extract lat/lng from various Google Maps URL formats:
    1. https://www.google.com/maps/@-1.9524,30.0606,17z
    2. https://www.google.com/maps/place/.../@-1.9524,30.0606,17z
    3. https://maps.google.com/?q=-1.9524,30.0606
    4. https://www.google.com/maps/search/-1.9524,+30.0606
    """
    if not url or not isinstance(url, str):
        return None
    
    try:
        # Pattern 1: /@lat,lng format
        match = re.search(r'/@(-?\d+\.\d+),(-?\d+\.\d+)', url)
        if match:
            lat, lng = float(match.group(1)), float(match.group(2))
            return (lat, lng)
        
        # Pattern 2: ?q=lat,lng format
        match = re.search(r'[?&]q=(-?\d+\.\d+)[,+](-?\d+\.\d+)', url)
        if match:
            lat, lng = float(match.group(1)), float(match.group(2))
            return (lat, lng)
        
        # Pattern 3: /search/?...lat,lng
        match = re.search(r'(-?\d+\.\d+)[,+](-?\d+\.\d+)', url)
        if match:
            lat, lng = float(match.group(1)), float(match.group(2))
            # Basic validation
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return (lat, lng)
        
    except Exception as e:
        print(f"  ⚠️  Error parsing URL {url}: {e}")
    
    return None


def extract_place_name_from_url(url: str) -> Optional[str]:
    """
    Extract place name from Google Maps search URL for manual lookup
    """
    if not url or not isinstance(url, str):
        return None
    
    try:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        
        # Try query parameter
        if "query" in qs and qs["query"]:
            return unquote(qs["query"][0])
        
        # Try q parameter
        if "q" in qs and qs["q"]:
            q_val = unquote(qs["q"][0])
            # Skip if it's just coordinates
            if not re.match(r'^-?\d+\.\d+[,\s]+-?\d+\.\d+$', q_val):
                return q_val
        
        # Try to extract from /place/ URLs
        match = re.search(r'/place/([^/@]+)', url)
        if match:
            return unquote(match.group(1).replace('+', ' '))
            
    except Exception as e:
        print(f"  ⚠️  Error extracting place name: {e}")
    
    return None


def process_businesses():
    """
    Connect to database and process all businesses with maps_url but no coordinates
    """
    print("=" * 60)
    print("Google Maps URL Coordinate Extraction")
    print("=" * 60)
    print()
    
    try:
        # Connect to database
        print(f"📡 Connecting to database...")
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Get businesses that need coordinate extraction
        cursor.execute("""
            SELECT id, name, maps_url, location_text, lat, lng
            FROM public.business
            WHERE maps_url IS NOT NULL
            AND maps_url != ''
            ORDER BY created_at DESC
        """)
        
        businesses = cursor.fetchall()
        total = len(businesses)
        
        if total == 0:
            print("✅ No businesses with maps_url found.")
            cursor.close()
            conn.close()
            return
        
        print(f"📍 Found {total} businesses with Google Maps URLs\n")
        
        processed = 0
        success = 0
        skipped = 0
        failed = 0
        need_manual = []
        
        for business in businesses:
            business_id, name, maps_url, location_text, existing_lat, existing_lng = business
            processed += 1
            
            # Skip if already has coordinates
            if existing_lat is not None and existing_lng is not None:
                skipped += 1
                if processed % 100 == 0:
                    print(f"[{processed}/{total}] Processed {processed}, skipped {skipped} (already have coords)")
                continue
            
            print(f"[{processed}/{total}] Processing: {name}")
            print(f"  URL: {maps_url[:80]}...")
            
            # Try to extract coordinates from URL
            coords = extract_coords_from_maps_url(maps_url)
            
            if coords is None:
                # Try to extract place name for manual lookup
                place_name = extract_place_name_from_url(maps_url)
                if place_name:
                    need_manual.append({
                        'id': business_id,
                        'name': name,
                        'place': place_name,
                        'url': maps_url
                    })
                    print(f"  ⚠️  No coords in URL, place: {place_name}")
                else:
                    print(f"  ⚠️  Could not extract coordinates or place name")
                failed += 1
                continue
            
            lat, lng = coords
            
            # Update database
            try:
                cursor.execute("""
                    UPDATE public.business
                    SET lat = %s, lng = %s, 
                        location = ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                    WHERE id = %s
                """, (lat, lng, lng, lat, business_id))
                conn.commit()
                
                success += 1
                print(f"  ✅ Updated: lat={lat:.6f}, lng={lng:.6f}\n")
                
            except Exception as e:
                print(f"  ❌ Database error: {e}\n")
                failed += 1
                conn.rollback()
        
        cursor.close()
        conn.close()
        
        # Summary
        print("=" * 60)
        print("Summary")
        print("=" * 60)
        print(f"Total processed: {processed}")
        print(f"✅ Successful: {success}")
        print(f"⏭️  Skipped (already have coords): {skipped}")
        print(f"⚠️  Need manual geocoding: {len(need_manual)}")
        print(f"❌ Failed: {failed - len(need_manual)}")
        print("=" * 60)
        
        # Show businesses that need manual geocoding
        if need_manual:
            print()
            print("📝 Businesses requiring manual geocoding:")
            print("   (URLs contain place names but not coordinates)")
            print()
            for item in need_manual[:10]:  # Show first 10
                print(f"   • {item['name']}")
                print(f"     Place: {item['place']}")
                print(f"     URL: {item['url'][:70]}...")
                print()
            
            if len(need_manual) > 10:
                print(f"   ... and {len(need_manual) - 10} more")
            
            print()
            print("💡 To geocode these, you need to:")
            print("   1. Enable billing on Google Cloud Project")
            print("   2. Enable Geocoding API")
            print("   3. Use the original extract_coordinates.py script")
            print()
        
    except psycopg2.Error as e:
        print(f"❌ Database connection error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    # Example test
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        test_urls = [
            "https://www.google.com/maps/@-1.9524,30.0606,17z",
            "https://www.google.com/maps/place/Name/@-1.9524,30.0606,17z",
            "https://maps.google.com/?q=-1.9524,30.0606",
            "https://www.google.com/maps/search/?api=1&query=Danube+Home+Kigali",
        ]
        
        print("Testing coordinate extraction:\n")
        for url in test_urls:
            print(f"URL: {url}")
            coords = extract_coords_from_maps_url(url)
            place = extract_place_name_from_url(url)
            if coords:
                print(f"  ✅ Coords: {coords[0]:.6f}, {coords[1]:.6f}")
            elif place:
                print(f"  ⚠️  No coords, place name: {place}")
            else:
                print(f"  ❌ No coords or place name found")
            print()
    else:
        # Process all businesses
        process_businesses()
