#!/usr/bin/env python3
"""
Google Maps Bulk Business Scraper for Kigali, Rwanda

This script extracts ALL businesses from Google Maps across multiple categories
in Kigali, Rwanda and syncs them to the Supabase 'businesses' table.

Target: ~10,000 businesses across 48 categories
"""

import argparse
import asyncio
import json
import os
import random
import re
import signal
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv
from playwright.async_api import async_playwright, Page, Browser
from supabase import create_client, Client
from tenacity import retry, stop_after_attempt, wait_exponential
from tqdm import tqdm

# Load environment variables
load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SCRIPT_DIR = Path(__file__).parent
CATEGORIES_FILE = SCRIPT_DIR / "kigali_categories.json"
CHECKPOINT_FILE = SCRIPT_DIR / "scraper_checkpoint.json"
DEFAULT_OUTPUT_FILE = SCRIPT_DIR / "businesses_kigali.json"

# Rate limiting
MIN_DELAY = 2.0  # Minimum delay between requests (seconds)
MAX_DELAY = 4.0  # Maximum delay between requests (seconds)
SCROLL_DELAY = 1.5  # Delay between scrolls (seconds)

# Batch size for database operations
BATCH_SIZE = 100

# User agents for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
]

# Global state for graceful shutdown
shutdown_requested = False
scraper_state = {
    "categories_processed": [],
    "businesses_found": [],
    "stats": {
        "total_found": 0,
        "new_added": 0,
        "existing_updated": 0,
        "duplicates_skipped": 0,
        "by_category": {}
    }
}


class GracefulShutdown(Exception):
    """Exception raised when shutdown is requested."""
    pass


def signal_handler(signum, frame):
    """Handle SIGINT (Ctrl+C) for graceful shutdown."""
    global shutdown_requested
    print("\n\n⚠️  Shutdown requested... Saving progress...")
    shutdown_requested = True


def load_categories() -> Dict:
    """Load category configuration from JSON file."""
    if not CATEGORIES_FILE.exists():
        print(f"❌ Category file not found: {CATEGORIES_FILE}")
        sys.exit(1)
    
    with open(CATEGORIES_FILE, 'r') as f:
        return json.load(f)


def load_checkpoint() -> Dict:
    """Load checkpoint data if exists."""
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE, 'r') as f:
            return json.load(f)
    return {}


def save_checkpoint(data: Dict):
    """Save checkpoint data."""
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"💾 Checkpoint saved: {len(data.get('categories_processed', []))} categories processed")


def save_businesses_to_file(businesses: List[Dict], output_file: Path):
    """Save businesses to JSON file."""
    with open(output_file, 'w') as f:
        json.dump(businesses, f, indent=2)
    print(f"💾 Saved {len(businesses)} businesses to {output_file}")


def random_delay():
    """Add random delay to appear more human-like."""
    delay = random.uniform(MIN_DELAY, MAX_DELAY)
    time.sleep(delay)


def extract_place_id(url: str) -> Optional[str]:
    """Extract Google Maps place ID from URL."""
    # Pattern: /maps/place/.../@lat,lng,zoom/data=!4m...!3m...!1s<PLACE_ID>
    match = re.search(r'!1s([^!]+)', url)
    if match:
        return match.group(1)
    
    # Alternative pattern for CID
    match = re.search(r'cid=(\d+)', url)
    if match:
        return f"cid_{match.group(1)}"
    
    return None


async def scroll_results(page: Page, max_scrolls: int = 20) -> int:
    """
    Scroll through Google Maps results to load more businesses.
    Returns number of scrolls performed.
    """
    scrolls = 0
    prev_height = 0
    
    # Find the scrollable results panel
    results_panel = page.locator('[role="feed"]').first
    
    for i in range(max_scrolls):
        if shutdown_requested:
            raise GracefulShutdown()
        
        try:
            # Get current scroll height
            current_height = await results_panel.evaluate("el => el.scrollHeight")
            
            # If height hasn't changed, we've reached the end
            if current_height == prev_height and i > 2:
                break
            
            # Scroll to bottom
            await results_panel.evaluate("el => el.scrollTo(0, el.scrollHeight)")
            await asyncio.sleep(SCROLL_DELAY)
            
            prev_height = current_height
            scrolls += 1
            
        except Exception as e:
            print(f"  ⚠️  Scroll error: {e}")
            break
    
    return scrolls


async def extract_business_data(page: Page, element) -> Optional[Dict]:
    """Extract business data from a Google Maps result element."""
    try:
        business = {}
        
        # Business name
        name_elem = element.locator('[class*="fontHeadlineSmall"]').first
        business['name'] = await name_elem.inner_text() if await name_elem.count() > 0 else None
        
        if not business['name']:
            return None
        
        # Click to open details
        await element.click()
        await asyncio.sleep(1.5)
        
        # Extract URL and place ID
        current_url = page.url
        business['google_maps_url'] = current_url
        business['place_id'] = extract_place_id(current_url)
        
        # Rating
        rating_elem = page.locator('[role="img"][aria-label*="stars"]').first
        if await rating_elem.count() > 0:
            aria_label = await rating_elem.get_attribute('aria-label')
            match = re.search(r'([\d.]+) stars', aria_label)
            business['rating'] = float(match.group(1)) if match else None
        else:
            business['rating'] = None
        
        # Review count
        review_elem = page.locator('[aria-label*="reviews"]').first
        if await review_elem.count() > 0:
            aria_label = await review_elem.get_attribute('aria-label')
            match = re.search(r'([\d,]+) reviews', aria_label)
            business['review_count'] = int(match.group(1).replace(',', '')) if match else 0
        else:
            business['review_count'] = 0
        
        # Address
        address_elem = page.locator('button[data-item-id="address"]').first
        if await address_elem.count() > 0:
            business['address'] = await address_elem.inner_text()
        else:
            business['address'] = None
        
        # Phone
        phone_elem = page.locator('button[data-item-id*="phone"]').first
        if await phone_elem.count() > 0:
            phone_text = await phone_elem.inner_text()
            # Extract phone number - prioritize Rwanda format (+250), then other international formats
            # Rwanda: +250 followed by 9 digits
            phone_match = re.search(r'\+250\s?\d{3}\s?\d{3}\s?\d{3}', phone_text)
            if not phone_match:
                # Fallback: any international format with + prefix
                phone_match = re.search(r'\+\d{1,3}\s?[\d\s\-()]{7,15}', phone_text)
            business['phone'] = phone_match.group(0).strip() if phone_match else None
        else:
            business['phone'] = None
        
        # Website
        website_elem = page.locator('a[data-item-id="authority"]').first
        if await website_elem.count() > 0:
            business['website'] = await website_elem.get_attribute('href')
        else:
            business['website'] = None
        
        # Extract coordinates from URL
        coord_match = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', current_url)
        if coord_match:
            business['lat'] = float(coord_match.group(1))
            business['lng'] = float(coord_match.group(2))
        else:
            business['lat'] = None
            business['lng'] = None
        
        # Category/type (from Google Maps)
        category_elem = page.locator('button[jsaction*="category"]').first
        if await category_elem.count() > 0:
            business['google_category'] = await category_elem.inner_text()
        else:
            business['google_category'] = None
        
        # Opening hours (if available)
        hours_elem = page.locator('[aria-label*="Hide open hours"]').first
        if await hours_elem.count() > 0:
            # This is complex, we'll skip for now or implement later
            business['operating_hours'] = None
        else:
            business['operating_hours'] = None
        
        business['scraped_at'] = datetime.now().isoformat()
        
        return business
        
    except Exception as e:
        print(f"    ⚠️  Error extracting business data: {e}")
        return None


async def scrape_category(
    browser: Browser,
    category: str,
    location: str,
    limit: Optional[int] = None
) -> List[Dict]:
    """Scrape all businesses for a given category."""
    
    print(f"\n🔍 Scraping category: {category}")
    
    # Create new page with random user agent
    context = await browser.new_context(
        user_agent=random.choice(USER_AGENTS),
        viewport={'width': 1920, 'height': 1080}
    )
    page = await context.new_page()
    
    businesses = []
    
    try:
        # Search URL
        search_query = f"{category} in {location}"
        search_url = f"https://www.google.com/maps/search/{search_query.replace(' ', '+')}"
        
        print(f"  📍 URL: {search_url}")
        
        # Navigate to search
        await page.goto(search_url, wait_until='networkidle')
        await asyncio.sleep(3)
        
        # Scroll to load more results
        print(f"  📜 Scrolling to load results...")
        scrolls = await scroll_results(page)
        print(f"  ✅ Performed {scrolls} scrolls")
        
        # Get all business result elements
        results = page.locator('[role="feed"] > div > div > a').all()
        result_count = await page.locator('[role="feed"] > div > div > a').count()
        
        print(f"  📊 Found {result_count} results")
        
        # Extract data from each result
        for i in range(result_count):
            if shutdown_requested:
                raise GracefulShutdown()
            
            if limit and len(businesses) >= limit:
                break
            
            try:
                # Get fresh locator for current element
                element = page.locator('[role="feed"] > div > div > a').nth(i)
                
                # Extract business data
                business_data = await extract_business_data(page, element)
                
                if business_data:
                    business_data['category'] = category
                    business_data['search_query'] = search_query
                    businesses.append(business_data)
                    print(f"    ✅ [{len(businesses)}] {business_data['name']}")
                
                # Random delay between extractions
                await asyncio.sleep(random.uniform(0.5, 1.5))
                
                # Go back to results list
                await page.go_back()
                await asyncio.sleep(1)
                
            except Exception as e:
                print(f"    ⚠️  Error processing result {i}: {e}")
                continue
        
    except GracefulShutdown:
        print(f"  ⚠️  Category scraping interrupted")
        raise
    
    except Exception as e:
        print(f"  ❌ Error scraping category: {e}")
    
    finally:
        await page.close()
        await context.close()
    
    print(f"  ✅ Scraped {len(businesses)} businesses from {category}")
    random_delay()
    
    return businesses


def is_duplicate(business: Dict, existing: List[Dict]) -> bool:
    """
    Check if business is a duplicate based on:
    1. Google Maps place ID
    2. Exact name match + location within 100m
    3. Phone number match
    """
    place_id = business.get('place_id')
    name = business.get('name', '').lower()
    phone = business.get('phone')
    lat = business.get('lat')
    lng = business.get('lng')
    
    for existing_business in existing:
        # Check place ID
        if place_id and existing_business.get('place_id') == place_id:
            return True
        
        # Check name + location using Haversine formula
        if name and existing_business.get('name', '').lower() == name:
            if lat and lng and existing_business.get('lat') and existing_business.get('lng'):
                # Haversine formula for distance calculation
                import math
                R = 6371  # Earth's radius in km
                
                lat1, lng1 = math.radians(lat), math.radians(lng)
                lat2, lng2 = math.radians(existing_business['lat']), math.radians(existing_business['lng'])
                
                dlat = lat2 - lat1
                dlng = lng2 - lng1
                
                a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
                c = 2 * math.asin(math.sqrt(a))
                distance_km = R * c
                
                if distance_km < 0.1:  # Within 100m
                    return True
        
        # Check phone number
        if phone and existing_business.get('phone') == phone:
            return True
    
    return False


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def supabase_batch_upsert(supabase: Client, businesses: List[Dict]):
    """
    Batch upsert businesses to Supabase.
    Uses retry logic for transient failures.
    """
    # Transform data to match database schema
    db_records = []
    
    for business in businesses:
        record = {
            'name': business.get('name'),
            'category': business.get('category', 'General'),
            'address': business.get('address'),
            'phone': business.get('phone'),
            'website': business.get('website'),
            'lat': business.get('lat'),
            'lng': business.get('lng'),
            'rating': business.get('rating'),
            'review_count': business.get('review_count', 0),
            'external_id': business.get('place_id'),
            'status': 'active',
            'city': 'Kigali',
            'country': 'RW',
        }
        
        # Only include non-null values
        record = {k: v for k, v in record.items() if v is not None}
        db_records.append(record)
    
    # Upsert to database
    result = supabase.table('businesses').upsert(
        db_records,
        on_conflict='external_id'
    ).execute()
    
    return result


def generate_summary_report(stats: Dict, output_file: Path):
    """Generate and print summary report."""
    
    report = f"""
{'='*60}
Kigali Business Scraping Report
{'='*60}
Total businesses found: {stats['total_found']:,}
New businesses added: {stats['new_added']:,}
Existing updated: {stats['existing_updated']:,}
Duplicates skipped: {stats['duplicates_skipped']:,}

By Category:
"""
    
    for category, count in sorted(stats['by_category'].items(), key=lambda x: x[1], reverse=True):
        report += f"  - {category}: {count:,}\n"
    
    report += f"{'='*60}\n"
    report += f"Output file: {output_file}\n"
    report += f"Timestamp: {datetime.now().isoformat()}\n"
    report += f"{'='*60}\n"
    
    print(report)
    
    # Save report to file
    report_file = output_file.parent / f"scraping_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    with open(report_file, 'w') as f:
        f.write(report)
    print(f"📄 Report saved to: {report_file}")


async def main():
    """Main function."""
    global shutdown_requested, scraper_state
    
    # Parse arguments
    parser = argparse.ArgumentParser(
        description='Bulk scrape businesses from Google Maps in Kigali, Rwanda'
    )
    parser.add_argument(
        '--categories',
        type=str,
        help='Comma-separated list of categories to scrape (default: all)'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Maximum total businesses to scrape (default: unlimited)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview without inserting to database'
    )
    parser.add_argument(
        '--resume',
        action='store_true',
        help='Resume from checkpoint'
    )
    parser.add_argument(
        '--output',
        type=str,
        default=str(DEFAULT_OUTPUT_FILE),
        help=f'Output JSON file (default: {DEFAULT_OUTPUT_FILE})'
    )
    parser.add_argument(
        '--per-category-limit',
        type=int,
        default=None,
        help='Maximum businesses per category (default: unlimited)'
    )
    
    args = parser.parse_args()
    
    # Setup signal handler
    signal.signal(signal.SIGINT, signal_handler)
    
    print("🗺️  Google Maps Bulk Business Scraper")
    print("=" * 60)
    print(f"Location: Kigali, Rwanda")
    print(f"Dry run: {args.dry_run}")
    print(f"Resume: {args.resume}")
    print(f"Output: {args.output}")
    print("=" * 60)
    
    # Validate environment
    if not args.dry_run:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            print("❌ Missing environment variables:")
            print("   - SUPABASE_URL")
            print("   - SUPABASE_SERVICE_ROLE_KEY")
            sys.exit(1)
        
        # Initialize Supabase client
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print("✅ Connected to Supabase")
    else:
        supabase = None
        print("⚠️  Dry run mode - database writes disabled")
    
    # Load categories
    config = load_categories()
    all_categories = config['categories']
    location = config['location']
    
    # Filter categories if specified
    if args.categories:
        selected_categories = [c.strip() for c in args.categories.split(',')]
        categories_to_scrape = [c for c in all_categories if c in selected_categories]
        if not categories_to_scrape:
            print(f"❌ No matching categories found: {args.categories}")
            sys.exit(1)
    else:
        categories_to_scrape = all_categories
    
    print(f"\n📋 Categories to scrape: {len(categories_to_scrape)}")
    
    # Load checkpoint if resuming
    checkpoint = {}
    if args.resume:
        checkpoint = load_checkpoint()
        if checkpoint:
            scraper_state['categories_processed'] = checkpoint.get('categories_processed', [])
            scraper_state['businesses_found'] = checkpoint.get('businesses_found', [])
            scraper_state['stats'] = checkpoint.get('stats', scraper_state['stats'])
            print(f"✅ Loaded checkpoint: {len(scraper_state['categories_processed'])} categories already processed")
            
            # Filter out already processed categories
            categories_to_scrape = [c for c in categories_to_scrape if c not in scraper_state['categories_processed']]
            print(f"📋 Remaining categories: {len(categories_to_scrape)}")
    
    if not categories_to_scrape:
        print("✅ All categories already processed!")
        return
    
    # Start scraping
    print("\n🚀 Starting scraping...")
    
    try:
        async with async_playwright() as p:
            # Launch browser
            browser = await p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox']
            )
            
            print("✅ Browser launched\n")
            
            # Progress bar
            with tqdm(total=len(categories_to_scrape), desc="Categories", unit="cat") as pbar:
                
                for category in categories_to_scrape:
                    if shutdown_requested:
                        break
                    
                    # Check global limit
                    if args.limit and scraper_state['stats']['total_found'] >= args.limit:
                        print(f"\n✅ Reached global limit of {args.limit} businesses")
                        break
                    
                    try:
                        # Scrape category
                        businesses = await scrape_category(
                            browser,
                            category,
                            location,
                            limit=args.per_category_limit
                        )
                        
                        # Filter duplicates
                        new_businesses = []
                        for business in businesses:
                            if not is_duplicate(business, scraper_state['businesses_found']):
                                new_businesses.append(business)
                            else:
                                scraper_state['stats']['duplicates_skipped'] += 1
                        
                        # Add to global list
                        scraper_state['businesses_found'].extend(new_businesses)
                        scraper_state['categories_processed'].append(category)
                        
                        # Update stats
                        scraper_state['stats']['total_found'] += len(businesses)
                        scraper_state['stats']['by_category'][category] = len(businesses)
                        
                        # Upsert to database (in batches)
                        if not args.dry_run and new_businesses and supabase:
                            try:
                                for i in range(0, len(new_businesses), BATCH_SIZE):
                                    batch = new_businesses[i:i + BATCH_SIZE]
                                    supabase_batch_upsert(supabase, batch)
                                    scraper_state['stats']['new_added'] += len(batch)
                                
                                print(f"  💾 Upserted {len(new_businesses)} businesses to database")
                            
                            except Exception as e:
                                print(f"  ❌ Database error: {e}")
                        
                        # Save checkpoint after each category
                        save_checkpoint({
                            'categories_processed': scraper_state['categories_processed'],
                            'businesses_found': scraper_state['businesses_found'],
                            'stats': scraper_state['stats'],
                            'last_updated': datetime.now().isoformat()
                        })
                        
                        pbar.update(1)
                        
                    except GracefulShutdown:
                        print(f"\n⚠️  Shutting down gracefully...")
                        break
                    
                    except Exception as e:
                        print(f"\n❌ Error processing category '{category}': {e}")
                        # Continue with next category
                        pbar.update(1)
                        continue
            
            await browser.close()
    
    except GracefulShutdown:
        print("\n⚠️  Scraping interrupted by user")
    
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Save final output
        output_file = Path(args.output)
        save_businesses_to_file(scraper_state['businesses_found'], output_file)
        
        # Generate report
        generate_summary_report(scraper_state['stats'], output_file)
        
        # Clean up checkpoint if completed successfully
        if not shutdown_requested and len(categories_to_scrape) == len(scraper_state['categories_processed']):
            if CHECKPOINT_FILE.exists():
                CHECKPOINT_FILE.unlink()
                print("🗑️  Removed checkpoint file (scraping completed)")


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
