#!/usr/bin/env python3
"""
Google Places API Business Scraper
Uses official Google Places API - Much faster and more reliable than web scraping!
"""

import os
import sys
import json
import time
import hashlib
import requests
from typing import Dict, List, Optional
from datetime import datetime
from pathlib import Path

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: Supabase client not installed. Run: pip install supabase")
    sys.exit(1)


class GooglePlacesAPIScraper:
    """Scraper using official Google Places API"""
    
    def __init__(self, api_key: str, supabase_url: str, supabase_key: str):
        self.api_key = api_key
        self.supabase = create_client(supabase_url, supabase_key)
        self.base_url = "https://maps.googleapis.com/maps/api/place"
        self.results_dir = Path("scraper_results")
        self.results_dir.mkdir(exist_ok=True)
        
    def search_nearby(
        self,
        location: Dict[str, float],
        category: str,
        radius: int = 5000,
        max_results: int = 60
    ) -> List[Dict]:
        """
        Search for businesses using Google Places Nearby Search
        
        Args:
            location: {"lat": -1.9536, "lng": 30.0606}
            category: Business type (e.g., "pharmacy", "restaurant")
            radius: Search radius in meters (default 5km)
            max_results: Max results to return (API limit is 60)
            
        Returns:
            List of business dictionaries
        """
        businesses = []
        next_page_token = None
        
        print(f"\n🔍 Searching for '{category}' near {location['lat']}, {location['lng']}")
        print(f"   Radius: {radius}m, Max results: {max_results}")
        
        while len(businesses) < max_results:
            # Build request
            url = f"{self.base_url}/nearbysearch/json"
            params = {
                "location": f"{location['lat']},{location['lng']}",
                "radius": radius,
                "type": category,
                "key": self.api_key
            }
            
            if next_page_token:
                params = {"pagetoken": next_page_token, "key": self.api_key}
                time.sleep(2)  # Required delay for page tokens
            
            # Make request
            response = requests.get(url, params=params)
            data = response.json()
            
            if data["status"] == "ZERO_RESULTS":
                print(f"   No results found")
                break
            
            if data["status"] != "OK":
                print(f"   ⚠️  API Error: {data.get('status')} - {data.get('error_message', 'Unknown error')}")
                break
            
            # Extract results
            for place in data.get("results", []):
                if len(businesses) >= max_results:
                    break
                
                business = self._extract_place_data(place)
                if business:
                    businesses.append(business)
            
            print(f"   Found {len(businesses)} businesses so far...")
            
            # Check for next page
            next_page_token = data.get("next_page_token")
            if not next_page_token:
                break
        
        print(f"   ✓ Total found: {len(businesses)}")
        return businesses
    
    def get_place_details(self, place_id: str) -> Optional[Dict]:
        """Get detailed information about a place"""
        url = f"{self.base_url}/details/json"
        params = {
            "place_id": place_id,
            "fields": "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,geometry,opening_hours,price_level,types",
            "key": self.api_key
        }
        
        response = requests.get(url, params=params)
        data = response.json()
        
        if data["status"] == "OK":
            return data.get("result")
        return None
    
    def _extract_place_data(self, place: Dict) -> Optional[Dict]:
        """Extract business data from Places API result"""
        try:
            geometry = place.get("geometry", {})
            location = geometry.get("location", {})
            
            business = {
                "name": place.get("name"),
                "address": place.get("vicinity") or place.get("formatted_address", ""),
                "lat": location.get("lat"),
                "lng": location.get("lng"),
                "rating": place.get("rating", 0.0),
                "review_count": place.get("user_ratings_total", 0),
                "place_id": place.get("place_id"),
                "external_id": place.get("place_id"),
                "types": place.get("types", []),
                "business_status": place.get("business_status", "OPERATIONAL"),
                "price_level": place.get("price_level"),
                "source": "Google Places API"
            }
            
            # Get additional details if available
            if place.get("opening_hours"):
                business["is_open"] = place["opening_hours"].get("open_now")
            
            return business
            
        except Exception as e:
            print(f"   Error extracting place data: {e}")
            return None
    
    def search_text(self, query: str, location: Dict[str, float], max_results: int = 60) -> List[Dict]:
        """
        Search using text query (e.g., "pharmacies in Kigali")
        More flexible than nearby search
        """
        businesses = []
        next_page_token = None
        
        print(f"\n🔍 Text search: '{query}'")
        
        while len(businesses) < max_results:
            url = f"{self.base_url}/textsearch/json"
            params = {
                "query": query,
                "location": f"{location['lat']},{location['lng']}",
                "radius": 10000,
                "key": self.api_key
            }
            
            if next_page_token:
                params = {"pagetoken": next_page_token, "key": self.api_key}
                time.sleep(2)
            
            response = requests.get(url, params=params)
            data = response.json()
            
            if data["status"] not in ["OK", "ZERO_RESULTS"]:
                print(f"   ⚠️  API Error: {data.get('status')}")
                break
            
            for place in data.get("results", []):
                if len(businesses) >= max_results:
                    break
                business = self._extract_place_data(place)
                if business:
                    businesses.append(business)
            
            print(f"   Found {len(businesses)} businesses...")
            
            next_page_token = data.get("next_page_token")
            if not next_page_token:
                break
        
        return businesses
    
    def _generate_business_key(self, name: str, address: str) -> str:
        """Generate unique key for duplicate detection"""
        normalized = f"{name}|{address}".lower()
        normalized = normalized.replace(" ", "").replace(",", "").replace(".", "")
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def update_supabase(
        self,
        businesses: List[Dict],
        category: str,
        city: str = "Kigali",
        country: str = "Rwanda"
    ) -> Dict:
        """Insert businesses to Supabase with duplicate detection"""
        stats = {"inserted": 0, "duplicates": 0, "errors": 0}
        
        print(f"\n📤 Updating Supabase...")
        
        # Load existing businesses
        try:
            response = self.supabase.table("businesses")\
                .select("id, name, address, place_id, external_id")\
                .eq("city", city)\
                .execute()
            
            existing_keys = set()
            existing_place_ids = set()
            
            for biz in response.data:
                # Check by place_id
                place_id = biz.get("place_id") or biz.get("external_id")
                if place_id:
                    existing_place_ids.add(place_id)
                
                # Check by name+address
                key = self._generate_business_key(
                    biz.get("name", ""),
                    biz.get("address", "")
                )
                existing_keys.add(key)
            
            print(f"   Loaded {len(response.data)} existing businesses")
            
        except Exception as e:
            print(f"   Warning: Could not load existing: {e}")
            existing_keys = set()
            existing_place_ids = set()
        
        # Insert new businesses
        for business in businesses:
            # Check place_id first (most reliable)
            place_id = business.get("place_id") or business.get("external_id")
            if place_id and place_id in existing_place_ids:
                print(f"   ⊘ DUPLICATE (place_id): {business['name']}")
                stats['duplicates'] += 1
                continue
            
            # Check name+address
            key = self._generate_business_key(
                business.get("name", ""),
                business.get("address", "")
            )
            if key in existing_keys:
                print(f"   ⊘ DUPLICATE (name): {business['name']}")
                stats['duplicates'] += 1
                continue
            
            try:
                # Prepare data
                data = {
                    "name": business.get("name"),
                    "category": category,
                    "city": city,
                    "country": country,
                    "address": business.get("address"),
                    "lat": business.get("lat"),
                    "lng": business.get("lng"),
                    "phone": business.get("phone"),
                    "website": business.get("website"),
                    "rating": business.get("rating"),
                    "review_count": business.get("review_count"),
                    "status": "active",
                    "external_id": business.get("external_id") or business.get("place_id"),
                    "place_id": business.get("place_id"),
                }
                
                # Remove None values
                data = {k: v for k, v in data.items() if v is not None}
                
                # Insert
                self.supabase.table("businesses").insert(data).execute()
                print(f"   ✓ INSERTED: {business['name']}")
                stats['inserted'] += 1
                
                # Update caches
                existing_keys.add(key)
                if place_id:
                    existing_place_ids.add(place_id)
                
            except Exception as e:
                print(f"   ✗ ERROR: {business.get('name')} - {e}")
                stats['errors'] += 1
        
        print(f"\n{'='*60}")
        print(f"✓ Inserted: {stats['inserted']}")
        print(f"⊘ Duplicates: {stats['duplicates']}")
        print(f"✗ Errors: {stats['errors']}")
        print(f"{'='*60}")
        
        return stats


# Category mapping to Google Places types
CATEGORY_TYPES = {
    "pharmacy": "pharmacy",
    "restaurant": "restaurant",
    "hotel": "lodging",
    "hospital": "hospital",
    "clinic": "doctor",
    "supermarket": "supermarket",
    "gas_station": "gas_station",
    "bank": "bank",
    "atm": "atm",
    "cafe": "cafe",
    "bar": "bar",
    "bakery": "bakery",
    "salon": "beauty_salon",
    "barbershop": "hair_care",
    "spa": "spa",
    "gym": "gym",
    "school": "school",
    "university": "university",
    "church": "church",
    "mosque": "mosque",
    "police": "police",
    "post_office": "post_office",
    "library": "library",
    "museum": "museum",
    "movie_theater": "movie_theater",
    "parking": "parking",
    "car_wash": "car_wash",
    "car_repair": "car_repair",
    "electronics": "electronics_store",
    "book_store": "book_store",
    "clothing_store": "clothing_store",
    "shoe_store": "shoe_store",
    "jewelry_store": "jewelry_store",
    "furniture_store": "furniture_store",
    "hardware_store": "hardware_store",
    "laundry": "laundry",
    "dentist": "dentist",
    "veterinary": "veterinary_care",
    "pet_store": "pet_store",
}


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Scrape businesses using Google Places API")
    parser.add_argument("--category", default="pharmacy", help="Business category")
    parser.add_argument("--city", default="Kigali", help="City name")
    parser.add_argument("--lat", type=float, default=-1.9536, help="Latitude")
    parser.add_argument("--lng", type=float, default=30.0606, help="Longitude")
    parser.add_argument("--radius", type=int, default=5000, help="Search radius in meters")
    parser.add_argument("--max-results", type=int, default=60, help="Max results")
    parser.add_argument("--dry-run", action="store_true", help="Don't insert to DB")
    parser.add_argument("--output", help="Save to JSON file")
    
    args = parser.parse_args()
    
    # Get credentials
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not api_key:
        print("❌ Error: GOOGLE_MAPS_API_KEY not set")
        sys.exit(1)
    
    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
        sys.exit(1)
    
    # Create scraper
    scraper = GooglePlacesAPIScraper(api_key, supabase_url, supabase_key)
    
    # Search
    location = {"lat": args.lat, "lng": args.lng}
    
    # Use text search for better results
    query = f"{args.category} in {args.city}"
    businesses = scraper.search_text(query, location, args.max_results)
    
    print(f"\n✓ Found {len(businesses)} businesses")
    
    # Save to file
    if args.output or args.dry_run:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = args.output or f"scraper_results/{args.category}_{args.city}_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(businesses, f, indent=2, ensure_ascii=False)
        print(f"✓ Saved to {filename}")
    
    # Update Supabase
    if not args.dry_run and businesses:
        scraper.update_supabase(businesses, args.category, args.city)
    
    print(f"\n✅ Complete!")


if __name__ == "__main__":
    main()
