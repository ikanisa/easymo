# Google Maps Bulk Business Scraper

A comprehensive Python script to extract ALL businesses from Google Maps across multiple categories in Kigali, Rwanda and sync them to the Supabase `businesses` table.

**Target:** ~10,000 businesses across 48 categories

## Features

### Multi-Category Bulk Scraping
- Scrapes 48 business categories automatically
- Covers all major areas in Kigali (Nyarugenge, Gasabo, Kicukiro)
- Categories include: pharmacies, shops, restaurants, banks, hotels, hospitals, etc.

### Google Maps Data Extraction
For each business, extracts:
- Business name
- Address/location text
- Phone number
- Latitude and longitude coordinates
- Rating and review count
- Website URL
- Business category/type
- Google Maps place ID (for deduplication)
- Opening hours (if available)

### Bulk Processing Features
- **Rate limiting**: 2-4 second delays between requests to avoid being blocked
- **Checkpointing**: Saves progress after each category to resume if interrupted
- **Batch processing**: Processes in batches of 100 businesses for database operations
- **Progress tracking**: Real-time progress bar showing X/Y categories completed
- **Error recovery**: Retries failed extractions up to 3 times with exponential backoff

### Supabase Integration
- Connects using environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Batch upsert to `businesses` table (100 at a time for efficiency)
- Uses `external_id` (Google Maps place ID) for deduplication

### Enhanced Duplicate Detection
Checks for duplicates by:
1. Google Maps place ID (most reliable)
2. Exact name match (case-insensitive) + location within 100m
3. Phone number match

Skips duplicates and updates if data has changed.

### Safety Features
- Respect Google's rate limits (2-4 second delays between requests)
- Random delays to appear more human-like
- User-agent rotation
- Headless browser mode
- Graceful shutdown on Ctrl+C (saves progress)

## Installation

### 1. Install Dependencies

```bash
pip3 install -r scripts/requirements-scraper.txt
```

### 2. Install Playwright Browsers

```bash
playwright install chromium
```

### 3. Set Environment Variables

Create a `.env` file or export environment variables:

```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Quick Start Example

Here's a complete example to get started quickly:

```bash
# 1. Install dependencies
pip3 install -r scripts/requirements-scraper.txt
playwright install chromium

# 2. Set environment variables
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 3. Test with a small dry run (no database writes)
python3 scripts/google_maps_bulk_scraper.py \
  --categories "pharmacy" \
  --per-category-limit 5 \
  --dry-run

# 4. Run for real on a few categories
python3 scripts/google_maps_bulk_scraper.py \
  --categories "pharmacy,restaurant,bank" \
  --per-category-limit 50

# 5. Run full scrape (all categories, ~10,000 businesses)
python3 scripts/google_maps_bulk_scraper.py
```

## Usage

### Scrape All Categories (Default)

```bash
python3 scripts/google_maps_bulk_scraper.py
```

### Scrape Specific Categories Only

```bash
python3 scripts/google_maps_bulk_scraper.py --categories "pharmacy,restaurant,hotel"
```

### Limit Total Businesses

```bash
python3 scripts/google_maps_bulk_scraper.py --limit 10000
```

### Limit Businesses Per Category

```bash
python3 scripts/google_maps_bulk_scraper.py --per-category-limit 50
```

### Dry Run (Preview Without Inserting)

```bash
python3 scripts/google_maps_bulk_scraper.py --dry-run
```

### Resume from Checkpoint

```bash
python3 scripts/google_maps_bulk_scraper.py --resume
```

### Specify Output File

```bash
python3 scripts/google_maps_bulk_scraper.py --output /path/to/output.json
```

### Combine Options

```bash
python3 scripts/google_maps_bulk_scraper.py \
  --categories "pharmacy,restaurant,hotel,supermarket" \
  --per-category-limit 100 \
  --output kigali_businesses_batch1.json
```

## Output

### JSON File
All scraped businesses are saved to a JSON file (default: `scripts/businesses_kigali.json`)

### Summary Report
A detailed report is generated and saved to `scripts/scraping_report_YYYYMMDD_HHMMSS.txt`

Example:
```
============================================================
Kigali Business Scraping Report
============================================================
Total businesses found: 10,247
New businesses added: 8,532
Existing updated: 1,203
Duplicates skipped: 512

By Category:
  - restaurants: 1,847
  - shops: 1,523
  - pharmacies: 342
  - banks: 287
  - hotels: 215
  ...
============================================================
```

### Checkpoint File
Progress is saved to `scripts/scraper_checkpoint.json` after each category. This file is automatically deleted when scraping completes successfully.

## Database Schema

The script upserts to the `businesses` table with the following columns:

```sql
- id: UUID (auto-generated)
- name: TEXT (required)
- category: TEXT (pharmacy, shop, hardware, auto, restaurant, etc.)
- address: TEXT
- phone: TEXT
- website: TEXT
- lat: DECIMAL(10,8)
- lng: DECIMAL(11,8)
- rating: DECIMAL(2,1)
- review_count: INTEGER
- external_id: TEXT UNIQUE (Google Maps place ID)
- status: TEXT (default 'active')
- city: TEXT
- country: TEXT (default 'RW')
- created_at: TIMESTAMPTZ (auto-generated)
```

## Categories Scraped

The script scrapes 48 categories defined in `scripts/kigali_categories.json`:

- pharmacy
- shop
- hardware store
- auto service
- restaurant
- supermarket
- bank
- hotel
- hospital/clinic
- school
- gas station
- salon/barbershop
- gym/fitness
- electronics store
- furniture store
- clothing store
- grocery store
- bakery
- cafe
- bar
- car wash
- mechanic/garage
- construction materials
- real estate agency
- insurance company
- law firm
- accounting firm
- travel agency
- printing service
- laundry/dry cleaning
- veterinary clinic
- dentist
- optician
- jewelry store
- bookstore
- stationery shop
- mobile phone shop
- computer shop
- building materials
- paint shop
- plumbing supplies
- electrical supplies

## Testing

### Run Unit Tests

The scraper includes unit tests that validate core logic without requiring internet access:

```bash
python3 scripts/test_scraper.py
```

This will test:
- Place ID extraction from Google Maps URLs
- Duplicate detection logic
- Category configuration loading
- Data transformation for database

### Run Dry Run Test

Test the full scraper without database writes:

```bash
python3 scripts/google_maps_bulk_scraper.py \
  --categories "pharmacy" \
  --per-category-limit 3 \
  --dry-run
```

## Troubleshooting

### Browser Installation Issues

If you get browser installation errors:

```bash
# Install system dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libdbus-1-3 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2

# Then reinstall Playwright browsers
playwright install chromium
```

### Rate Limiting

If you're being rate-limited by Google:
- Increase `MIN_DELAY` and `MAX_DELAY` in the script
- Reduce `--per-category-limit`
- Use `--resume` to continue after a break

### Network Errors

If you encounter network errors:
- Check your internet connection
- Verify Google Maps is accessible
- Try running with fewer categories at a time

### Database Errors

If you get Supabase errors:
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly
- Check that the `businesses` table exists with the correct schema
- Ensure the service role key has permission to insert/update

## Notes

- The script runs in headless mode by default for efficiency
- Progress is automatically saved after each category
- Press Ctrl+C to gracefully stop and save progress
- The script respects Google's robots.txt and rate limits
- Estimated time: 4-8 hours for all categories (depends on results per category)

## Files Created

```
scripts/
├── google_maps_bulk_scraper.py      # Main scraper script
├── kigali_categories.json           # Category configuration
├── requirements-scraper.txt          # Python dependencies
├── businesses_kigali.json           # Output file (gitignored)
├── scraper_checkpoint.json          # Checkpoint file (gitignored)
└── scraping_report_*.txt            # Summary reports (gitignored)
```

## License

Part of the EasyMO project. See main repository LICENSE for details.
