#!/usr/bin/env python3
"""
Google Maps Bulk Business Scraper
Scrapes multiple business categories across cities in Rwanda/East Africa
"""

import os
import sys
import json
import argparse
import time
from datetime import datetime
from typing import List, Dict
from pathlib import Path

# Import the updated scraper
try:
    from gmaps_scraper_v2 import GoogleMapsScraper
except ImportError:
    from gmaps_scraper import GoogleMapsPharmacyScraper as GoogleMapsScraper

# Default categories to scrape (48 common business types)
DEFAULT_CATEGORIES = [
    "pharmacy", "restaurant", "hotel", "hospital", "clinic", "supermarket",
    "gas station", "bank", "atm", "cafe", "bar", "bakery", "butchery",
    "salon", "barbershop", "spa", "gym", "school", "university", "church",
    "mosque", "temple", "police station", "fire station", "post office",
    "library", "museum", "theater", "cinema", "parking", "car wash",
    "auto repair", "mechanic", "electronics store", "phone shop", "bookstore",
    "clothing store", "shoe store", "jewelry store", "furniture store",
    "hardware store", "paint store", "laundry", "dry cleaner", "pharmacy",
    "dentist", "veterinary clinic", "pet store"
]

# Rwanda cities with coordinates
RWANDA_CITIES = {
    "Kigali": {"lat": -1.9536, "lng": 30.0606, "zoom": 12},
    "Butare": {"lat": -2.5967, "lng": 29.7414, "zoom": 13},
    "Gisenyi": {"lat": -1.7025, "lng": 29.2561, "zoom": 13},
    "Rwamagana": {"lat": -1.9489, "lng": 30.4348, "zoom": 13},
    "Muhanga": {"lat": -2.0841, "lng": 29.7419, "zoom": 13},
}


class BulkScraper:
    """Bulk scraper for multiple categories and locations"""
    
    def __init__(self, supabase_url: str, supabase_key: str, headless: bool = True):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.headless = headless
        self.results_dir = Path("scraper_results")
        self.results_dir.mkdir(exist_ok=True)
        
    def build_maps_url(self, category: str, city: str, coords: Dict) -> str:
        """Build Google Maps search URL"""
        category_encoded = category.replace(" ", "+")
        lat = coords["lat"]
        lng = coords["lng"]
        zoom = coords.get("zoom", 13)
        return f"https://www.google.com/maps/search/{category_encoded}+in+{city}/@{lat},{lng},{zoom}z"
    
    def scrape_category(
        self, 
        category: str, 
        city: str = "Kigali",
        country: str = "Rwanda",
        max_results: int = 50,
        dry_run: bool = False
    ) -> Dict:
        """Scrape a single category in a city"""
        
        print(f"\n{'='*60}")
        print(f"📍 Scraping: {category.upper()} in {city}, {country}")
        print(f"{'='*60}")
        
        # Get coordinates
        coords = RWANDA_CITIES.get(city, RWANDA_CITIES["Kigali"])
        url = self.build_maps_url(category, city, coords)
        
        print(f"URL: {url}")
        print(f"Max results: {max_results}")
        print(f"Mode: {'DRY RUN (no DB insert)' if dry_run else 'LIVE (will insert to DB)'}")
        
        # Create fresh scraper instance
        scraper = GoogleMapsScraper(
            self.supabase_url, 
            self.supabase_key, 
            self.headless
        )
        
        try:
            # Scrape
            businesses = scraper.scrape_category(
                gmaps_url=url,
                category=category,
                city=city,
                country=country,
                max_results=max_results
            )
            
            # Save to file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{category.replace(' ', '_')}_{city}_{timestamp}.json"
            filepath = self.results_dir / filename
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(businesses, f, indent=2, ensure_ascii=False)
            
            print(f"✓ Saved {len(businesses)} businesses to {filepath}")
            
            # Update Supabase (unless dry run)
            stats = {"inserted": 0, "duplicates": 0, "errors": 0}
            
            if not dry_run and businesses:
                print(f"\n📤 Updating Supabase...")
                try:
                    stats = scraper.update_supabase(businesses, category=category)
                    print(f"  ✓ Inserted: {stats['inserted']}")
                    print(f"  ⊘ Duplicates: {stats['duplicates']}")
                    print(f"  ✗ Errors: {stats['errors']}")
                except Exception as e:
                    print(f"  ✗ Database update failed: {e}")
                    stats["errors"] = len(businesses)
            
            return {
                "category": category,
                "city": city,
                "count": len(businesses),
                "file": str(filepath),
                "stats": stats,
                "success": True
            }
            
        except Exception as e:
            print(f"✗ Error scraping {category}: {e}")
            return {
                "category": category,
                "city": city,
                "count": 0,
                "error": str(e),
                "success": False
            }
        finally:
            # Cleanup already handled by scraper
            pass
    
    def bulk_scrape(
        self,
        categories: List[str] = None,
        cities: List[str] = None,
        per_category_limit: int = 50,
        dry_run: bool = False,
        delay_between_categories: int = 5
    ) -> Dict:
        """
        Scrape multiple categories across multiple cities
        
        Args:
            categories: List of business categories (default: DEFAULT_CATEGORIES)
            cities: List of cities (default: ["Kigali"])
            per_category_limit: Max results per category
            dry_run: If True, don't insert to database
            delay_between_categories: Seconds to wait between categories
            
        Returns:
            Summary dictionary with results
        """
        categories = categories or DEFAULT_CATEGORIES
        cities = cities or ["Kigali"]
        
        print(f"\n{'='*70}")
        print(f"🚀 BULK SCRAPE STARTING")
        print(f"{'='*70}")
        print(f"Categories: {len(categories)}")
        print(f"Cities: {', '.join(cities)}")
        print(f"Per-category limit: {per_category_limit}")
        print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
        print(f"Estimated total: ~{len(categories) * len(cities) * per_category_limit} businesses")
        print(f"{'='*70}\n")
        
        results = []
        total_scraped = 0
        total_inserted = 0
        total_errors = 0
        
        start_time = time.time()
        
        for city in cities:
            for idx, category in enumerate(categories, 1):
                print(f"\n[{idx}/{len(categories)}] Processing: {category} in {city}")
                
                result = self.scrape_category(
                    category=category,
                    city=city,
                    country="Rwanda",
                    max_results=per_category_limit,
                    dry_run=dry_run
                )
                
                results.append(result)
                
                if result["success"]:
                    total_scraped += result["count"]
                    if not dry_run:
                        total_inserted += result["stats"]["inserted"]
                else:
                    total_errors += 1
                
                # Delay to avoid rate limiting
                if idx < len(categories):
                    print(f"⏳ Waiting {delay_between_categories}s before next category...")
                    time.sleep(delay_between_categories)
        
        elapsed = time.time() - start_time
        
        # Summary
        summary = {
            "start_time": datetime.fromtimestamp(start_time).isoformat(),
            "elapsed_seconds": round(elapsed, 2),
            "categories_processed": len(categories),
            "cities_processed": len(cities),
            "total_businesses_scraped": total_scraped,
            "total_inserted_to_db": total_inserted if not dry_run else 0,
            "total_errors": total_errors,
            "dry_run": dry_run,
            "results": results
        }
        
        # Save summary
        summary_file = self.results_dir / f"bulk_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"\n{'='*70}")
        print(f"✅ BULK SCRAPE COMPLETE")
        print(f"{'='*70}")
        print(f"⏱️  Time: {elapsed/60:.1f} minutes")
        print(f"📊 Total scraped: {total_scraped} businesses")
        if not dry_run:
            print(f"💾 Inserted to DB: {total_inserted}")
        print(f"❌ Errors: {total_errors}")
        print(f"📁 Summary saved: {summary_file}")
        print(f"{'='*70}\n")
        
        return summary


def main():
    parser = argparse.ArgumentParser(
        description="Bulk scrape Google Maps businesses across multiple categories"
    )
    parser.add_argument(
        "--categories",
        nargs="+",
        help=f"Categories to scrape (default: {len(DEFAULT_CATEGORIES)} categories)"
    )
    parser.add_argument(
        "--cities",
        nargs="+",
        default=["Kigali"],
        help="Cities to scrape (default: Kigali)"
    )
    parser.add_argument(
        "--per-category-limit",
        type=int,
        default=50,
        help="Max results per category (default: 50)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview without inserting to database"
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        default=True,
        help="Run browser in headless mode (default: True)"
    )
    parser.add_argument(
        "--delay",
        type=int,
        default=5,
        help="Seconds between categories (default: 5)"
    )
    
    args = parser.parse_args()
    
    # Get credentials
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Error: Environment variables not set")
        print("Please set:")
        print("  export SUPABASE_URL='https://your-project.supabase.co'")
        print("  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'")
        sys.exit(1)
    
    # Determine categories
    categories = args.categories or DEFAULT_CATEGORIES
    
    print(f"\n📋 Configuration:")
    print(f"  Categories: {len(categories)}")
    print(f"  Cities: {', '.join(args.cities)}")
    print(f"  Per-category limit: {args.per_category_limit}")
    print(f"  Dry run: {args.dry_run}")
    
    # Confirm if not dry run
    if not args.dry_run:
        print(f"\n⚠️  WARNING: This will insert data to your Supabase database!")
        print(f"   Estimated: ~{len(categories) * len(args.cities) * args.per_category_limit} businesses")
        response = input("\nContinue? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            print("Cancelled.")
            sys.exit(0)
    
    # Run scraper
    scraper = BulkScraper(supabase_url, supabase_key, args.headless)
    summary = scraper.bulk_scrape(
        categories=categories,
        cities=args.cities,
        per_category_limit=args.per_category_limit,
        dry_run=args.dry_run,
        delay_between_categories=args.delay
    )
    
    print("\n✅ Done! Results saved to scraper_results/ directory")


if __name__ == "__main__":
    main()
