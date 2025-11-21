# Business Directory Setup Guide

## Overview

The Business Directory is a comprehensive database of businesses in Rwanda, imported from easyMOAI and enriched with Google Maps data via Gemini API.

## Database Schema

### Table: `business_directory`

```sql
- id: UUID (Primary Key)
- external_id: TEXT (Unique - from source system)
- name: TEXT (Business name)
- category: TEXT (Business category)
- city: TEXT (City name)
- address: TEXT (Full address)
- country: TEXT (Default: 'Rwanda')
- lat: DECIMAL (Latitude)
- lng: DECIMAL (Longitude)
- phone: TEXT (Phone number)
- website: TEXT (Website URL)
- email: TEXT (Email address)
- status: TEXT (NEW | CONTACTED | QUALIFIED | DO_NOT_CALL)
- rating: DECIMAL (0-5)
- review_count: INTEGER
- notes: TEXT
- google_maps_url: TEXT
- place_id: TEXT (Google Place ID)
- business_type: TEXT
- operating_hours: JSONB
- last_checked: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
- source: TEXT (e.g., 'easymoai')
- import_batch_id: UUID
- imported_at: TIMESTAMPTZ
```

### Indexes

- Category, city, status, rating
- Full-text search on name, category, address
- Geospatial index (if PostGIS enabled)

### RLS Policies

- **Read**: Public access (authenticated + anon)
- **Write**: Service role only (for imports)

## Setup Instructions

### 1. Apply Migration

```bash
# Apply the migration to create the table
supabase db push

# Or apply specific migration
psql $DATABASE_URL -f supabase/migrations/20251121153900_create_business_directory.sql
```

### 2. Configure Environment

```bash
# Required for Supabase
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Required for Google Maps/Gemini API
export API_KEY="your-gemini-api-key"
# or
export GEMINI_API_KEY="your-gemini-api-key"
```

### 3. Run Import

```bash
# Import businesses from Google Maps via Gemini
node scripts/import-business-directory.mjs

# This will:
# - Search for businesses across Rwanda cities
# - Import data from Google Maps
# - Store in business_directory table
```

## Import Strategy

### Cities Covered

- Kigali (Primary)
- Musanze
- Rubavu / Gisenyi
- Huye
- Rwamagana
- Muhanga
- Nyanza
- Rusizi
- Karongi

### Categories (30+)

Core categories include:
- Food & Dining: Restaurants, Cafes, Bars, Bakeries
- Retail: Supermarkets, Hardware, Electronics, Clothing
- Services: Banks, Pharmacies, Beauty Salons, Auto Repair
- Professional: Law Firms, Accounting, Real Estate, Insurance
- Education: Schools, Universities
- Healthcare: Hospitals, Clinics, Pharmacies
- Hospitality: Hotels, Guest Houses

### Data Sources

1. **Google Maps via Gemini API** (Primary)
   - Real-time business data
   - Verified phone numbers, addresses
   - Ratings and reviews
   - Geolocation coordinates

2. **Manual Imports** (Secondary)
   - CSV uploads
   - API integrations
   - Partner data

## Usage

### Query Businesses

```sql
-- Search by category
SELECT * FROM business_directory 
WHERE category = 'Restaurant' 
ORDER BY rating DESC;

-- Search by city
SELECT * FROM business_directory 
WHERE city = 'Kigali' 
AND status = 'NEW';

-- Full-text search
SELECT * FROM business_directory 
WHERE to_tsvector('english', name || ' ' || category || ' ' || address) 
@@ to_tsquery('english', 'pharmacy');

-- Nearby businesses (with PostGIS)
SELECT * FROM business_directory 
WHERE ST_DWithin(
  location, 
  ST_SetSRID(ST_MakePoint(30.0619, -1.9536), 4326)::geography,
  5000  -- 5km radius
)
ORDER BY rating DESC;
```

### Via Supabase Client

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get all restaurants in Kigali
const { data, error } = await supabase
  .from('business_directory')
  .select('*')
  .eq('category', 'Restaurant')
  .eq('city', 'Kigali')
  .order('rating', { ascending: false });

// Search businesses
const { data: results } = await supabase
  .from('business_directory')
  .select('*')
  .textSearch('name', 'coffee', { type: 'websearch' });

// Update business status
const { error } = await supabase
  .from('business_directory')
  .update({ status: 'CONTACTED', notes: 'Called on 2025-11-21' })
  .eq('id', businessId);
```

### Via Edge Function

```typescript
// In your edge function
import { createClient } from '@supabase/supabase-js';

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const { data: businesses } = await supabaseClient
  .from('business_directory')
  .select('*')
  .eq('status', 'NEW')
  .limit(100);
```

## Integration with easyMOAI

### Components

The `BusinessDirectory.tsx` component from easyMOAI:
- Provides UI for searching businesses
- Uses Gemini API for real-time search
- Can be integrated with Supabase backend

### Migration Path

```typescript
// Before (easyMOAI): Direct Gemini API calls
const results = await searchLocalBusinesses(query, city);

// After (easymo-): Supabase with fallback to Gemini
const { data: cachedResults } = await supabase
  .from('business_directory')
  .select('*')
  .textSearch('name', query);

if (!cachedResults?.length) {
  // Fallback to Gemini for fresh data
  const freshResults = await searchLocalBusinesses(query, city);
  // Import to database for future use
  await importBusinesses(freshResults);
}
```

## Data Quality

### Validation

Businesses are validated for:
- ✅ Name (required)
- ✅ Category (required)
- ✅ City (required)
- ✅ Address (required)
- ✅ Phone (if available)
- ✅ Coordinates (lat/lng)
- ✅ Rating (0-5 range)

### Deduplication

Handled via `external_id` (unique constraint):
- Uses Google Place ID when available
- Falls back to name + city slug
- Upsert strategy on conflicts

### Updates

```sql
-- Businesses are refreshed via update trigger
-- updated_at is automatically set
UPDATE business_directory 
SET rating = 4.5, review_count = 120
WHERE external_id = 'place-id-xyz';
```

## Performance

### Expected Scale

- **Target**: 8,000+ businesses
- **Cities**: 10 major cities
- **Categories**: 30+ categories
- **Growth**: ~1,000 businesses/month

### Optimization

- Indexed columns for fast queries
- Full-text search for text queries
- GiST index for location queries
- Partitioning (future): By city/region

## Monitoring

### Check Import Status

```sql
-- Count by batch
SELECT import_batch_id, COUNT(*), MIN(imported_at), MAX(imported_at)
FROM business_directory
GROUP BY import_batch_id
ORDER BY MAX(imported_at) DESC;

-- Count by source
SELECT source, COUNT(*), AVG(rating)
FROM business_directory
GROUP BY source;

-- Count by city and category
SELECT city, category, COUNT(*)
FROM business_directory
GROUP BY city, category
ORDER BY COUNT(*) DESC;
```

### Data Quality Checks

```sql
-- Missing phone numbers
SELECT COUNT(*) FROM business_directory WHERE phone IS NULL;

-- Missing coordinates
SELECT COUNT(*) FROM business_directory WHERE lat IS NULL OR lng IS NULL;

-- Low ratings (need verification)
SELECT * FROM business_directory WHERE rating < 2.0;

-- Duplicate names (potential duplicates)
SELECT name, city, COUNT(*)
FROM business_directory
GROUP BY name, city
HAVING COUNT(*) > 1;
```

## Maintenance

### Refresh Data

```bash
# Re-run import to update existing businesses
node scripts/import-business-directory.mjs

# Or schedule via cron
0 0 * * 0 cd /path/to/easymo- && node scripts/import-business-directory.mjs
```

### Cleanup Old Data

```sql
-- Archive old batches
DELETE FROM business_directory 
WHERE imported_at < NOW() - INTERVAL '6 months'
AND source = 'manual';

-- Remove duplicates (keep highest rated)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY name, city 
    ORDER BY rating DESC, imported_at DESC
  ) as rn
  FROM business_directory
)
DELETE FROM business_directory
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
```

## Troubleshooting

### Import Fails

**Issue**: Script errors or no data

**Solutions**:
1. Check API key is set: `echo $GEMINI_API_KEY`
2. Check Supabase connection: `echo $SUPABASE_SERVICE_ROLE_KEY`
3. Run in demo mode first (without API key)
4. Check rate limits on Gemini API

### No Businesses Found

**Issue**: Search returns empty results

**Solutions**:
1. Verify table exists: `SELECT COUNT(*) FROM business_directory`
2. Check RLS policies: Ensure read access enabled
3. Verify import ran: `SELECT COUNT(*) FROM business_directory`
4. Check query filters (city, category)

### Performance Issues

**Issue**: Slow queries

**Solutions**:
1. Ensure indexes exist: `\d business_directory`
2. Use specific filters (category, city)
3. Limit results: `.limit(100)`
4. Enable query caching

## Future Enhancements

- [ ] Real-time sync with Google Maps
- [ ] Business verification workflow
- [ ] Owner claimed listings
- [ ] Reviews and ratings system
- [ ] Analytics dashboard
- [ ] Export to CSV/Excel
- [ ] API endpoints for external access
- [ ] WhatsApp integration for lead generation

---

**Last Updated**: 2025-11-21  
**Schema Version**: 1.0  
**Import Script**: scripts/import-business-directory.mjs
