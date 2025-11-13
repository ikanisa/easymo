#!/usr/bin/env python3
"""
Extract latitude and longitude from Google Maps URLs in business table.
Updates the lat/lng columns in the business table.
"""

import os
import sys
import time
import requests
import psycopg2
from urllib.parse import urlparse, parse_qs, unquote
from typing import Optional, Tuple

# Configuration
GOOGLE_MAPS_API_KEY = "AIzaSyCVbVWLFl5O2TdL7zDAjM08ws9D6IxPEFw"
DATABASE_URL = "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

# Rate limiting
REQUESTS_PER_SECOND = 10  # Google allows 50/sec but be conservative
DELAY_BETWEEN_REQUESTS = 1.0 / REQUESTS_PER_SECOND


def extract_query_from_maps_url(url: str) -> Optional[str]:
    """
    Extract the 'query' parameter from a Google Maps search URL.
    Example:
      https://www.google.com/maps/search/?api=1&query=Danube+Home+Kigali,...
    """
    try:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)

        if "query" in qs and qs["query"]:
            # parse_qs returns a list of values for each key
            raw_query = qs["query"][0]
            return unquote(raw_query)
    except Exception as e:
        print(f"Error parsing URL {url}: {e}")
    
    return None


def geocode_address(address: str) -> Optional[Tuple[float, float]]:
    """
    Use Google Geocoding API to convert an address/place string into (lat, lng).
    """
    if not GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY == "YOUR_API_KEY_HERE":
        raise RuntimeError("Set GOOGLE_MAPS_API_KEY in the script.")

    endpoint = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": address,
        "key": GOOGLE_MAPS_API_KEY,
    }

    try:
        resp = requests.get(endpoint, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") != "OK" or not data.get("results"):
            print(f"  Geocoding failed: {data.get('status')} - {data.get('error_message', 'No results')}")
            return None

        loc = data["results"][0]["geometry"]["location"]
        return float(loc["lat"]), float(loc["lng"])
    
    except requests.RequestException as e:
        print(f"  Request error: {e}")
        return None


def update_business_coordinates(conn, business_id: str, lat: float, lng: float):
    """Update the lat and lng columns for a business."""
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE business 
            SET lat = %s, 
                lng = %s,
                location = ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
            WHERE id = %s
            """,
            (lat, lng, lng, lat, business_id)  # PostGIS uses lng,lat order
        )
        conn.commit()
        cursor.close()
    except Exception as e:
        print(f"  Database error updating {business_id}: {e}")
        conn.rollback()


def main():
    """Main function to process all businesses with location URLs."""
    
    print("🗺️  Extracting coordinates from Google Maps URLs...")
    print(f"API Key: {GOOGLE_MAPS_API_KEY[:20]}...")
    print(f"Database: {DATABASE_URL.split('@')[1]}\n")
    
    # Connect to database
    try:
        conn = psycopg2.connect(DATABASE_URL)
        print("✅ Connected to database\n")
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        sys.exit(1)
    
    # Get businesses with location_url but no coordinates
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, name, location_url
        FROM business
        WHERE location_url IS NOT NULL 
        AND location_url != ''
        AND (lat IS NULL OR lng IS NULL)
        ORDER BY created_at DESC
        """
    )
    
    businesses = cursor.fetchall()
    total = len(businesses)
    
    print(f"📊 Found {total} businesses without coordinates\n")
    
    if total == 0:
        print("✅ All businesses already have coordinates!")
        conn.close()
        return
    
    # Process each business
    success_count = 0
    failed_count = 0
    
    for idx, (business_id, name, location_url) in enumerate(businesses, 1):
        print(f"[{idx}/{total}] Processing: {name[:50]}...")
        
        # Extract query from URL
        query = extract_query_from_maps_url(location_url)
        if not query:
            print(f"  ⚠️  No query found in URL")
            failed_count += 1
            continue
        
        print(f"  📍 Query: {query[:80]}...")
        
        # Geocode the address
        coords = geocode_address(query)
        if coords is None:
            print(f"  ❌ Could not geocode")
            failed_count += 1
            time.sleep(DELAY_BETWEEN_REQUESTS)
            continue
        
        lat, lng = coords
        print(f"  ✅ Found: ({lat:.6f}, {lng:.6f})")
        
        # Update database
        update_business_coordinates(conn, business_id, lat, lng)
        success_count += 1
        
        # Rate limiting
        time.sleep(DELAY_BETWEEN_REQUESTS)
        
        # Progress update every 10 items
        if idx % 10 == 0:
            print(f"\n📈 Progress: {idx}/{total} ({success_count} success, {failed_count} failed)\n")
    
    cursor.close()
    conn.close()
    
    # Summary
    print("\n" + "="*60)
    print("🎉 PROCESSING COMPLETE")
    print("="*60)
    print(f"Total processed:  {total}")
    print(f"✅ Successful:    {success_count}")
    print(f"❌ Failed:        {failed_count}")
    print(f"Success rate:     {(success_count/total*100):.1f}%")
    print("="*60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
