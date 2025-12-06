#!/usr/bin/env python3
"""
Google Maps Business Scraper with Supabase Integration

This script extracts business information from Google Maps search results and syncs
them to the Supabase `businesses` table with duplicate detection.

Features:
- Scrapes business data from Google Maps URLs using Playwright
- Extracts: name, address, phone, lat/lng, rating, website, hours
- Detects duplicates by name, location proximity (~100m), or phone number
- Supports dry-run mode for preview
- Configurable business category and result limits
- Structured logging and progress tracking
- PII masking for phone numbers in logs (security compliance)

Security & Compliance:
- Uses environment variables for credentials (no secrets in code)
- SQL injection prevention via parameterized queries
- Phone numbers are masked in logs for PII protection
- Service role key required for database access (server-side only)

Usage:
    # Install dependencies
    pip install -r scripts/requirements-scraper.txt
    playwright install chromium

    # Set environment variable
    export DATABASE_URL="postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"
    # You can find this in: Supabase Dashboard > Settings > Database > Connection string (URI)

    # Run scraper
    python scripts/google_maps_scraper.py "https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z"

    # Dry run (preview without inserting)
    python scripts/google_maps_scraper.py --dry-run "https://maps.google.com/search/pharmacies/@-1.9,30.1,15z"

    # Custom category and limit
    python scripts/google_maps_scraper.py --category restaurant --limit 20 "https://maps.google.com/..."

Environment Variables:
    DATABASE_URL: PostgreSQL connection string (required)
                  Example: postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
                  Find in: Supabase Dashboard > Settings > Database > Connection string (URI)

Duplicate Detection:
    Businesses are considered duplicates if ANY of these match:
    1. Same name (case-insensitive)
    2. Within ~100 meters (using lat/lng)
    3. Same phone number

    When duplicates are found, the existing record is updated instead of creating a new one.
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime
from math import radians, cos, sin, asin, sqrt
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs

# Try to import required packages
try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
    import psycopg2
    from dotenv import load_dotenv
except ImportError as e:
    print(f"❌ Missing required package: {e}")
    print("Please install dependencies:")
    print("  pip install -r scripts/requirements-scraper.txt")
    print("  playwright install chromium")
    sys.exit(1)

# Load environment variables
load_dotenv()

# Configure logging with structured output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def mask_phone(phone: Optional[str]) -> str:
    """Mask phone number for logging (PII protection).
    
    Args:
        phone: Phone number to mask
        
    Returns:
        Masked phone number (e.g., +250****5678)
    """
    if not phone:
        return 'N/A'
    
    # Remove non-digit characters for processing
    digits = ''.join(filter(str.isdigit, phone))
    
    # If phone has country code format (+XXX...), keep it
    if phone.startswith('+') and len(digits) >= 8:
        # Keep country code and last 4 digits
        country_code = phone[:4]  # e.g., +250
        last_digits = digits[-4:]
        return f"{country_code}****{last_digits}"
    elif len(digits) >= 8:
        # Keep last 4 digits only
        return f"****{digits[-4:]}"
    else:
        return "****"


class GoogleMapsScraper:
    """Scraper for extracting business data from Google Maps."""

    def __init__(self, headless: bool = True):
        """Initialize the scraper.

        Args:
            headless: Whether to run browser in headless mode
        """
        self.headless = headless
        self.playwright = None
        self.browser = None
        self.page = None

    def __enter__(self):
        """Context manager entry."""
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=self.headless)
        self.page = self.browser.new_page()
        # Set reasonable timeouts
        self.page.set_default_timeout(30000)  # 30 seconds
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        if self.page:
            self.page.close()
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()

    def extract_businesses(self, url: str, limit: Optional[int] = None) -> List[Dict]:
        """Extract business information from Google Maps search URL.

        Args:
            url: Google Maps search URL
            limit: Maximum number of businesses to extract

        Returns:
            List of business dictionaries with extracted data
        """
        logger.info(f"Navigating to Google Maps: {url}")
        
        try:
            # Navigate to the URL
            self.page.goto(url, wait_until='networkidle')
            
            # Wait for results to load
            time.sleep(3)  # Give time for dynamic content
            
            # Try to find the results panel
            try:
                self.page.wait_for_selector('[role="feed"]', timeout=10000)
            except PlaywrightTimeout:
                logger.warning("Could not find results feed, trying alternative selectors")
            
            businesses = []
            processed_names = set()  # Track to avoid duplicates in same scrape
            
            # Scroll to load more results
            feed_selector = '[role="feed"]'
            if self.page.locator(feed_selector).count() > 0:
                # Scroll the results panel to load more items
                for _ in range(3):  # Scroll a few times
                    self.page.evaluate("""
                        (selector) => {
                            const feed = document.querySelector(selector);
                            if (feed) {
                                feed.scrollTop = feed.scrollHeight;
                            }
                        }
                    """, feed_selector)
                    time.sleep(1)
            
            # Find all business cards/items
            # Google Maps uses various selectors, try multiple approaches
            selectors = [
                'a[href*="/maps/place/"]',
                '[role="article"]',
                '.Nv2PK',  # Common Google Maps class
            ]
            
            business_elements = []
            for selector in selectors:
                elements = self.page.locator(selector).all()
                if elements:
                    business_elements = elements
                    logger.info(f"Found {len(elements)} elements with selector: {selector}")
                    break
            
            if not business_elements:
                logger.warning("No business elements found on the page")
                return []
            
            # Limit the number of businesses to process
            if limit:
                business_elements = business_elements[:limit]
            
            logger.info(f"Processing {len(business_elements)} businesses...")
            
            for idx, element in enumerate(business_elements, 1):
                try:
                    # Click on the business to load details
                    element.click()
                    time.sleep(2)  # Wait for details panel to load
                    
                    business_data = self._extract_business_details()
                    
                    if business_data and business_data.get('name'):
                        # Avoid processing same business twice in one run
                        if business_data['name'] not in processed_names:
                            businesses.append(business_data)
                            processed_names.add(business_data['name'])
                            logger.info(f"[{idx}/{len(business_elements)}] Extracted: {business_data['name']}")
                        else:
                            logger.debug(f"Skipping duplicate: {business_data['name']}")
                    
                    if limit and len(businesses) >= limit:
                        break
                        
                except Exception as e:
                    logger.warning(f"Failed to extract business {idx}: {e}")
                    continue
            
            return businesses
            
        except Exception as e:
            logger.error(f"Error during scraping: {e}")
            return []

    def _extract_business_details(self) -> Optional[Dict]:
        """Extract details from the currently displayed business panel.

        Returns:
            Dictionary with business details or None if extraction fails
        """
        try:
            data = {}
            
            # Extract name (usually in h1)
            try:
                name_element = self.page.locator('h1').first
                data['name'] = name_element.inner_text().strip() if name_element.count() > 0 else None
            except:
                data['name'] = None
            
            # Extract address
            try:
                # Look for address button or div
                address_selectors = [
                    'button[data-item-id*="address"]',
                    '[data-item-id*="address"]',
                    'div[aria-label*="Address"]',
                ]
                for selector in address_selectors:
                    addr_elem = self.page.locator(selector).first
                    if addr_elem.count() > 0:
                        data['address'] = addr_elem.inner_text().strip()
                        break
                else:
                    data['address'] = None
            except:
                data['address'] = None
            
            # Extract phone number
            try:
                phone_selectors = [
                    'button[data-item-id*="phone"]',
                    '[aria-label*="Phone"]',
                    'button[data-tooltip*="Copy phone"]',
                ]
                for selector in phone_selectors:
                    phone_elem = self.page.locator(selector).first
                    if phone_elem.count() > 0:
                        phone_text = phone_elem.inner_text().strip()
                        # Clean phone number
                        data['phone'] = phone_text.replace('Phone:', '').strip()
                        break
                else:
                    data['phone'] = None
            except:
                data['phone'] = None
            
            # Extract coordinates from URL
            try:
                current_url = self.page.url
                lat, lng = self._extract_coordinates_from_url(current_url)
                data['lat'] = lat
                data['lng'] = lng
            except:
                data['lat'] = None
                data['lng'] = None
            
            # Extract rating
            try:
                rating_elem = self.page.locator('[role="img"][aria-label*="star"]').first
                if rating_elem.count() > 0:
                    aria_label = rating_elem.get_attribute('aria-label')
                    # Extract number from "4.5 stars" or similar
                    import re
                    match = re.search(r'([\d.]+)\s*star', aria_label)
                    if match:
                        data['rating'] = float(match.group(1))
                    else:
                        data['rating'] = None
                else:
                    data['rating'] = None
            except:
                data['rating'] = None
            
            # Extract website
            try:
                website_selectors = [
                    'a[data-item-id*="authority"]',
                    'a[aria-label*="Website"]',
                    'button[data-item-id*="authority"]',
                ]
                for selector in website_selectors:
                    website_elem = self.page.locator(selector).first
                    if website_elem.count() > 0:
                        # Try to get href or the displayed text
                        href = website_elem.get_attribute('href')
                        if href and href.startswith('http'):
                            data['website'] = href
                        else:
                            data['website'] = website_elem.inner_text().strip()
                        break
                else:
                    data['website'] = None
            except:
                data['website'] = None
            
            # Extract opening hours
            try:
                hours_selectors = [
                    'button[data-item-id*="oh"]',
                    '[aria-label*="Hours"]',
                    'button[aria-label*="Show open hours"]',
                ]
                for selector in hours_selectors:
                    hours_elem = self.page.locator(selector).first
                    if hours_elem.count() > 0:
                        data['opening_hours'] = hours_elem.inner_text().strip()
                        break
                else:
                    data['opening_hours'] = None
            except:
                data['opening_hours'] = None
            
            return data if data.get('name') else None
            
        except Exception as e:
            logger.warning(f"Error extracting business details: {e}")
            return None

    def _extract_coordinates_from_url(self, url: str) -> Tuple[Optional[float], Optional[float]]:
        """Extract latitude and longitude from Google Maps URL.

        Args:
            url: Google Maps URL

        Returns:
            Tuple of (latitude, longitude) or (None, None)
        """
        try:
            # Pattern: /place/.../@lat,lng,zoom
            import re
            
            # Try to find @lat,lng pattern
            match = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', url)
            if match:
                lat = float(match.group(1))
                lng = float(match.group(2))
                return lat, lng
            
            # Try to find !3d and !4d pattern (alternative format)
            lat_match = re.search(r'!3d(-?\d+\.\d+)', url)
            lng_match = re.search(r'!4d(-?\d+\.\d+)', url)
            if lat_match and lng_match:
                lat = float(lat_match.group(1))
                lng = float(lng_match.group(1))
                return lat, lng
            
            return None, None
        except:
            return None, None


class BusinessDatabase:
    """Database handler for business operations."""

    def __init__(self, database_url: str):
        """Initialize database connection.

        Args:
            database_url: PostgreSQL connection string
        """
        self.database_url = database_url
        self.conn = None
        self.cursor = None

    def connect(self):
        """Establish database connection."""
        try:
            logger.info("Connecting to database...")
            self.conn = psycopg2.connect(self.database_url)
            self.cursor = self.conn.cursor()
            logger.info("✅ Database connected successfully")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise

    def close(self):
        """Close database connection."""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
        logger.info("Database connection closed")

    def find_duplicate(self, business: Dict) -> Optional[Dict]:
        """Find duplicate business in database.

        Checks for duplicates by:
        1. Exact name match (case-insensitive)
        2. Location proximity (~100 meters)
        3. Phone number match

        Args:
            business: Business data dictionary

        Returns:
            Existing business record if duplicate found, None otherwise
        """
        name = business.get('name')
        phone = business.get('phone')
        lat = business.get('lat')
        lng = business.get('lng')
        
        # Check by name (case-insensitive)
        if name:
            self.cursor.execute("""
                SELECT id, name, lat, lng, phone
                FROM public.business
                WHERE LOWER(name) = LOWER(%s)
                LIMIT 1
            """, (name,))
            result = self.cursor.fetchone()
            if result:
                return {
                    'id': result[0],
                    'name': result[1],
                    'lat': result[2],
                    'lng': result[3],
                    'phone': result[4],
                    'match_reason': 'name'
                }
        
        # Check by phone number
        if phone:
            # Clean phone for comparison
            clean_phone = ''.join(filter(str.isdigit, phone))
            if clean_phone:
                self.cursor.execute("""
                    SELECT id, name, lat, lng, phone
                    FROM public.business
                    WHERE phone IS NOT NULL
                    AND regexp_replace(phone, '[^0-9]', '', 'g') = %s
                    LIMIT 1
                """, (clean_phone,))
                result = self.cursor.fetchone()
                if result:
                    return {
                        'id': result[0],
                        'name': result[1],
                        'lat': result[2],
                        'lng': result[3],
                        'phone': result[4],
                        'match_reason': 'phone'
                    }
        
        # Check by location proximity (~100 meters)
        if lat is not None and lng is not None:
            self.cursor.execute("""
                SELECT id, name, lat, lng, phone,
                    ST_Distance(
                        ST_MakePoint(%s, %s)::geography,
                        ST_MakePoint(lng, lat)::geography
                    ) as distance
                FROM public.business
                WHERE lat IS NOT NULL AND lng IS NOT NULL
                AND ST_DWithin(
                    ST_MakePoint(%s, %s)::geography,
                    ST_MakePoint(lng, lat)::geography,
                    100  -- 100 meters
                )
                ORDER BY distance
                LIMIT 1
            """, (lng, lat, lng, lat))
            result = self.cursor.fetchone()
            if result:
                return {
                    'id': result[0],
                    'name': result[1],
                    'lat': result[2],
                    'lng': result[3],
                    'phone': result[4],
                    'distance': result[5],
                    'match_reason': 'location'
                }
        
        return None

    def insert_business(self, business: Dict, category: str) -> str:
        """Insert new business into database.

        Args:
            business: Business data dictionary
            category: Business category

        Returns:
            ID of the inserted business
        """
        try:
            self.cursor.execute("""
                INSERT INTO public.business (
                    name,
                    description,
                    category_id,
                    location_text,
                    lat,
                    lng,
                    location,
                    phone,
                    status,
                    is_active
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s,
                    CASE 
                        WHEN %s IS NOT NULL AND %s IS NOT NULL 
                        THEN ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                        ELSE NULL
                    END,
                    %s, %s, %s
                )
                RETURNING id
            """, (
                business.get('name'),
                business.get('opening_hours'),  # Use hours as description for now
                category,
                business.get('address'),
                business.get('lat'),
                business.get('lng'),
                # Parameters for CASE WHEN to safely create geography
                business.get('lng'),
                business.get('lat'),
                business.get('lng'),
                business.get('lat'),
                # Remaining fields
                business.get('phone'),
                'active',
                True
            ))
            
            business_id = self.cursor.fetchone()[0]
            self.conn.commit()
            return business_id
            
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Failed to insert business: {e}")
            raise

    def update_business(self, business_id: str, business: Dict, category: str):
        """Update existing business in database.

        Args:
            business_id: ID of the business to update
            business: New business data
            category: Business category
        """
        try:
            self.cursor.execute("""
                UPDATE public.business
                SET
                    name = COALESCE(%s, name),
                    description = COALESCE(%s, description),
                    category_id = COALESCE(%s, category_id),
                    location_text = COALESCE(%s, location_text),
                    lat = COALESCE(%s, lat),
                    lng = COALESCE(%s, lng),
                    location = CASE 
                        WHEN %s IS NOT NULL AND %s IS NOT NULL 
                        THEN ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                        ELSE location
                    END,
                    phone = COALESCE(%s, phone),
                    updated_at = NOW()
                WHERE id = %s
            """, (
                business.get('name'),
                business.get('opening_hours'),
                category,
                business.get('address'),
                business.get('lat'),
                business.get('lng'),
                # Parameters for CASE WHEN to safely create geography
                business.get('lng'),
                business.get('lat'),
                business.get('lng'),
                business.get('lat'),
                # Remaining fields
                business.get('phone'),
                business_id
            ))
            
            self.conn.commit()
            
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Failed to update business: {e}")
            raise


def get_database_url() -> str:
    """Get database URL from environment variables.

    Returns:
        Database connection string

    Raises:
        ValueError: If required environment variables are not set
    """
    # Try DATABASE_URL first
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        return database_url
    
    # For Supabase, DATABASE_URL is required for direct PostgreSQL connections
    # The service role key is for Supabase API, not database connections
    raise ValueError(
        "Missing required environment variable: DATABASE_URL\n"
        "Please set DATABASE_URL to your PostgreSQL connection string.\n"
        "You can find it in Supabase Dashboard > Settings > Database > Connection string (URI)\n"
        "Example: postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
    )


def main():
    """Main entry point for the scraper."""
    parser = argparse.ArgumentParser(
        description='Extract businesses from Google Maps and sync to Supabase',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage
  python scripts/google_maps_scraper.py "https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z"

  # Dry run (preview without inserting)
  python scripts/google_maps_scraper.py --dry-run "https://maps.google.com/search/pharmacies/@-1.9,30.1,15z"

  # Custom category and limit
  python scripts/google_maps_scraper.py --category restaurant --limit 20 "https://maps.google.com/..."
        """
    )
    
    parser.add_argument(
        'url',
        help='Google Maps search URL'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview businesses without inserting to database'
    )
    parser.add_argument(
        '--category',
        default='pharmacy',
        help='Business category (default: pharmacy)'
    )
    parser.add_argument(
        '--limit',
        type=int,
        help='Maximum number of businesses to scrape'
    )
    parser.add_argument(
        '--headless',
        action='store_true',
        default=True,
        help='Run browser in headless mode (default: True)'
    )
    parser.add_argument(
        '--no-headless',
        action='store_false',
        dest='headless',
        help='Run browser in visible mode for debugging'
    )
    
    args = parser.parse_args()
    
    logger.info("=" * 80)
    logger.info("Google Maps Business Scraper")
    logger.info("=" * 80)
    logger.info(f"URL: {args.url}")
    logger.info(f"Category: {args.category}")
    logger.info(f"Limit: {args.limit if args.limit else 'No limit'}")
    logger.info(f"Dry run: {args.dry_run}")
    logger.info("=" * 80)
    
    # Step 1: Scrape businesses from Google Maps
    logger.info("\n📍 Step 1: Scraping Google Maps...")
    
    try:
        with GoogleMapsScraper(headless=args.headless) as scraper:
            businesses = scraper.extract_businesses(args.url, limit=args.limit)
    except Exception as e:
        logger.error(f"❌ Scraping failed: {e}")
        return 1
    
    if not businesses:
        logger.warning("⚠️  No businesses found")
        return 0
    
    logger.info(f"✅ Found {len(businesses)} businesses")
    
    # Preview mode
    if args.dry_run:
        logger.info("\n" + "=" * 80)
        logger.info("DRY RUN MODE - Preview of businesses:")
        logger.info("=" * 80)
        for idx, business in enumerate(businesses, 1):
            logger.info(f"\n[{idx}/{len(businesses)}] {business.get('name', 'N/A')}")
            logger.info(f"  Address: {business.get('address', 'N/A')}")
            logger.info(f"  Phone: {mask_phone(business.get('phone'))}")
            logger.info(f"  Coordinates: {business.get('lat', 'N/A')}, {business.get('lng', 'N/A')}")
            logger.info(f"  Rating: {business.get('rating', 'N/A')}")
            logger.info(f"  Website: {business.get('website', 'N/A')}")
            logger.info(f"  Hours: {business.get('opening_hours', 'N/A')}")
        logger.info("\n" + "=" * 80)
        logger.info("Dry run complete. No changes made to database.")
        logger.info("=" * 80)
        return 0
    
    # Step 2: Sync to database
    logger.info("\n💾 Step 2: Syncing to database...")
    
    try:
        database_url = get_database_url()
    except ValueError as e:
        logger.error(f"❌ {e}")
        return 1
    
    db = BusinessDatabase(database_url)
    
    try:
        db.connect()
    except Exception as e:
        logger.error(f"❌ Failed to connect to database: {e}")
        return 1
    
    stats = {
        'new': 0,
        'updated': 0,
        'skipped': 0,
        'errors': 0
    }
    
    try:
        for idx, business in enumerate(businesses, 1):
            try:
                logger.info(f"\n[{idx}/{len(businesses)}] Processing: {business.get('name', 'Unknown')}")
                
                # Check for duplicates
                duplicate = db.find_duplicate(business)
                
                if duplicate:
                    logger.info(f"  ⚠️  Duplicate found (by {duplicate['match_reason']}): {duplicate['name']}")
                    
                    # Update existing record
                    db.update_business(duplicate['id'], business, args.category)
                    stats['updated'] += 1
                    logger.info(f"  ✅ Updated existing business")
                else:
                    # Insert new business
                    business_id = db.insert_business(business, args.category)
                    stats['new'] += 1
                    logger.info(f"  ✅ Inserted new business (ID: {business_id})")
                
            except Exception as e:
                logger.error(f"  ❌ Error processing business: {e}")
                stats['errors'] += 1
                continue
    
    finally:
        db.close()
    
    # Summary
    logger.info("\n" + "=" * 80)
    logger.info("Summary")
    logger.info("=" * 80)
    logger.info(f"Total businesses found: {len(businesses)}")
    logger.info(f"✅ New businesses added: {stats['new']}")
    logger.info(f"🔄 Existing businesses updated: {stats['updated']}")
    logger.info(f"⏭️  Businesses skipped: {stats['skipped']}")
    logger.info(f"❌ Errors: {stats['errors']}")
    logger.info("=" * 80)
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
