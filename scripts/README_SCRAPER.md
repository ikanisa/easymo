# Google Maps Business Scraper for Supabase

Automated Python script to scrape pharmacy (and other business) data from Google Maps and sync to your Supabase `businesses` table with intelligent duplicate prevention.

## Features

✅ **Automated Scraping**: Extracts business name, address, phone, website, rating, reviews, coordinates  
✅ **Duplicate Prevention**: Checks existing businesses by normalized name + location  
✅ **Batch Processing**: Scroll through results and scrape multiple businesses  
✅ **Dry Run Mode**: Preview what will be inserted without modifying database  
✅ **Export to JSON**: Save scraped data for review before inserting  
✅ **Coordinates Extraction**: Parses lat/lng from Google Maps URLs  
✅ **Observability**: Structured logging with insert/update/skip stats

## Installation

### 1. Install Python Dependencies

```bash
cd scripts
pip install -r requirements-scraper.txt
```

### 2. Install ChromeDriver

**macOS (Homebrew):**
```bash
brew install chromedriver
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y chromium-chromedriver
```

**Or use webdriver-manager (automatic):**
```bash
pip install webdriver-manager
```

Then update the script to use:
```python
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service

service = Service(ChromeDriverManager().install())
self.driver = webdriver.Chrome(service=service, options=chrome_options)
```

### 3. Set Environment Variables

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."  # Service role key (not anon key!)
```

Or create `.env.scraper`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

Load it:
```bash
source .env.scraper
```

## Usage

### Basic Usage

```bash
python gmaps_scraper.py "https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z"
```

### Advanced Options

```bash
python gmaps_scraper.py \
  "https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z" \
  --country "Rwanda" \
  --city "Kigali" \
  --max-results 50 \
  --headless \
  --dry-run \
  --output pharmacies.json
```

**Arguments:**
- `url` (required): Google Maps search URL
- `--country`: Country name (default: Rwanda)
- `--city`: City name (default: Kigali)
- `--max-results`: Maximum businesses to scrape (default: 100)
- `--headless`: Run Chrome in headless mode (no GUI)
- `--dry-run`: Check duplicates without inserting to database
- `--output`: Save scraped data to JSON file

### Recommended Workflow

1. **Test with dry run** to see what will be inserted:
   ```bash
   python gmaps_scraper.py "YOUR_GMAPS_URL" --dry-run --output test.json
   ```

2. **Review the JSON output**:
   ```bash
   cat test.json | jq '.[] | {name, address, phone}'
   ```

3. **Run actual insert** (remove --dry-run):
   ```bash
   python gmaps_scraper.py "YOUR_GMAPS_URL" --output pharmacies_final.json
   ```

## How It Works

### 1. Scraping Process
- Loads Google Maps URL in Chrome (Selenium)
- Scrolls results panel to load more businesses
- Clicks each business card to open details panel
- Extracts: name, rating, reviews, address, phone, website, coordinates
- Generates unique `external_id` from Google Place ID or hash

### 2. Duplicate Detection
Creates normalized key from:
- Business name (lowercase, no special chars)
- City (lowercase, no special chars)
- Address (first 50 chars, normalized)

MD5 hash of `name|city|address` is checked against existing businesses.

### 3. Database Insertion
Maps scraped data to `businesses` table columns:
```sql
{
  name: TEXT,
  category: TEXT ('Pharmacy'),
  city: TEXT,
  address: TEXT,
  country: TEXT ('Rwanda'),
  lat: DECIMAL(10,8),
  lng: DECIMAL(11,8),
  phone: TEXT,
  website: TEXT,
  status: TEXT ('active'),
  rating: DECIMAL(2,1),
  review_count: INTEGER,
  external_id: TEXT (unique)
}
```

## Output Stats

After running, you'll see:
```
=== Update Complete ===
Inserted: 45
Updated: 0
Skipped (duplicates): 5
Errors: 0
```

## Finding Google Maps URLs

### Method 1: Manual Search
1. Go to [Google Maps](https://www.google.com/maps)
2. Search: "pharmacies near Kigali, Rwanda"
3. Copy URL from address bar

### Method 2: Specific Area
1. Navigate to specific area on map
2. Click "Search this area" button
3. Enter "pharmacies"
4. Copy URL

### Method 3: From Your Example
Your URL for Kigali pharmacies:
```
https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z/data=!4m2!2m1!6e2?entry=ttu&g_ep=EgoyMDI1MTIwMi4wIKXMDSoASAFQAw%3D%3D
```

Coordinates: `-1.9857408, 30.1006848` (Kigali center)

## Expanding to Other Business Types

To scrape other businesses (restaurants, hotels, etc.):

1. **Change search URL**:
   ```bash
   python gmaps_scraper.py "https://www.google.com/maps/search/restaurants/@-1.9857408,30.1006848,15z"
   ```

2. **Update category** in script:
   ```python
   # Line ~340 in scrape_pharmacies()
   pharmacy['category'] = 'Restaurant'  # Change from 'Pharmacy'
   ```

Or add `--category` CLI argument:
```python
parser.add_argument('--category', default='Pharmacy', help='Business category')
# Then use: pharmacy['category'] = args.category
```

## Troubleshooting

### ChromeDriver Issues
```
selenium.common.exceptions.WebDriverException: 'chromedriver' executable needs to be in PATH
```

**Fix**: Install ChromeDriver (see Installation above) or use webdriver-manager.

### Supabase Permission Errors
```
supabase.exceptions.APIError: {"code":"42501","message":"permission denied"}
```

**Fix**: Make sure you're using `SUPABASE_SERVICE_ROLE_KEY`, not anon key. Service role bypasses RLS.

### No Businesses Found
```
Found 0 potential businesses
```

**Fix**: 
- Remove `--headless` to see browser
- URL might be malformed
- Google may have changed HTML structure (update CSS selectors)

### Rate Limiting
If scraping large batches (100+), add delays:
```python
time.sleep(random.uniform(2, 5))  # After each business
```

## Database Schema Reference

The script maps to this `businesses` table structure:

```sql
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  city TEXT,
  address TEXT,
  country TEXT DEFAULT 'Rwanda',
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  phone TEXT,
  website TEXT,
  email TEXT,
  status TEXT DEFAULT 'active',
  rating DECIMAL(2, 1) DEFAULT 0.0,
  review_count INTEGER DEFAULT 0,
  operating_hours JSONB,
  external_id TEXT UNIQUE,
  profile_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Security Notes

⚠️ **Never commit** `.env.scraper` or expose `SUPABASE_SERVICE_ROLE_KEY`  
⚠️ **Service role key** bypasses RLS - use only in trusted scripts  
⚠️ **Rate limit** your scraping to avoid IP bans from Google

## Future Enhancements

- [ ] Add `--update` mode to refresh existing businesses
- [ ] Parallel scraping with multiple workers
- [ ] Support for operating hours extraction
- [ ] Auto-detect city from coordinates (reverse geocoding)
- [ ] Email extraction from business pages
- [ ] Retry logic for failed inserts
- [ ] Progress bar for long scrapes

## Support

For issues:
1. Check migration `20251205213000_unify_business_registry.sql` is applied
2. Verify `businesses` table has all columns (external_id, lat, lng, etc.)
3. Test Supabase connection: `supabase db push`

## License

Part of EasyMO platform. See main project LICENSE.
