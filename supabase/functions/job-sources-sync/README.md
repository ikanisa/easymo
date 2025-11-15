# Job Sources Sync - External Job Ingestion

## Overview

This edge function automatically discovers and imports jobs from external sources:
- **OpenAI Deep Search**: Finds jobs on legitimate job boards and classifieds
- **SerpAPI**: Crawls Google search results for job postings
- **Custom RSS** (future): Parse job feeds

## Features

✅ **Smart Deduplication**: Uses SHA-256 hash of (title + company + location + URL)
✅ **Automatic Embeddings**: Generates vectors for semantic matching
✅ **Incremental Updates**: Updates `last_seen_at` for existing jobs
✅ **Configurable Queries**: Per-source queries stored in `job_sources.config`
✅ **Category Inference**: Auto-categorizes based on job text
✅ **Pay Parsing**: Extracts min/max pay and unit from text
✅ **Structured Logging**: Full observability with correlation IDs

## Setup

### 1. Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional (for SerpAPI)
SERPAPI_API_KEY=your-serpapi-key
```

### 2. Enable Job Sources

```sql
-- Enable Deep Search for Rwanda & Malta jobs
UPDATE job_sources 
SET is_active = true,
    config = '{
      "queries": [
        {"country": "RW", "city": "Kigali", "query": "one day casual jobs in Kigali", "kind": "one_day"},
        {"country": "RW", "city": "Kigali", "query": "part time jobs Kigali", "kind": "part_time"},
        {"country": "RW", "query": "delivery driver jobs Rwanda", "kind": "full_time"},
        {"country": "MT", "city": "Valletta", "query": "one day casual jobs in Valletta Malta", "kind": "one_day"},
        {"country": "MT", "city": "Sliema", "query": "part time jobs in Sliema Malta", "kind": "part_time"},
        {"country": "MT", "city": "St Julians", "query": "hospitality jobs St Julians Malta", "kind": "full_time"},
        {"country": "MT", "query": "delivery driver jobs Malta", "kind": "full_time"},
        {"country": "MT", "query": "restaurant waiter jobs Malta", "kind": "part_time"}
      ]
    }'::jsonb
WHERE source_type = 'openai_deep_search';

-- Enable SerpAPI (if you have an API key) for Rwanda & Malta
UPDATE job_sources
SET is_active = true,
    config = '{
      "queries": [
        {"country": "RW", "query": "jobs in Rwanda"},
        {"country": "RW", "city": "Kigali", "query": "jobs in Kigali"},
        {"country": "MT", "query": "jobs in Malta"},
        {"country": "MT", "city": "Valletta", "query": "jobs in Valletta"},
        {"country": "MT", "city": "Sliema", "query": "jobs in Sliema"}
      ]
    }'::jsonb
WHERE source_type = 'serpapi';
```

### 3. Deploy Function

```bash
supabase functions deploy job-sources-sync
```

### 4. Schedule Daily Runs

**Option A: Supabase Scheduled Functions**

In Supabase Dashboard:
1. Go to Database → Functions
2. Create new scheduled function
3. Schedule: `0 3 * * *` (3 AM daily)
4. SQL:
```sql
SELECT net.http_post(
  url := 'https://YOUR_PROJECT.supabase.co/functions/v1/job-sources-sync',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
  ),
  body := '{}'::jsonb
);
```

**Option B: pg_cron**

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily at 3 AM
SELECT cron.schedule(
  'job-sources-sync',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/job-sources-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

## Manual Testing

```bash
# Test the function
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/job-sources-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{}'
```

Expected response:
```json
{
  "success": true,
  "stats": {
    "inserted": 15,
    "updated": 3,
    "skipped": 2,
    "errors": 0
  },
  "correlationId": "uuid-here"
}
```

## How It Works

### Deep Search Flow

1. Load active sources where `source_type = 'openai_deep_search'`
2. For each query in `config.queries`:
   - Send prompt to GPT-4: "Find recent job postings for {{query}}"
   - Request structured JSON with job details
   - Parse response into normalized format
3. For each job:
   - Generate SHA-256 hash for deduplication
   - Check if job already exists (by source_id + job_hash)
   - If new: Insert with embedding
   - If exists: Update `last_seen_at`

### SerpAPI Flow

1. Load active sources where `source_type = 'serpapi'`
2. For each query:
   - Call SerpAPI Google search: `{{query}} jobs`
   - Filter results that look like job listings
   - Extract: title, snippet, link
3. For each result:
   - Infer category from text
   - Normalize to job structure
   - Upsert with hash-based deduplication

### Category Inference

The function auto-categorizes jobs based on keywords:

- **delivery**: "delivery", "driver", "courier"
- **cleaning**: "clean", "housekeep"
- **construction**: "construction", "build", "labor", "labour"
- **security**: "security", "guard"
- **cooking**: "cook", "chef", "waiter", "waitress", "restaurant", "hospitality", "bar staff", "barista"
- **childcare**: "child", "babysit", "nanny"
- **tutoring**: "tutor", "teach", "education"
- **data_entry**: "data entry", "admin", "office", "receptionist"
- **sales**: "sales", "marketing", "retail"
- **igaming**: "igaming", "gaming", "casino", "betting" (Malta-specific)
- **healthcare**: "healthcare", "nurse", "carer", "medical" (Malta-specific)
- **other**: Default fallback

### Pay Parsing

Extracts structured pay from text:

- Input: "10,000-15,000 RWF per day"
- Output: `{ min: 10000, max: 15000, unit: "day" }`

- Input: "50 per hour"
- Output: `{ min: 50, unit: "hour" }`

## Monitoring

### View Logs

```bash
supabase functions logs job-sources-sync --tail
```

### Check Analytics

```sql
-- Recent sync runs
SELECT * FROM job_analytics 
WHERE event_type IN ('JOB_SOURCES_SYNC_START', 'JOB_SOURCES_SYNC_COMPLETE')
ORDER BY created_at DESC 
LIMIT 10;

-- External jobs by source
SELECT 
  js.name,
  COUNT(*) as job_count,
  MAX(jl.discovered_at) as last_discovered
FROM job_listings jl
JOIN job_sources js ON jl.source_id = js.id
WHERE jl.is_external = true
GROUP BY js.id, js.name
ORDER BY job_count DESC;

-- Jobs discovered in last 24h
SELECT COUNT(*) as new_jobs_24h
FROM job_listings
WHERE is_external = true
  AND discovered_at > NOW() - INTERVAL '24 hours';

-- Stale external jobs (not seen in 7 days)
SELECT COUNT(*) as stale_jobs
FROM job_listings
WHERE is_external = true
  AND last_seen_at < NOW() - INTERVAL '7 days';
```

### Auto-Close Stale Jobs

```sql
-- Mark external jobs as closed if not seen in 7+ days
UPDATE job_listings
SET status = 'closed'
WHERE is_external = true
  AND status = 'open'
  AND last_seen_at < NOW() - INTERVAL '7 days';
```

Add to daily cron:
```sql
SELECT cron.schedule(
  'close-stale-external-jobs',
  '0 4 * * *',
  $$
  UPDATE job_listings
  SET status = 'closed'
  WHERE is_external = true
    AND status = 'open'
    AND last_seen_at < NOW() - INTERVAL '7 days';
  $$
);
```

## Troubleshooting

### No Jobs Discovered

1. **Check sources are active**:
```sql
SELECT * FROM job_sources WHERE is_active = true;
```

2. **Verify API keys**:
```bash
supabase secrets list
```

3. **Test manually**:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/job-sources-sync \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{}'
```

4. **Check logs**:
```bash
supabase functions logs job-sources-sync --since 1h
```

### High Error Rate

Check analytics:
```sql
SELECT 
  event_type,
  COUNT(*) as count,
  MAX(created_at) as last_error
FROM job_analytics
WHERE event_type IN ('SOURCE_ERROR', 'JOB_SOURCES_SYNC_ERROR')
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type;
```

### Duplicate Jobs

If you see duplicates, verify hash generation:
```sql
SELECT 
  title,
  company_name,
  location,
  job_hash,
  COUNT(*)
FROM job_listings
WHERE is_external = true
GROUP BY title, company_name, location, job_hash
HAVING COUNT(*) > 1;
```

## Cost Estimation

### OpenAI Deep Search

- **Per query**: ~$0.01-0.02 (GPT-4 Turbo)
- **Per embedding**: ~$0.00002 (text-embedding-3-small)
- **Daily cost** (10 queries, 50 jobs):
  - Queries: 10 × $0.015 = $0.15
  - Embeddings: 50 × $0.00002 = $0.001
  - **Total**: ~$0.15/day = **$4.50/month**

### SerpAPI

- **Per search**: 1 credit (~$0.005-0.01 depending on plan)
- **Daily cost** (10 searches): ~$0.10/day = **$3/month**

### Combined

**Total estimated cost**: $7-8/month for daily ingestion

## Future Enhancements

- [ ] **RSS Feed Support**: Parse job RSS/Atom feeds
- [ ] **Job Board APIs**: Direct integration with Indeed, LinkedIn, etc.
- [ ] **ML Quality Scoring**: Predict job quality before inserting
- [ ] **Duplicate Detection**: More sophisticated fuzzy matching
- [ ] **Region-Specific Parsing**: Handle local job formats
- [ ] **Multi-language**: Support French, Kinyarwanda job postings
- [ ] **Webhook Notifications**: Alert on high-quality matches

## Related Docs

- `JOB_BOARD_README.md` - Main usage guide
- `JOB_BOARD_DEPLOYMENT.md` - Deployment steps
- `20251114230000_job_board_enhancements.sql` - Schema changes

---

**Status**: ✅ Complete and Ready for Deployment
**Version**: 1.0.0
**Last Updated**: November 14, 2025
