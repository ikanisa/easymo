#!/usr/bin/env python3
"""
Google Maps Business Scraper for Supabase
Scrapes pharmacy data from Google Maps and updates Supabase businesses table.
Prevents duplicates by checking business name + location.
"""

import os
import sys
import json
import re
import time
import hashlib
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from urllib.parse import urlparse, parse_qs

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
except ImportError:
    print("ERROR: Selenium not installed. Run: pip install selenium")
    sys.exit(1)

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: Supabase client not installed. Run: pip install supabase")
    sys.exit(1)


class GoogleMapsPharmacyScraper:
    """Scraper for pharmacy data from Google Maps"""
    
    def __init__(self, supabase_url: str, supabase_key: str, headless: bool = True):
        """
        Initialize scraper with Supabase credentials
        
        Args:
            supabase_url: Supabase project URL
            supabase_key: Supabase service role key (for insert/update)
            headless: Run browser in headless mode
        """
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.headless = headless
        self.driver = None
        self.existing_businesses = {}  # Cache for duplicate checking
        
    def _init_driver(self):
        """Initialize Chrome WebDriver"""
        chrome_options = Options()
        if self.headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        
        # Use webdriver-manager to auto-install compatible ChromeDriver
        try:
            from selenium.webdriver.chrome.service import Service
            from webdriver_manager.chrome import ChromeDriverManager
            
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
        except ImportError:
            # Fallback to system ChromeDriver
            self.driver = webdriver.Chrome(options=chrome_options)
            
        self.driver.implicitly_wait(5)
        
    def _close_driver(self):
        """Close WebDriver"""
        if self.driver:
            self.driver.quit()
            
    def _load_existing_businesses(self, country: str = "Rwanda"):
        """Load existing businesses from Supabase to prevent duplicates"""
        print(f"Loading existing businesses from {country}...")
        
        try:
            response = self.supabase.table("businesses")\
                .select("id, name, address, city, lat, lng, external_id")\
                .eq("country", country)\
                .eq("category", "Pharmacy")\
                .execute()
            
            for biz in response.data:
                # Create unique key from normalized name + location
                key = self._generate_business_key(
                    biz.get("name", ""),
                    biz.get("city", ""),
                    biz.get("address", "")
                )
                self.existing_businesses[key] = biz
                
            print(f"Loaded {len(self.existing_businesses)} existing pharmacies")
            
        except Exception as e:
            print(f"Warning: Could not load existing businesses: {e}")
            
    def _generate_business_key(self, name: str, city: str, address: str) -> str:
        """Generate unique key for duplicate detection"""
        # Normalize: lowercase, remove special chars, trim whitespace
        norm_name = re.sub(r'[^\w\s]', '', name.lower().strip())
        norm_city = re.sub(r'[^\w\s]', '', city.lower().strip())
        norm_addr = re.sub(r'[^\w\s]', '', address.lower().strip())[:50]  # First 50 chars
        
        combined = f"{norm_name}|{norm_city}|{norm_addr}"
        return hashlib.md5(combined.encode()).hexdigest()
        
    def _is_duplicate(self, name: str, city: str, address: str) -> Tuple[bool, Optional[str]]:
        """Check if business already exists"""
        key = self._generate_business_key(name, city, address)
        
        if key in self.existing_businesses:
            return True, self.existing_businesses[key].get("id")
        return False, None
        
    def _extract_coordinates_from_url(self, url: str) -> Tuple[Optional[float], Optional[float]]:
        """Extract lat/lng from Google Maps URL"""
        try:
            # Pattern: @lat,lng,zoom or /place/.../@lat,lng
            match = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', url)
            if match:
                return float(match.group(1)), float(match.group(2))
                
            # Check data parameter
            parsed = urlparse(url)
            params = parse_qs(parsed.query)
            if 'data' in params:
                data_match = re.search(r'!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)', params['data'][0])
                if data_match:
                    return float(data_match.group(1)), float(data_match.group(2))
                    
        except Exception as e:
            print(f"Error extracting coordinates: {e}")
            
        return None, None
        
    def _scroll_results(self, max_scrolls: int = 20):
        """Scroll the results panel to load more businesses"""
        try:
            # Find scrollable results container
            scrollable = self.driver.find_element(
                By.CSS_SELECTOR, 
                'div[role="feed"]'
            )
            
            last_height = self.driver.execute_script("return arguments[0].scrollHeight", scrollable)
            
            for i in range(max_scrolls):
                # Scroll down
                self.driver.execute_script(
                    "arguments[0].scrollTo(0, arguments[0].scrollHeight)", 
                    scrollable
                )
                time.sleep(2)  # Wait for loading
                
                # Check if reached bottom
                new_height = self.driver.execute_script("return arguments[0].scrollHeight", scrollable)
                if new_height == last_height:
                    print(f"Reached end of results after {i+1} scrolls")
                    break
                    
                last_height = new_height
                print(f"Scroll {i+1}/{max_scrolls}...")
                
        except Exception as e:
            print(f"Scroll error (non-fatal): {e}")
            
    def _extract_business_details(self, element) -> Optional[Dict]:
        """Extract details from a single business card element"""
        try:
            details = {}
            
            # Business name
            try:
                name_elem = element.find_element(By.CSS_SELECTOR, 'div.fontHeadlineSmall')
                details['name'] = name_elem.text.strip()
            except NoSuchElementException:
                return None  # Skip if no name
                
            # Rating
            try:
                rating_elem = element.find_element(By.CSS_SELECTOR, 'span[role="img"]')
                rating_text = rating_elem.get_attribute('aria-label')
                rating_match = re.search(r'(\d+\.?\d*)', rating_text)
                if rating_match:
                    details['rating'] = float(rating_match.group(1))
            except:
                details['rating'] = 0.0
                
            # Review count
            try:
                reviews_elem = element.find_element(By.CSS_SELECTOR, 'span.fontBodyMedium span[aria-label]')
                reviews_text = reviews_elem.get_attribute('aria-label')
                reviews_match = re.search(r'([\d,]+)', reviews_text)
                if reviews_match:
                    details['review_count'] = int(reviews_match.group(1).replace(',', ''))
            except:
                details['review_count'] = 0
                
            # Address (approximation from displayed text)
            try:
                address_elems = element.find_elements(By.CSS_SELECTOR, 'div.fontBodyMedium span')
                for elem in address_elems:
                    text = elem.text.strip()
                    # Look for address-like text (contains street patterns)
                    if any(word in text.lower() for word in ['street', 'avenue', 'road', 'kigali', 'kn']):
                        details['address'] = text
                        break
            except:
                pass
                
            # Link (to extract coordinates later)
            try:
                link_elem = element.find_element(By.CSS_SELECTOR, 'a[href*="maps"]')
                details['gmaps_url'] = link_elem.get_attribute('href')
            except:
                pass
                
            return details if details.get('name') else None
            
        except Exception as e:
            print(f"Error extracting business: {e}")
            return None
            
    def scrape_pharmacies(self, gmaps_url: str, country: str = "Rwanda", 
                         city: str = "Kigali", max_results: int = 100) -> List[Dict]:
        """
        Scrape pharmacies from Google Maps URL
        
        Args:
            gmaps_url: Google Maps search URL for pharmacies
            country: Country name (default: Rwanda)
            city: City name (default: Kigali) 
            max_results: Maximum businesses to scrape
            
        Returns:
            List of pharmacy dictionaries
        """
        print(f"\n=== Scraping Pharmacies from Google Maps ===")
        print(f"URL: {gmaps_url}")
        print(f"Location: {city}, {country}")
        
        self._init_driver()
        pharmacies = []
        
        try:
            # Load page
            print("Loading Google Maps...")
            self.driver.get(gmaps_url)
            time.sleep(5)  # Wait for initial load
            
            # Extract center coordinates from URL
            center_lat, center_lng = self._extract_coordinates_from_url(gmaps_url)
            
            # Scroll to load more results
            self._scroll_results(max_scrolls=10)
            
            # Find all business cards
            print("Extracting business data...")
            business_cards = self.driver.find_elements(
                By.CSS_SELECTOR,
                'div[role="feed"] > div > div > a'
            )
            
            print(f"Found {len(business_cards)} potential businesses")
            
            for idx, card in enumerate(business_cards[:max_results]):
                if idx % 10 == 0:
                    print(f"Processing {idx}/{min(len(business_cards), max_results)}...")
                
                try:
                    # Click to open details panel
                    self.driver.execute_script("arguments[0].scrollIntoView(true);", card)
                    time.sleep(0.5)
                    card.click()
                    time.sleep(2)  # Wait for details to load
                    
                    # Extract details from details panel
                    pharmacy = {}
                    
                    # Name
                    try:
                        name = self.driver.find_element(By.CSS_SELECTOR, 'h1.fontHeadlineLarge').text.strip()
                        pharmacy['name'] = name
                    except:
                        continue
                        
                    # Rating
                    try:
                        rating_div = self.driver.find_element(By.CSS_SELECTOR, 'div[role="img"][aria-label*="star"]')
                        rating_text = rating_div.get_attribute('aria-label')
                        rating_match = re.search(r'(\d+\.?\d*)', rating_text)
                        if rating_match:
                            pharmacy['rating'] = float(rating_match.group(1))
                    except:
                        pharmacy['rating'] = 0.0
                        
                    # Review count
                    try:
                        reviews = self.driver.find_element(By.CSS_SELECTOR, 'button[aria-label*="review"]').text
                        reviews_match = re.search(r'([\d,]+)', reviews)
                        if reviews_match:
                            pharmacy['review_count'] = int(reviews_match.group(1).replace(',', ''))
                    except:
                        pharmacy['review_count'] = 0
                        
                    # Address
                    try:
                        address_button = self.driver.find_element(
                            By.CSS_SELECTOR,
                            'button[data-item-id="address"]'
                        )
                        address = address_button.get_attribute('aria-label')
                        if address:
                            # Clean "Address: " prefix
                            pharmacy['address'] = address.replace('Address:', '').strip()
                    except:
                        pharmacy['address'] = ""
                        
                    # Phone
                    try:
                        phone_button = self.driver.find_element(
                            By.CSS_SELECTOR,
                            'button[data-item-id*="phone"]'
                        )
                        phone = phone_button.get_attribute('aria-label')
                        if phone:
                            pharmacy['phone'] = phone.replace('Phone:', '').strip()
                    except:
                        pharmacy['phone'] = ""
                        
                    # Website
                    try:
                        website_link = self.driver.find_element(
                            By.CSS_SELECTOR,
                            'a[data-item-id="authority"]'
                        )
                        pharmacy['website'] = website_link.get_attribute('href')
                    except:
                        pharmacy['website'] = ""
                        
                    # Coordinates from current URL
                    current_url = self.driver.current_url
                    lat, lng = self._extract_coordinates_from_url(current_url)
                    if lat and lng:
                        pharmacy['lat'] = lat
                        pharmacy['lng'] = lng
                    elif center_lat and center_lng:
                        # Fallback to search center
                        pharmacy['lat'] = center_lat
                        pharmacy['lng'] = center_lng
                        
                    # Set defaults
                    pharmacy['category'] = 'Pharmacy'
                    pharmacy['city'] = city
                    pharmacy['country'] = country
                    pharmacy['status'] = 'active'
                    
                    # Generate external_id from Google Place ID if available
                    place_match = re.search(r'/place/[^/]+/data=([^/!]+)', current_url)
                    if place_match:
                        pharmacy['external_id'] = f"gmaps_{place_match.group(1)}"
                    else:
                        # Fallback: hash of name + address
                        pharmacy['external_id'] = f"gmaps_{hashlib.md5(f'{pharmacy['name']}_{pharmacy.get('address', '')}'.encode()).hexdigest()[:16]}"
                    
                    pharmacies.append(pharmacy)
                    print(f"  ✓ {pharmacy['name']} - {pharmacy.get('address', 'No address')}")
                    
                except Exception as e:
                    print(f"  ✗ Error processing business: {e}")
                    continue
                    
        except Exception as e:
            print(f"Fatal error during scraping: {e}")
            
        finally:
            self._close_driver()
            
        print(f"\n=== Scraped {len(pharmacies)} pharmacies ===\n")
        return pharmacies
        
    def update_supabase(self, pharmacies: List[Dict], dry_run: bool = False) -> Dict[str, int]:
        """
        Update Supabase businesses table with scraped pharmacies
        
        Args:
            pharmacies: List of pharmacy dictionaries
            dry_run: If True, only check for duplicates without inserting
            
        Returns:
            Stats dict with counts of inserted, updated, skipped
        """
        stats = {'inserted': 0, 'updated': 0, 'skipped': 0, 'errors': 0}
        
        print(f"\n=== {'DRY RUN: ' if dry_run else ''}Updating Supabase ===")
        
        # Load existing businesses for duplicate check
        if pharmacies:
            self._load_existing_businesses(pharmacies[0].get('country', 'Rwanda'))
        
        for pharmacy in pharmacies:
            name = pharmacy.get('name', '')
            city = pharmacy.get('city', '')
            address = pharmacy.get('address', '')
            
            if not name:
                print(f"  ✗ Skipping: No name")
                stats['skipped'] += 1
                continue
                
            # Check for duplicates
            is_dup, existing_id = self._is_duplicate(name, city, address)
            
            if is_dup:
                print(f"  ⊘ DUPLICATE: {name} (existing ID: {existing_id})")
                stats['skipped'] += 1
                continue
                
            if dry_run:
                print(f"  ✓ Would insert: {name}")
                stats['inserted'] += 1
                continue
                
            # Insert new business
            try:
                # Prepare data for insert
                insert_data = {
                    'name': pharmacy.get('name'),
                    'category': pharmacy.get('category', 'Pharmacy'),
                    'city': pharmacy.get('city'),
                    'address': pharmacy.get('address'),
                    'country': pharmacy.get('country', 'Rwanda'),
                    'lat': pharmacy.get('lat'),
                    'lng': pharmacy.get('lng'),
                    'phone': pharmacy.get('phone'),
                    'website': pharmacy.get('website'),
                    'status': pharmacy.get('status', 'active'),
                    'rating': pharmacy.get('rating', 0.0),
                    'review_count': pharmacy.get('review_count', 0),
                    'external_id': pharmacy.get('external_id')
                }
                
                # Remove None values
                insert_data = {k: v for k, v in insert_data.items() if v is not None}
                
                response = self.supabase.table("businesses").insert(insert_data).execute()
                
                if response.data:
                    inserted_id = response.data[0].get('id')
                    print(f"  ✓ INSERTED: {name} (ID: {inserted_id})")
                    stats['inserted'] += 1
                    
                    # Add to cache to prevent duplicates in same batch
                    key = self._generate_business_key(name, city, address)
                    self.existing_businesses[key] = {'id': inserted_id}
                else:
                    print(f"  ✗ Failed to insert: {name}")
                    stats['errors'] += 1
                    
            except Exception as e:
                print(f"  ✗ ERROR inserting {name}: {e}")
                stats['errors'] += 1
                
        print(f"\n=== Update Complete ===")
        print(f"Inserted: {stats['inserted']}")
        print(f"Updated: {stats['updated']}")
        print(f"Skipped (duplicates): {stats['skipped']}")
        print(f"Errors: {stats['errors']}")
        
        return stats


def main():
    """Main CLI entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Scrape Google Maps pharmacies and update Supabase'
    )
    parser.add_argument('url', help='Google Maps search URL')
    parser.add_argument('--country', default='Rwanda', help='Country name')
    parser.add_argument('--city', default='Kigali', help='City name')
    parser.add_argument('--max-results', type=int, default=100, help='Max results to scrape')
    parser.add_argument('--headless', action='store_true', help='Run browser in headless mode')
    parser.add_argument('--dry-run', action='store_true', help='Only check for duplicates, do not insert')
    parser.add_argument('--output', help='Save scraped data to JSON file')
    
    args = parser.parse_args()
    
    # Get credentials from environment
    supabase_url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_key:
        print("ERROR: Missing environment variables:")
        print("  SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)")
        print("  SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
        
    # Initialize scraper
    scraper = GoogleMapsPharmacyScraper(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        headless=args.headless
    )
    
    # Scrape pharmacies
    pharmacies = scraper.scrape_pharmacies(
        gmaps_url=args.url,
        country=args.country,
        city=args.city,
        max_results=args.max_results
    )
    
    # Save to file if requested
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(pharmacies, f, indent=2, ensure_ascii=False)
        print(f"\nSaved {len(pharmacies)} pharmacies to {args.output}")
    
    # Update Supabase
    if pharmacies:
        stats = scraper.update_supabase(pharmacies, dry_run=args.dry_run)
        
        if args.dry_run:
            print("\n⚠️  DRY RUN: No data was inserted. Run without --dry-run to insert.")
    else:
        print("No pharmacies scraped.")


if __name__ == '__main__':
    main()
