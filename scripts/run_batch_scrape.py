#!/usr/bin/env python3
"""
Run scraping in batches to reach 10,000 businesses with phone numbers
"""
import subprocess
import json
from pathlib import Path
from datetime import datetime

# High-volume categories likely to have phone numbers
BATCH_1 = ["restaurant", "hotel", "cafe", "bar", "pharmacy"]
BATCH_2 = ["salon", "barbershop", "supermarket", "clinic", "hospital"]  
BATCH_3 = ["bank", "school", "church", "gas station", "bakery"]
BATCH_4 = ["car repair", "mechanic", "electronics store", "clothing store", "furniture store"]
BATCH_5 = ["real estate", "lawyer", "dentist", "veterinary", "gym"]
BATCH_6 = ["phone shop", "hardware store", "market", "grocery store", "construction"]

ALL_BATCHES = [BATCH_1, BATCH_2, BATCH_3, BATCH_4, BATCH_5, BATCH_6]

def run_batch(batch_num, categories):
    print(f"\n{'='*70}")
    print(f"🚀 BATCH {batch_num}: {', '.join(categories)}")
    print(f"{'='*70}\n")
    
    cmd = [
        "python3", "google_maps_bulk_scraper.py",
        "--categories", *categories,
        "--per-category-limit", "100",
        "--cities", "Kigali",
        "--delay", "3"
    ]
    
    result = subprocess.run(cmd, capture_output=False, text=True)
    return result.returncode == 0

def get_total_count():
    """Get current count from summary files"""
    results_dir = Path("scraper_results")
    if not results_dir.exists():
        return 0
    
    total = 0
    for summary_file in results_dir.glob("bulk_summary_*.json"):
        try:
            with open(summary_file) as f:
                data = json.load(f)
                total += data.get("total_businesses_scraped", 0)
        except:
            pass
    return total

print("""
╔═══════════════════════════════════════════════════════════════╗
║  SCRAPING 10,000+ KIGALI BUSINESSES WITH PHONE NUMBERS       ║
╚═══════════════════════════════════════════════════════════════╝

Strategy:
• 6 batches of 5 categories each
• 100 results per category = 500 per batch
• Total target: 3,000+ businesses
• Filter: Only businesses with phone numbers

This will take approximately 2-3 hours.

Starting in 5 seconds... (Ctrl+C to cancel)
""")

import time
time.sleep(5)

start_time = datetime.now()
success_count = 0

for i, batch in enumerate(ALL_BATCHES, 1):
    if run_batch(i, batch):
        success_count += 1
        current_total = get_total_count()
        print(f"\n✓ Batch {i} complete! Total so far: ~{current_total} businesses\n")
        
        if current_total >= 10000:
            print(f"🎉 Target reached! {current_total} businesses scraped!")
            break
    else:
        print(f"\n⚠️  Batch {i} had errors, continuing...\n")
    
    # Small delay between batches
    if i < len(ALL_BATCHES):
        print(f"⏳ 10 second break before next batch...\n")
        time.sleep(10)

elapsed = datetime.now() - start_time
final_count = get_total_count()

print(f"""
╔═══════════════════════════════════════════════════════════════╗
║  SCRAPING COMPLETE!                                          ║
╚═══════════════════════════════════════════════════════════════╝

Time elapsed: {elapsed}
Batches completed: {success_count}/{len(ALL_BATCHES)}
Total businesses: ~{final_count}

Results saved to: scraper_results/
""")
