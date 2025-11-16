# Source URL Tables & Daily Scraper Implementation

## Overview

Created infrastructure for automated daily scraping of job and property listings from curated source URLs. The system will populate `job_listings` and `property_listings` tables automatically.

## Database Tables Created

### 1. `job_source_urls` Table
Stores URLs for job listing websites to scrape.

**Schema**:
- `id` - UUID primary key
- `name` - Human-readable name
- `url` - Source URL (unique)
- `country_code` - Country (RW, MT, etc.)
- `is_active` - Enable/disable scraping
- `scrape_frequency_hours` - How often to scrape (default: 24)
- `last_scraped_at` - Last scrape timestamp
- `last_success_at` - Last successful scrape
- `total_scrapes` - Total scrape count
- `total_jobs_found` - Total jobs discovered
- `last_error` - Last error message
- `metadata` - Additional JSON data
- `created_at`, `updated_at` - Timestamps

**Data Loaded**:
- **Rwanda (RW)**: 20 sources
  - Job in Rwanda, RwandaJob, JobWeb Rwanda, Great Rwanda Jobs
  - AfriCareers, Kora Job Portal, New Times Job-Market
  - LinkedIn, Facebook Marketplace, Indeed, Glassdoor
  - Umurimo, MIFOTRA, BrighterMonday, Summit Recruitment
  - Q-Sourcing, CareerJet, ReliefWeb, Devex, UN Jobs

- **Malta (MT)**: 18 sources
  - JobsPlus, JobsInMalta, Keepmeposted, Maltapark Jobs
  - MaltaJobPort, VacancyCentre, Konnekt, JobsFactor
  - JobHound, Alfred Jobs, Jobsrar, TopJobsMalta
  - Glassdoor, CareerJet, Times of Malta, Monster
  - LinkedIn, Facebook Marketplace

### 2. `property_source_urls` Table
Stores URLs for property listing websites to scrape.

**Schema**: Same as `job_source_urls` but for properties

**Data Loaded**:
- **Rwanda (RW)**: 20 sources
  - House in Rwanda, HomeRwanda, Abahuza
  - Century Real Estate, Vibe House, Premier Real Estate
  - Plut Properties, Quick Homes, Kwanda, Elimo, Marchal
  - Facebook Marketplace, Homeland, Deluxe Properties
  - Mucuruzi, Expat.com, Airbnb, Imara, Vision City, RSSB

- **Malta (MT)**: 19 sources
  - PropertyMarket, Indomio, Maltapark Property, Yitaku
  - RE/MAX, Frank Salt, Dhalia, QuickLets, Zanzi Homes
  - Alliance, Century 21, Sara Grech, Malta Sotheby's
  - Belair, Rightmove, A Place in the Sun
  - Times of Malta, Expat.com, Airbnb, Facebook Marketplace

## Helper Functions Created

### 1. `get_job_sources_to_scrape(hours_threshold)`
Returns job sources that need scraping (last scraped > threshold or never scraped).
```sql
SELECT * FROM get_job_sources_to_scrape(24); -- Get sources not scraped in 24h
```

### 2. `get_property_sources_to_scrape(hours_threshold)`
Returns property sources that need scraping.
```sql
SELECT * FROM get_property_sources_to_scrape(24);
```

### 3. `update_job_source_scrape_stats(source_id, jobs_found, error)`
Updates scraping statistics after each attempt.
```sql
SELECT update_job_source_scrape_stats(
  'uuid-here'::uuid,
  15,  -- found 15 new jobs
  NULL -- no error
);
```

### 4. `update_property_source_scrape_stats(source_id, properties_found, error)`
Updates property scraping statistics.

## Edge Function: `source-url-scraper`

### Purpose
Daily automated scraping of job and property sources to populate listings tables.

### Endpoint
```
POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/source-url-scraper
```

### Request Body
```json
{
  "type": "both",           // "jobs" | "properties" | "both"
  "country_code": "RW",     // Optional: filter by country
  "limit": 10               // Max sources to scrape per run
}
```

### Response
```json
{
  "success": true,
  "results": {
    "jobs": {
      "scraped": 5,
      "new_listings": 120,
      "errors": 0
    },
    "properties": {
      "scraped": 5,
      "new_listings": 85,
      "errors": 0
    }
  },
  "timestamp": "2025-11-15T19:00:00Z"
}
```

### How It Works

1. **Fetch Sources**: Calls `get_{type}_sources_to_scrape()` to get sources needing updates
2. **Scrape Each Source**: For each source:
   - Triggers OpenAI deep research (or custom scraper)
   - Extracts structured listing data
   - Inserts into `job_listings` or `property_listings` (avoiding duplicates)
3. **Update Stats**: Calls `update_{type}_source_scrape_stats()` with results
4. **Return Summary**: Returns counts of scraped sources and new listings

## Cron Job Configuration

### Schedule
**Daily at 2 AM UTC** (automatically runs every 24 hours)

### Cron Entry
```sql
SELECT cron.schedule(
  'daily-source-scraper',
  '0 2 * * *',
  $$ 
  SELECT net.http_post(
    url:='https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/source-url-scraper',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ..."}'::jsonb,
    body:='{"type": "both", "limit": 10}'::jsonb
  );
  $$
);
```

### Manual Trigger
You can manually trigger a scrape anytime:
```bash
curl -X POST \
  https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/source-url-scraper \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{"type": "both", "limit": 5}'
```

## Duplicate Prevention

The system automatically handles duplicates:

1. **Database Level**: `ON CONFLICT` clauses in insert statements
2. **URL Uniqueness**: Source URLs are unique constraints
3. **Listing Deduplication**: Based on title + company/location hash (if implemented)

## Monitoring & Stats

### Check Source Status
```sql
-- View all sources and their scrape status
SELECT 
  name,
  url,
  country_code,
  last_scraped_at,
  total_scrapes,
  total_jobs_found,
  last_error
FROM job_source_urls
WHERE is_active = true
ORDER BY last_scraped_at ASC NULLS FIRST;
```

### Check Scraping History
```sql
-- Sources that haven't been scraped yet
SELECT name, url, country_code
FROM job_source_urls
WHERE last_scraped_at IS NULL;

-- Sources with errors
SELECT name, url, last_error, last_scraped_at
FROM job_source_urls
WHERE last_error IS NOT NULL
ORDER BY last_scraped_at DESC;
```

### Verify Listings
```sql
-- Count listings by source
SELECT 
  source_name,
  country_code,
  count(*) as total_listings,
  count(*) FILTER (WHERE created_at > now() - interval '24 hours') as new_today
FROM job_listings
GROUP BY source_name, country_code
ORDER BY total_listings DESC;
```

## Enhancing the Scraper

The current implementation uses OpenAI deep research. To add custom scrapers:

1. **Add Custom Parser**: Create parser for specific website
   ```typescript
   async function scrapeJobsInMalta(source: any): Promise<any[]> {
     const response = await fetch(source.url);
     const html = await response.text();
     // Parse HTML and extract listings
     return parsedListings;
   }
   ```

2. **Update Routing**: Add to scraping logic
   ```typescript
   if (source.name === 'JobsInMalta') {
     listings = await scrapeJobsInMalta(source);
   } else {
     // Fallback to OpenAI deep research
     listings = await scrapeJobListings(source);
   }
   ```

3. **Deploy**: `supabase functions deploy source-url-scraper`

## Adding New Sources

### Add Job Source
```sql
INSERT INTO job_source_urls (name, url, country_code)
VALUES ('New Job Board', 'https://newjobboard.com', 'RW');
```

### Add Property Source
```sql
INSERT INTO property_source_urls (name, url, country_code)
VALUES ('New Property Portal', 'https://newpropertyportal.com', 'RW');
```

### Deactivate Source
```sql
UPDATE job_source_urls 
SET is_active = false 
WHERE url = 'https://old-site.com';
```

## Performance Optimization

### Adjust Scrape Frequency
```sql
-- Scrape high-traffic sources more frequently
UPDATE job_source_urls
SET scrape_frequency_hours = 12
WHERE name IN ('JobsPlus', 'Job in Rwanda');

-- Scrape low-traffic sources less frequently
UPDATE property_source_urls
SET scrape_frequency_hours = 48
WHERE total_properties_found < 10;
```

### Adjust Batch Size
Change `limit` parameter in cron job or manual calls:
```json
{"type": "both", "limit": 20}  // Scrape 20 sources per run
```

## Testing

### Test Single Source
```bash
curl -X POST \
  https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/source-url-scraper \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"type": "jobs", "country_code": "RW", "limit": 1}'
```

### Test Jobs Only
```bash
curl -X POST ... -d '{"type": "jobs", "limit": 5}'
```

### Test Properties Only
```bash
curl -X POST ... -d '{"type": "properties", "limit": 5}'
```

## Files Created

1. **Migration**: `supabase/migrations/20251115190000_create_source_url_tables.sql`
   - Creates tables
   - Inserts source URLs (77 total sources)
   - Creates helper functions
   - Sets up RLS policies

2. **Edge Function**: `supabase/functions/source-url-scraper/index.ts`
   - Scraping orchestrator
   - Handles both jobs and properties
   - Updates statistics
   - Error handling

## Summary Statistics

- **Total Sources**: 77
  - Job Sources: 38 (18 MT + 20 RW)
  - Property Sources: 39 (19 MT + 20 RW)
  
- **Scraping Schedule**: Daily at 2 AM UTC
- **Batch Size**: 10 sources per type per run
- **Expected Daily Coverage**: 20 sources (10 jobs + 10 properties)
- **Full Cycle**: ~4 days to scrape all sources (will adjust based on activity)

## Next Steps

1. ✅ Tables created and populated
2. ✅ Scraper function deployed
3. ✅ Cron job scheduled
4. ⏳ Monitor first automated run (tomorrow at 2 AM UTC)
5. ⏳ Add custom scrapers for high-priority sources
6. ⏳ Tune frequency based on listing volume
7. ⏳ Add alerting for scraping failures

## Maintenance

- **Weekly**: Review error logs and fix failing sources
- **Monthly**: Verify source URLs are still valid
- **Quarterly**: Add new sources, remove dead ones
- **As Needed**: Adjust scrape frequency based on usage

The system is now fully operational and will automatically populate job and property listings daily! 🎉
