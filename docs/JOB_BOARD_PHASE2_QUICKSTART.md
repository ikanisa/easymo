# Phase 2: External Jobs - 10-Minute Setup 🚀

## What This Adds

Automatically discover and import jobs from online sources:
- 🔍 **OpenAI Deep Search**: Finds jobs on legitimate job boards
- 🌐 **SerpAPI**: Crawls Google for job postings  
- 🤖 **Auto-matching**: External jobs matched to seekers like local jobs
- ⏰ **Daily Sync**: Runs automatically at 3 AM

## Prerequisites

✅ Phase 1 (core job board) deployed
✅ OpenAI API key already set
✅ (Optional) SerpAPI API key for Google search

## Setup in 4 Steps

### Step 1: Run Enhancement Migration (2 min)

```bash
cd /Users/jeanbosco/workspace/easymo-

# Apply migration
supabase db push

# Verify new columns
supabase db run "SELECT column_name FROM information_schema.columns 
                 WHERE table_name = 'job_listings' 
                 AND column_name IN ('org_id', 'is_external', 'job_hash')"
```

**Expected**: Shows `org_id`, `is_external`, `job_hash`, etc.

✅ **Done? Move to Step 2**

### Step 2: Deploy Job Sources Sync (2 min)

```bash
# Deploy function
supabase functions deploy job-sources-sync

# (Optional) Set SerpAPI key
supabase secrets set SERPAPI_API_KEY=your-key-here
```

✅ **Done? Move to Step 3**

### Step 3: Enable Job Sources (2 min)

```sql
-- Connect to your Supabase database
-- Enable Deep Search for Rwanda
UPDATE job_sources 
SET is_active = true,
    config = '{
      "queries": [
        {"country": "RW", "city": "Kigali", "query": "one day casual jobs in Kigali", "kind": "one_day"},
        {"country": "RW", "city": "Kigali", "query": "part time jobs Kigali", "kind": "part_time"},
        {"country": "RW", "query": "delivery driver jobs Rwanda", "kind": "full_time"}
      ]
    }'::jsonb
WHERE source_type = 'openai_deep_search';
```

Or run via CLI:
```bash
supabase db run "UPDATE job_sources SET is_active = true WHERE source_type = 'openai_deep_search'"
```

✅ **Done? Move to Step 4**

### Step 4: Test & Schedule (4 min)

**Test manual sync**:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/job-sources-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{}'
```

**Expected response**:
```json
{
  "success": true,
  "stats": {
    "inserted": 15,
    "updated": 0,
    "skipped": 0,
    "errors": 0
  }
}
```

**Schedule daily runs** (choose one):

**Option A: Supabase Dashboard** (Easier)
1. Go to Database → Cron Jobs
2. Click "Create a new cron job"
3. Name: `job-sources-sync`
4. Schedule: `0 3 * * *` (3 AM daily)
5. SQL:
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

**Option B: SQL** (For automation)
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'job-sources-sync',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/job-sources-sync',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

✅ **Done? You're live!**

## Verify It Works

### Check External Jobs Imported

```sql
-- Count external jobs
SELECT COUNT(*) as external_jobs 
FROM job_listings 
WHERE is_external = true;

-- View recent external jobs
SELECT title, company_name, location, discovered_at 
FROM job_listings 
WHERE is_external = true 
ORDER BY discovered_at DESC 
LIMIT 5;
```

### Test Matching

Send WhatsApp message: **"Looking for delivery work"**

You should see **both** local and external jobs in results!

### View Sync Logs

```bash
supabase functions logs job-sources-sync --tail
```

Look for:
```
JOB_SOURCES_SYNC_START
PROCESSING_SOURCE: OpenAI Deep Search
JOB_SOURCES_SYNC_COMPLETE: inserted=15, updated=0
```

## Monitoring

### Daily Stats

```sql
-- Jobs discovered per day
SELECT 
  DATE(discovered_at) as date,
  COUNT(*) as jobs_found
FROM job_listings
WHERE is_external = true
  AND discovered_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(discovered_at)
ORDER BY date DESC;

-- Source performance
SELECT 
  js.name,
  COUNT(*) as total_jobs,
  MAX(jl.discovered_at) as last_run
FROM job_listings jl
JOIN job_sources js ON jl.source_id = js.id
WHERE jl.is_external = true
GROUP BY js.name;
```

### Auto-Close Stale Jobs

Schedule cleanup of jobs not seen in 7+ days:

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

## What Users See

External jobs are **seamlessly mixed** with local jobs:

```
📋 Found 5 matching jobs:

1. 📦 Delivery Driver (LOCAL)
   📍 Kigali
   💰 8,000-12,000 RWF/day
   ✨ 92% match

2. 📦 Food Courier (ONLINE POSTING)
   📍 Kigali
   💰 10,000 RWF/day  
   ✨ 89% match
   🔗 More details: jobboard.rw/...

3. 🚚 Package Delivery (LOCAL)
   📍 Remera
   💰 15,000 RWF/day
   ✨ 87% match
```

Users don't need to know the difference!

## Cost Estimate

**Daily cost** (10 queries, 50 jobs found):
- Deep Search: 10 × $0.015 = **$0.15**
- Embeddings: 50 × $0.00002 = **$0.001**
- **Total**: ~$0.15/day = **$4.50/month**

Very affordable! 💰

## Troubleshooting

### No Jobs Discovered

1. Check source is active:
```sql
SELECT name, is_active FROM job_sources;
```

2. Check logs:
```bash
supabase functions logs job-sources-sync --since 1h
```

3. Test manually (see Step 4 above)

### Duplicates

Rare, but if you see duplicates:
```sql
-- Check for duplicates
SELECT title, company_name, COUNT(*)
FROM job_listings
WHERE is_external = true
GROUP BY title, company_name
HAVING COUNT(*) > 1;
```

Fix: Hash generation should prevent this automatically.

### High Errors

```sql
SELECT 
  event_type,
  COUNT(*),
  MAX(created_at) as last_error
FROM job_analytics
WHERE event_type IN ('SOURCE_ERROR', 'JOB_SOURCES_SYNC_ERROR')
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type;
```

## Next Steps

Now that external jobs are flowing:

1. ✅ **Monitor match quality**: Are users finding jobs?
2. ✅ **Add more sources**: Configure more queries in `job_sources.config`
3. ✅ **Enable SerpAPI**: Add `SERPAPI_API_KEY` for even more jobs
4. ✅ **Tune categories**: Improve auto-categorization logic
5. ✅ **Add notifications**: WhatsApp templates when matches occur

## Advanced: Add Custom Sources

Want to add Indeed API or custom RSS?

1. Insert new source:
```sql
INSERT INTO job_sources (name, source_type, config, is_active) VALUES
  ('Indeed API', 'custom_rss', '{"feed_url": "https://rss.indeed.com/..."}'::jsonb, true);
```

2. Extend `job-sources-sync/index.ts`:
```typescript
else if (source.source_type === 'custom_rss') {
  const sourceStats = await processRSSFeed(source, correlationId);
  // ... your RSS parsing logic
}
```

3. Redeploy: `supabase functions deploy job-sources-sync`

## Complete Documentation

- **Full Guide**: `supabase/functions/job-sources-sync/README.md`
- **Deployment Checklist**: `docs/JOB_BOARD_DEPLOYMENT_CHECKLIST.md`
- **Schema Changes**: `supabase/migrations/20251114230000_job_board_enhancements.sql`

## Success! 🎉

You now have a **hybrid job marketplace**:
- 📱 Local WhatsApp postings
- 🌐 Online job board discoveries
- 🤖 AI-powered matching for both
- ⏰ Daily automatic updates

**Total setup time**: ~10 minutes
**Monthly cost**: ~$5-8
**Value**: Priceless! 🚀

---

**Phase 2 Status**: ✅ Complete
**Version**: 1.0.0
**Ready to Go!** 🎊
