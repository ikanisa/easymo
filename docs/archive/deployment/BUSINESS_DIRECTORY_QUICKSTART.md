# Business Directory Quick Start

## 🎯 What Was Created

A comprehensive business directory system for storing and managing 8,000+ businesses from Rwanda.

## 📊 Database Table

**Table**: `business_directory`

Key fields:
- Business info: name, category, city, address
- Contact: phone, website, email
- Location: lat, lng, geospatial support
- Sales tracking: status (NEW/CONTACTED/QUALIFIED/DO_NOT_CALL)
- Quality: rating (0-5), review_count
- Metadata: source, import_batch_id, timestamps

**Indexes**:
- ✅ Category, city, status, rating
- ✅ Full-text search (name, category, address)
- ✅ Geospatial (PostGIS) for nearby searches

**Access**:
- 📖 Public read (authenticated + anonymous)
- ✏️ Service role write (for imports)

## 🚀 Setup & Import

### 1. Apply Migration

```bash
# Push to Supabase
supabase db push

# Or manually
psql $DATABASE_URL -f supabase/migrations/20251121153900_create_business_directory.sql
```

### 2. Configure Environment

```bash
# Supabase (required)
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Gemini API (optional - for Google Maps import)
export API_KEY="your-gemini-api-key"
```

### 3. Import Businesses

```bash
# Import from Google Maps via Gemini
node scripts/import-business-directory.mjs

# Or run in demo mode (no API key needed)
node scripts/import-business-directory.mjs
```

## 📍 Coverage

### Cities (10)
Kigali, Musanze, Rubavu/Gisenyi, Huye, Rwamagana, Muhanga, Nyanza, Rusizi, Karongi

### Categories (30+)
- **Food**: Restaurants, Cafes, Bars, Bakeries
- **Retail**: Supermarkets, Hardware, Electronics, Clothing
- **Services**: Banks, Pharmacies, Beauty Salons, Auto Repair
- **Professional**: Law, Accounting, Real Estate, Insurance
- **Healthcare**: Hospitals, Clinics
- **Education**: Schools, Universities

## 💻 Usage Examples

### Query via SQL

```sql
-- All restaurants in Kigali, ordered by rating
SELECT * FROM business_directory 
WHERE category = 'Restaurant' 
  AND city = 'Kigali' 
ORDER BY rating DESC;

-- Full-text search
SELECT * FROM business_directory 
WHERE to_tsvector('english', name || ' ' || category) 
  @@ to_tsquery('english', 'pharmacy');

-- New leads (not yet contacted)
SELECT * FROM business_directory 
WHERE status = 'NEW' 
LIMIT 100;
```

### Query via Supabase Client

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get top-rated cafes in Kigali
const { data } = await supabase
  .from('business_directory')
  .select('*')
  .eq('category', 'Cafe')
  .eq('city', 'Kigali')
  .gte('rating', 4.0)
  .order('rating', { ascending: false });

// Search by text
const { data: results } = await supabase
  .from('business_directory')
  .select('*')
  .textSearch('name', 'coffee');

// Update status after contact
await supabase
  .from('business_directory')
  .update({ 
    status: 'CONTACTED',
    notes: 'Called on 2025-11-21, interested'
  })
  .eq('id', businessId);
```

### Query via Edge Function

```typescript
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
);

const { data: prospects } = await supabaseClient
  .from('business_directory')
  .select('name, phone, category, city')
  .eq('status', 'NEW')
  .not('phone', 'is', null)
  .limit(50);
```

## 🔍 Monitoring

### Check Import Status

```sql
-- Count by source
SELECT source, COUNT(*), AVG(rating)::DECIMAL(3,2) as avg_rating
FROM business_directory
GROUP BY source;

-- Count by city and category
SELECT city, category, COUNT(*) as count
FROM business_directory
GROUP BY city, category
ORDER BY count DESC
LIMIT 20;

-- Recent imports
SELECT import_batch_id, COUNT(*), MIN(imported_at), MAX(imported_at)
FROM business_directory
GROUP BY import_batch_id
ORDER BY MAX(imported_at) DESC;
```

### Data Quality

```sql
-- Missing phone numbers
SELECT COUNT(*) FROM business_directory WHERE phone IS NULL;

-- Missing coordinates
SELECT COUNT(*) FROM business_directory WHERE lat IS NULL OR lng IS NULL;

-- Potential duplicates
SELECT name, city, COUNT(*)
FROM business_directory
GROUP BY name, city
HAVING COUNT(*) > 1;
```

## 🔄 Integration with easyMOAI

The `BusinessDirectory.tsx` component from easyMOAI can now use Supabase:

```typescript
// Before: Direct Gemini API
const results = await searchLocalBusinesses(query, city);

// After: Supabase cache + Gemini fallback
const { data: cached } = await supabase
  .from('business_directory')
  .select('*')
  .textSearch('name', query)
  .eq('city', city);

if (!cached?.length) {
  // Fallback to Gemini for fresh data
  const fresh = await searchLocalBusinesses(query, city);
  // Store for future use
  await supabase.from('business_directory').insert(fresh);
}
```

## 📈 Expected Scale

- **Target**: 8,000+ businesses
- **Cities**: 10 major cities
- **Categories**: 30+ categories
- **Growth**: ~1,000/month
- **Performance**: Indexed for fast queries (<100ms)

## 🛠️ Maintenance

### Refresh Data

```bash
# Re-run import to update existing businesses
node scripts/import-business-directory.mjs

# Schedule via cron (weekly refresh)
0 0 * * 0 cd /path/to/easymo- && node scripts/import-business-directory.mjs
```

### Cleanup

```sql
-- Remove duplicates (keep best rated)
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

## 📚 Documentation

Full documentation: [docs/BUSINESS_DIRECTORY_SETUP.md](docs/BUSINESS_DIRECTORY_SETUP.md)

Covers:
- Detailed schema reference
- Import strategies
- Query examples
- Performance optimization
- Troubleshooting guide
- Future enhancements

## ✅ Next Steps

1. **Push migration**: `supabase db push`
2. **Run import**: `node scripts/import-business-directory.mjs`
3. **Verify**: Check Supabase dashboard
4. **Integrate**: Update components to use Supabase
5. **Monitor**: Track import batches and data quality

---

**Created**: 2025-11-21  
**Status**: Ready to use  
**Migration**: 20251121153900_create_business_directory.sql
