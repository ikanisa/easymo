# Google Maps Scraper - Deployment Checklist

## Pre-Deployment Verification ✅

- [x] All Python scripts created and validated
- [x] Unit tests passing (100% success rate)
- [x] Python syntax validated
- [x] Code review feedback addressed
- [x] Documentation complete
- [x] .gitignore properly configured
- [x] All constants and imports properly organized

## Deployment Steps

### 1. Install Dependencies

```bash
# Navigate to repository
cd /path/to/easymo

# Install Python dependencies
pip3 install -r scripts/requirements-scraper.txt

# Install Playwright browsers
playwright install chromium

# Verify installation
python3 scripts/test_scraper.py
```

**Expected output:** All tests should pass ✅

### 2. Configure Environment

Create a `.env` file or export environment variables:

```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Security Note:** Never commit the `.env` file to git!

### 3. Verify Database Schema

Ensure the `businesses` table exists with the correct schema:

```sql
-- Run this query in Supabase SQL Editor
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'businesses'
ORDER BY ordinal_position;
```

**Required columns:**
- id (uuid)
- name (text)
- category (text)
- address (text)
- phone (text)
- website (text)
- lat (numeric)
- lng (numeric)
- rating (numeric)
- review_count (integer)
- external_id (text, unique)
- status (text)
- city (text)
- country (text)
- created_at (timestamp)

### 4. Test with Dry Run

```bash
# Test without database writes
python3 scripts/google_maps_bulk_scraper.py \
  --categories "pharmacy" \
  --per-category-limit 3 \
  --dry-run
```

**Expected output:**
- Browser launches successfully
- Google Maps search works
- Data extraction completes
- Progress saved to checkpoint
- JSON output created

### 5. Test with Small Batch

```bash
# Test with real database writes (limited scope)
python3 scripts/google_maps_bulk_scraper.py \
  --categories "pharmacy,restaurant" \
  --per-category-limit 10
```

**Verify:**
- [ ] Businesses inserted into database
- [ ] No duplicate entries created
- [ ] Data looks correct (coordinates, phones, etc.)
- [ ] Checkpoint file created
- [ ] Summary report generated

### 6. Monitor First Run

```bash
# Check database
SELECT COUNT(*), category 
FROM businesses 
WHERE city = 'Kigali' 
GROUP BY category;

# Check for duplicates
SELECT external_id, COUNT(*) 
FROM businesses 
WHERE external_id IS NOT NULL 
GROUP BY external_id 
HAVING COUNT(*) > 1;
```

**Expected:** No duplicate external_ids

### 7. Full Production Run

```bash
# Run full scrape (all 48 categories)
nohup python3 scripts/google_maps_bulk_scraper.py \
  --output /path/to/backup/businesses_kigali.json \
  > scraper.log 2>&1 &

# Monitor progress
tail -f scraper.log
```

**Estimated time:** 4-8 hours

## Monitoring During Execution

### Check Progress

```bash
# View checkpoint
cat scripts/scraper_checkpoint.json | jq '.stats'

# Count total businesses scraped
cat scripts/scraper_checkpoint.json | jq '.businesses_found | length'

# See which categories are done
cat scripts/scraper_checkpoint.json | jq '.categories_processed'
```

### Database Checks

```sql
-- Total businesses in Kigali
SELECT COUNT(*) FROM businesses WHERE city = 'Kigali';

-- By category
SELECT category, COUNT(*) as count 
FROM businesses 
WHERE city = 'Kigali' 
GROUP BY category 
ORDER BY count DESC;

-- Recent additions
SELECT name, category, created_at 
FROM businesses 
WHERE city = 'Kigali' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Troubleshooting

### Rate Limited by Google

**Symptoms:** Repeated network errors, empty results

**Solution:**
1. Stop the scraper (Ctrl+C)
2. Wait 30-60 minutes
3. Resume with `--resume` flag:
   ```bash
   python3 scripts/google_maps_bulk_scraper.py --resume
   ```

### Browser Installation Issues

**Symptoms:** Browser not found errors

**Solution:**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y libnss3 libnspr4 libatk1.0-0 \
  libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2

# Reinstall browsers
playwright install chromium
```

### Network Connectivity Issues

**Symptoms:** DNS resolution failures

**Solution:**
1. Check internet connection
2. Verify Google Maps is accessible:
   ```bash
   curl -I https://www.google.com/maps
   ```
3. Check for proxy/firewall blocking

### Database Connection Issues

**Symptoms:** Supabase connection errors

**Solution:**
1. Verify environment variables:
   ```bash
   echo $SUPABASE_URL
   echo ${SUPABASE_SERVICE_ROLE_KEY:0:10}...
   ```
2. Test connection:
   ```python
   from supabase import create_client
   import os
   client = create_client(
       os.getenv('SUPABASE_URL'),
       os.getenv('SUPABASE_SERVICE_ROLE_KEY')
   )
   result = client.table('businesses').select('id').limit(1).execute()
   print(result)
   ```

## Post-Deployment Validation

### Data Quality Checks

```sql
-- Check for missing coordinates
SELECT COUNT(*) 
FROM businesses 
WHERE city = 'Kigali' 
AND (lat IS NULL OR lng IS NULL);

-- Check for missing phones
SELECT COUNT(*) 
FROM businesses 
WHERE city = 'Kigali' 
AND phone IS NULL;

-- Check coordinate validity (Kigali bounds)
-- Latitude: -2.0 to -1.9
-- Longitude: 29.9 to 30.2
SELECT COUNT(*) 
FROM businesses 
WHERE city = 'Kigali' 
AND (lat < -2.0 OR lat > -1.9 OR lng < 29.9 OR lng > 30.2);
```

### Generate Final Report

```bash
# View final summary
cat scripts/scraping_report_*.txt | tail -20

# Check total businesses
cat scripts/businesses_kigali.json | jq '. | length'
```

## Success Criteria

- [ ] ~10,000 businesses scraped across 48 categories
- [ ] <5% duplicate rate
- [ ] >80% with coordinates
- [ ] >60% with phone numbers
- [ ] All categories represented
- [ ] No database errors
- [ ] Summary report generated

## Cleanup

After successful completion:

```bash
# Backup artifacts
mkdir -p /backup/scraper_$(date +%Y%m%d)
cp scripts/businesses_kigali.json /backup/scraper_$(date +%Y%m%d)/
cp scripts/scraping_report_*.txt /backup/scraper_$(date +%Y%m%d)/

# Clean up checkpoint (already auto-deleted on success)
# rm scripts/scraper_checkpoint.json  # If needed
```

## Maintenance

### Re-run for Updates

To update existing data:

```bash
# Run again - will update existing businesses via external_id
python3 scripts/google_maps_bulk_scraper.py \
  --output businesses_kigali_update_$(date +%Y%m%d).json
```

### Add New Categories

1. Edit `scripts/kigali_categories.json`
2. Add new categories to the array
3. Run scraper with new categories:
   ```bash
   python3 scripts/google_maps_bulk_scraper.py \
     --categories "new_category1,new_category2"
   ```

## Support

For issues or questions:
- Check `scripts/README_SCRAPER.md` for documentation
- Review `SCRAPER_IMPLEMENTATION_SUMMARY.md` for implementation details
- Check unit tests in `scripts/test_scraper.py`

## Notes

- The scraper respects Google's rate limits
- Random delays (2-4 seconds) prevent detection
- Checkpoint system allows resuming interrupted runs
- All data is backed up to JSON file
- Database operations use batch upserts for efficiency
