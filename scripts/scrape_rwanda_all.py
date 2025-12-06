#!/usr/bin/env python3
"""
RWANDA COMPREHENSIVE BUSINESS SCRAPER
Scrapes ALL major business types across ALL Rwanda cities
Target: 10,000+ businesses with phone numbers
"""
import os
import sys

# Set environment
os.environ["SUPABASE_URL"] = "https://lhbowpbcpwoiparwnwgt.supabase.co"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"

from google_maps_bulk_scraper import BulkScraper

print("""
╔═══════════════════════════════════════════════════════════════╗
║  SCRAPING ALL RWANDA BUSINESSES - ALL CITIES - ALL TYPES    ║
╚═══════════════════════════════════════════════════════════════╝
""")

# TOP 30 MAJOR BUSINESS CATEGORIES (No banks, no petrol stations)
categories = [
    # RETAIL & SHOPS (High Priority)
    "supermarket",
    "shop",
    "store",
    "electronics store",
    "phone shop",
    "hardware store",
    "clothing store",
    "shoe store",
    "furniture store",
    "cosmetics shop",
    "beauty supply store",
    
    # FOOD & HOSPITALITY
    "restaurant",
    "hotel",
    "cafe",
    "bar",
    "bakery",
    
    # HEALTH & PHARMACY
    "pharmacy",
    "clinic",
    "hospital",
    "doctor",
    "medical center",
    
    # SERVICES (Very Important)
    "salon",
    "barbershop",
    "spa",
    "laundry",
    "repair shop",
    "tailor",
    
    # AUTO (Without petrol stations)
    "car parts",
    "auto spare parts",
    "mechanic"
]

# ALL MAJOR RWANDA CITIES (Complete Coverage)
cities = [
    "Kigali",           # Capital
    "Butare",           # Huye - Southern Province
    "Gisenyi",          # Rubavu - Western Province
    "Rwamagana",        # Eastern Province
    "Muhanga",          # Southern Province
    "Musanze",          # Northern Province
    "Nyanza",           # Southern Province
    "Karongi",          # Western Province
    "Rusizi",           # Western Province (Kamembe)
    "Nyagatare"         # Eastern Province
]

supabase_url = os.environ["SUPABASE_URL"]
supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

scraper = BulkScraper(supabase_url, supabase_key, headless=True)

print(f"Categories: {len(categories)} (TOP business types)")
print(f"Cities: {len(cities)} (ALL major Rwanda cities)")
print(f"Per category per city: 150 results")
print(f"Total target: {len(categories) * len(cities) * 150} searches")
print(f"Expected: 10,000+ unique businesses with phone numbers")
print("")
print("Cities covered:")
for city in cities:
    print(f"  • {city}")
print("")
print("Business types:")
for i, cat in enumerate(categories, 1):
    print(f"  {i}. {cat}")
print("")
print("Filter: ONLY businesses with phone numbers")
print("")
print("⏱️  Estimated time: 10-15 hours")
print("💡 Tip: Run overnight or over weekend")
print("")
print("Starting in 5 seconds...")
import time
time.sleep(5)
print("")

summary = scraper.bulk_scrape(
    categories=categories,
    cities=cities,
    per_category_limit=150,
    dry_run=False,
    delay_between_categories=2
)

print("")
print("="*70)
print("✅ SCRAPING COMPLETE!")
print(f"Total scraped: {summary['total_businesses_scraped']}")
print(f"Inserted to DB: {summary['total_inserted_to_db']}")
print(f"Time: {summary['elapsed_seconds']/3600:.1f} hours")
print("="*70)
print("")
print("Check database:")
print("  SELECT city, category, COUNT(*) FROM businesses")
print("  WHERE phone IS NOT NULL GROUP BY city, category;")
