#!/usr/bin/env python3
"""
Extract latitude and longitude from Google Maps URLs in business table
Uses Google Geocoding API to convert location queries to coordinates
"""

import os
import sys
import requests
import psycopg2
from urllib.parse import urlparse, parse_qs, unquote
from typing import Optional, Tuple
import time

# Configuration
GOOGLE_MAPS_API_KEY = "AIzaSyCVbVWLFl5O2TdL7zDAjM08ws9D6IxPEFw"
DATABASE_URL = "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

def extract_query_from_maps_url(url: str) -> Optional[str]:
    """
    Extract the 'query' parameter from a Google Maps search URL.
    Example:
      https://www.google.com/maps/search/?api=1&query=Danube+Home+Kigali,...
    """
    if not url or not isinstance(url, str):
        return None
    
    try:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        
        if "query" in qs and qs["query"]:
            raw_query = qs["query"][0]
            return unquote(raw_query)
    except Exception as e:
        print(f"Error parsing URL {url}: {e}")
    
    return None


def geocode_address(address: str) -> Optional[Tuple[float, float]]:
    """
    Use Google Geocoding API to convert an address/place string into (lat, lng).
    """
    if not address:
        return None
    
    if not GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY == "YOUR_API_KEY_HERE":
        raise RuntimeError("Set GOOGLE_MAPS_API_KEY env var or update in the code.")
    
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
            print(f"  ⚠️  Geocoding failed for '{address}': {data.get('status')} {data.get('error_message', '')}")
            return None
        
        loc = data["results"][0]["geometry"]["location"]
        return float(loc["lat"]), float(loc["lng"])
    
    except requests.exceptions.RequestException as e:
        print(f"  ❌ Network error geocoding '{address}': {e}")
        return None
    except Exception as e:
        print(f"  ❌ Error geocoding '{address}': {e}")
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
            SELECT id, name, maps_url, location
            FROM public.business
            WHERE maps_url IS NOT NULL
            AND (latitude IS NULL OR longitude IS NULL)
            ORDER BY created_at DESC
        """)
        
        businesses = cursor.fetchall()
        total = len(businesses)
        
        if total == 0:
            print("✅ No businesses need coordinate extraction.")
            cursor.close()
            conn.close()
            return
        
        print(f"📍 Found {total} businesses to process\n")
        
        processed = 0
        success = 0
        failed = 0
        
        for business in businesses:
            business_id, name, maps_url, location = business
            processed += 1
            
            print(f"[{processed}/{total}] Processing: {name}")
            print(f"  URL: {maps_url}")
            
            # Try to extract query from URL
            query = extract_query_from_maps_url(maps_url)
            
            # Fallback to location field if no query found
            if not query and location:
                query = location
                print(f"  Using location field: {location}")
            
            if not query:
                print(f"  ⚠️  No query extracted, skipping")
                failed += 1
                continue
            
            print(f"  Query: {query}")
            
            # Geocode the address
            coords = geocode_address(query)
            
            if coords is None:
                failed += 1
                print(f"  ❌ Failed to get coordinates\n")
                continue
            
            lat, lng = coords
            
            # Update database
            try:
                cursor.execute("""
                    UPDATE public.business
                    SET latitude = %s, longitude = %s, updated_at = now()
                    WHERE id = %s
                """, (lat, lng, business_id))
                conn.commit()
                
                success += 1
                print(f"  ✅ Updated: lat={lat:.6f}, lng={lng:.6f}\n")
                
                # Rate limiting (Google API has limits)
                time.sleep(0.1)  # Small delay between requests
                
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
        print(f"❌ Failed: {failed}")
        print("=" * 60)
        
    except psycopg2.Error as e:
        print(f"❌ Database connection error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    # Example test
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        test_url = "https://www.google.com/maps/search/?api=1&query=Danube+Home+Kigali,+Kigali+Business+Centre,+KN+5+Rd9"
        print(f"Testing with URL: {test_url}\n")
        
        query = extract_query_from_maps_url(test_url)
        if not query:
            print("❌ No query parameter found in URL.")
            sys.exit(1)
        
        print(f"✅ Extracted query: {query}\n")
        
        coords = geocode_address(query)
        if coords is None:
            print("❌ Could not determine latitude/longitude.")
            sys.exit(1)
        
        lat, lng = coords
        print(f"✅ Coordinates:")
        print(f"   Latitude: {lat}")
        print(f"   Longitude: {lng}")
    else:
        # Process all businesses
        process_businesses()
