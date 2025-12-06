#!/usr/bin/env python3
"""
Google Maps Business Scraper v2 - Updated for 2025
Scrapes business data from Google Maps using modern selectors
"""

import os
import sys
import json
import re
import time
import hashlib
from typing import Dict, List, Optional
from datetime import datetime
from urllib.parse import urlparse, parse_qs

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
from supabase import create_client, Client


class GoogleMapsScraper:
    """Modern Google Maps scraper with updated selectors"""
    
    def __init__(self, supabase_url: str, supabase_key: str, headless: bool = True):
        self.supabase = create_client(supabase_url, supabase_key)
        self.headless = headless
        self.driver = None
        self.existing_businesses = {}
        
    def _init_driver(self):
        """Initialize Chrome WebDriver with auto-updated ChromeDriver"""
        options = Options()
        if self.headless:
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=options)
        self.driver.implicitly_wait(3)
        
    def _scroll_results(self, max_scrolls: int = 5):
        """Scroll to load more results"""
        try:
            # Find scrollable feed element
            scrollable = self.driver.find_element(By.CSS_SELECTOR, 'div[role="feed"]')
            
            for i in range(max_scrolls):
                self.driver.execute_script(
                    "arguments[0].scrollTo(0, arguments[0].scrollHeight);", 
                    scrollable
                )
                time.sleep(2)
                print(f"  Scroll {i+1}/{max_scrolls}...")
                
        except Exception as e:
            print(f"  Warning: Could not scroll: {e}")
    
    def _extract_from_url(self, url: str) -> Optional[Dict]:
        """Extract place data from Google Maps URL"""
        try:
            # Extract place ID or coordinates
            if '/maps/place/' in url:
                # Extract from place URL
                match = re.search(r'!1s(0x[a-f0-9]+:0x[a-f0-9]+)', url)
                if match:
                    return {"place_id": match.group(1)}
            
            # Extract coordinates
            coord_match = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', url)
            if coord_match:
                return {
                    "lat": float(coord_match.group(1)),
                    "lng": float(coord_match.group(2))
                }
        except:
            pass
        return None
    
    def _format_rwanda_phone(self, phone: str) -> str:
        """
        Format phone number to Rwanda standard: +250XXXXXXXXX
        Examples:
          0788 767 816 -> +250788767816
          788 767 816 -> +250788767816
          +250788767816 -> +250788767816
        """
        if not phone:
            return ""
        
        # Remove all spaces, dashes, parentheses
        phone = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "").replace(".", "")
        
        # Remove leading zeros
        phone = phone.lstrip("0")
        
        # If already has +250, just return cleaned version
        if phone.startswith("+250"):
            return phone
        
        # If starts with 250, add +
        if phone.startswith("250"):
            return "+" + phone
        
        # Otherwise, add +250 prefix (assuming Rwanda number)
        if len(phone) >= 9:  # Rwanda numbers are 9 digits after country code
            return "+250" + phone
        
        # Invalid number
        return ""
    
    def _extract_business_details(self) -> Optional[Dict]:
        """Extract business details from open details panel"""
        details = {}
        
        try:
            # Name - try multiple selectors
            for selector in ['h1.DUwDvf', 'h1.fontHeadlineLarge', 'h1']:
                try:
                    name_elem = self.driver.find_element(By.CSS_SELECTOR, selector)
                    name = name_elem.text.strip()
                    if name and name != "Results":
                        details['name'] = name
                        break
                except:
                    continue
            
            if not details.get('name'):
                return None
            
            # Rating
            try:
                rating_elem = self.driver.find_element(By.CSS_SELECTOR, 'div.F7nice span[aria-hidden="true"]')
                details['rating'] = float(rating_elem.text.replace(',', '.'))
            except:
                details['rating'] = 0.0
            
            # Review count
            try:
                reviews_elem = self.driver.find_element(By.CSS_SELECTOR, 'div.F7nice span[aria-label*="review"]')
                reviews_text = reviews_elem.get_attribute('aria-label')
                match = re.search(r'([\d,]+)', reviews_text)
                if match:
                    details['review_count'] = int(match.group(1).replace(',', ''))
            except:
                details['review_count'] = 0
            
            # Category
            try:
                category_elem = self.driver.find_element(By.CSS_SELECTOR, 'button.DkEaL')
                details['category_type'] = category_elem.text.strip()
            except:
                pass
            
            # Address
            try:
                address_button = self.driver.find_element(By.CSS_SELECTOR, 'button[data-item-id="address"]')
                address_text = address_button.get_attribute('aria-label')
                if address_text:
                    details['address'] = address_text.replace('Address: ', '').strip()
            except:
                details['address'] = ""
            
            # Phone
            try:
                phone_button = self.driver.find_element(By.CSS_SELECTOR, 'button[data-tooltip="Copy phone number"]')
                phone_text = phone_button.get_attribute('aria-label')
                if phone_text:
                    raw_phone = phone_text.replace('Phone: ', '').strip()
                    # Format to Rwanda standard: +250XXXXXXXXX
                    details['phone'] = self._format_rwanda_phone(raw_phone)
            except:
                details['phone'] = ""
            
            # Website
            try:
                website_link = self.driver.find_element(By.CSS_SELECTOR, 'a[data-item-id="authority"]')
                details['website'] = website_link.get_attribute('href')
            except:
                details['website'] = ""
            
            # Hours
            try:
                hours_button = self.driver.find_element(By.CSS_SELECTOR, 'button[data-item-id*="oh"]')
                hours_text = hours_button.get_attribute('aria-label')
                if hours_text:
                    details['hours'] = hours_text
            except:
                pass
            
            # Coordinates from URL
            current_url = self.driver.current_url
            coord_data = self._extract_from_url(current_url)
            if coord_data:
                details.update(coord_data)
            
            # External ID (Google Place ID)
            if 'place_id' in details:
                details['external_id'] = details['place_id']
            
            return details
            
        except Exception as e:
            print(f"    Error extracting details: {e}")
            return None
    
    def scrape_category(
        self, 
        gmaps_url: str,
        category: str = "business",
        city: str = "Kigali",
        country: str = "Rwanda",
        max_results: int = 50
    ) -> List[Dict]:
        """
        Scrape businesses from Google Maps search URL
        
        Args:
            gmaps_url: Google Maps search URL
            category: Business category
            city: City name
            country: Country name
            max_results: Maximum businesses to scrape
            
        Returns:
            List of business dictionaries
        """
        print(f"\n{'='*60}")
        print(f"📍 Scraping: {category.upper()} in {city}, {country}")
        print(f"{'='*60}")
        print(f"URL: {gmaps_url}")
        print(f"Max results: {max_results}")
        
        self._init_driver()
        businesses = []
        
        try:
            # Load page
            print("Loading Google Maps...")
            self.driver.get(gmaps_url)
            time.sleep(6)  # Wait for initial load
            
            # Scroll to load more results
            print("Loading more results...")
            self._scroll_results(max_scrolls=5)
            
            # Find all business links
            print("Finding businesses...")
            result_links = self.driver.find_elements(By.CSS_SELECTOR, 'a[href*="/maps/place/"]')
            print(f"Found {len(result_links)} businesses")
            
            processed = 0
            for idx, link in enumerate(result_links):
                if processed >= max_results:
                    break
                
                try:
                    # Scroll into view and click
                    self.driver.execute_script("arguments[0].scrollIntoView(true);", link)
                    time.sleep(0.5)
                    link.click()
                    time.sleep(3)  # Wait for details to load
                    
                    # Extract details
                    business = self._extract_business_details()
                    
                    if business and business.get('name'):
                        # Add metadata
                        business['category'] = category
                        business['city'] = city
                        business['country'] = country
                        business['source'] = 'Google Maps'
                        business['scraped_at'] = datetime.utcnow().isoformat()
                        
                        # Only add if has phone number AND it's properly formatted
                        if business.get('phone') and business['phone'].startswith('+250') and len(business['phone']) == 13:
                            businesses.append(business)
                            processed += 1
                            
                            if processed % 10 == 0:
                                print(f"  Processed {processed}/{max_results} (with valid phone)...")
                        else:
                            if business.get('phone'):
                                print(f"  ⊘ Skipped {business['name']} (invalid phone: {business.get('phone')})")
                            else:
                                print(f"  ⊘ Skipped {business['name']} (no phone)")
                    
                except Exception as e:
                    print(f"  Error processing business {idx}: {e}")
                    continue
            
            print(f"\n✓ Scraped {len(businesses)} businesses")
            return businesses
            
        except Exception as e:
            print(f"✗ Scraping error: {e}")
            return businesses
            
        finally:
            if self.driver:
                self.driver.quit()
    
    def _generate_business_key(self, name: str, city: str, address: str) -> str:
        """Generate unique key for duplicate detection"""
        normalized = f"{name}|{city}|{address}".lower()
        normalized = re.sub(r'[^\w\s]', '', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def update_supabase(self, businesses: List[Dict], category: str = "business") -> Dict:
        """
        Update Supabase with scraped businesses
        
        Returns:
            Statistics dictionary
        """
        stats = {"inserted": 0, "duplicates": 0, "errors": 0}
        
        print(f"\n📤 Updating Supabase...")
        
        # Load existing businesses
        try:
            response = self.supabase.table("businesses")\
                .select("id, name, city, address")\
                .execute()
            
            existing_keys = set()
            for biz in response.data:
                key = self._generate_business_key(
                    biz.get('name', ''),
                    biz.get('city', ''),
                    biz.get('address', '')
                )
                existing_keys.add(key)
            
            print(f"  Loaded {len(existing_keys)} existing businesses")
            
        except Exception as e:
            print(f"  Warning: Could not load existing: {e}")
            existing_keys = set()
        
        # Insert new businesses
        for business in businesses:
            key = self._generate_business_key(
                business.get('name', ''),
                business.get('city', ''),
                business.get('address', '')
            )
            
            if key in existing_keys:
                print(f"  ⊘ DUPLICATE: {business['name']}")
                stats['duplicates'] += 1
                continue
            
            try:
                # Prepare data for insertion
                data = {
                    "name": business.get('name'),
                    "category": business.get('category', category),
                    "city": business.get('city'),
                    "address": business.get('address'),
                    "country": business.get('country', 'Rwanda'),
                    "lat": business.get('lat'),
                    "lng": business.get('lng'),
                    "phone": business.get('phone'),
                    "website": business.get('website'),
                    "rating": business.get('rating'),
                    "review_count": business.get('review_count'),
                    "status": "active",
                    "external_id": business.get('external_id'),
                }
                
                # Remove None values
                data = {k: v for k, v in data.items() if v is not None}
                
                # Insert
                self.supabase.table("businesses").insert(data).execute()
                print(f"  ✓ INSERTED: {business['name']}")
                stats['inserted'] += 1
                existing_keys.add(key)
                
            except Exception as e:
                print(f"  ✗ ERROR: {business['name']} - {e}")
                stats['errors'] += 1
        
        print(f"\n{'='*60}")
        print(f"✓ Inserted: {stats['inserted']}")
        print(f"⊘ Duplicates: {stats['duplicates']}")
        print(f"✗ Errors: {stats['errors']}")
        print(f"{'='*60}")
        
        return stats


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Scrape Google Maps businesses")
    parser.add_argument("url", help="Google Maps search URL")
    parser.add_argument("--category", default="business", help="Business category")
    parser.add_argument("--city", default="Kigali", help="City name")
    parser.add_argument("--country", default="Rwanda", help="Country name")
    parser.add_argument("--max-results", type=int, default=50, help="Max results")
    parser.add_argument("--dry-run", action="store_true", help="Don't insert to DB")
    parser.add_argument("--output", help="Save to JSON file")
    parser.add_argument("--headless", action="store_true", help="Headless mode")
    
    args = parser.parse_args()
    
    # Get credentials
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Error: Environment variables not set")
        sys.exit(1)
    
    # Scrape
    scraper = GoogleMapsScraper(supabase_url, supabase_key, args.headless)
    businesses = scraper.scrape_category(
        gmaps_url=args.url,
        category=args.category,
        city=args.city,
        country=args.country,
        max_results=args.max_results
    )
    
    # Save to file
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(businesses, f, indent=2)
        print(f"\n✓ Saved to {args.output}")
    
    # Update Supabase
    if not args.dry_run and businesses:
        scraper.update_supabase(businesses, args.category)
    
    print(f"\n✅ Complete! Scraped {len(businesses)} businesses")


if __name__ == "__main__":
    main()
