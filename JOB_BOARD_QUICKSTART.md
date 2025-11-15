# Job Board AI Agent - Quick Start Guide

## 🚀 Setup (5 minutes)

### 1. Environment Variables

Add to `.env.local`:

```bash
# OpenAI (REQUIRED)
OPENAI_API_KEY=sk-...

# SerpAPI (Optional - for external job sources)
SERPAPI_API_KEY=...

# Feature Flags
FEATURE_JOB_BOARD=true
FEATURE_EXTERNAL_JOB_SOURCES=true
```

### 2. Apply Migrations

```bash
cd /Users/jeanbosco/workspace/easymo-

# Apply all job board migrations
supabase db push

# Verify tables created
psql $DATABASE_URL -c "\dt *job*"

# Expected output:
# - job_listings
# - job_seekers
# - job_sources
# - job_categories_by_country
# - job_matches
# - job_applications
# - job_conversations
```

### 3. Deploy Edge Functions

```bash
# Deploy job board agent
supabase functions deploy job-board-ai-agent

# Deploy job sources sync (daily ingestion)
supabase functions deploy job-sources-sync

# Verify deployments
supabase functions list
```

### 4. Schedule Daily Job Sync

**Option A: Supabase Dashboard**
- Go to Functions → Schedules
- Create new schedule:
  - Name: `daily-job-sync`
  - Function: `job-sources-sync`
  - Cron: `0 3 * * *` (3am daily)
  - Timezone: Africa/Kigali (or your primary country)

**Option B: SQL**
```sql
SELECT cron.schedule(
  'daily-job-sync',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/job-sources-sync',
    headers := jsonb_build_object(
      'Authorization', 
      'Bearer ' || current_setting('app.supabase_service_role_key')
    )
  )$$
);
```

---

## ✅ Verification

### Check Menu Item

```sql
SELECT key, name, active_countries, display_order, is_active
FROM whatsapp_home_menu_items
WHERE key = 'jobs';
```

Expected: `display_order=1`, `is_active=true`, `active_countries` includes all active country codes

### Check Job Sources

```sql
SELECT 
  name, 
  source_type, 
  is_active,
  jsonb_array_length(config->'queries') as query_count
FROM job_sources;
```

Expected: 2 rows (OpenAI Deep Search, SerpAPI), each with queries for all countries

### Check Countries

```sql
SELECT code, name, is_active, currency_code
FROM countries
WHERE is_active = true
ORDER BY code;
```

### Check Agent Config

```sql
SELECT slug, name, is_active, array_length(languages, 1) as language_count
FROM agent_configs
WHERE slug = 'job-board';
```

Expected: 1 row, `is_active=true`, 7+ languages

---

## 🧪 Testing

### Manual Test: Seeker Flow

```bash
# Test via curl (simulates WhatsApp message)
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/job-board-ai-agent" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+250788123456",
    "message": "I need a part-time job in Kigali as a waiter"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "I can help you find waiter jobs in Kigali! Tell me:\n- When are you available?\n- Pay expectations?\n- Experience level?",
  "tool_calls": [],
  "conversation_id": "..."
}
```

### Manual Test: Poster Flow

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/job-board-ai-agent" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+250788654321",
    "message": "I want to post a job for a cleaner this Saturday in Kigali, 4 hours, 15000 RWF"
  }'
```

Expected: Agent extracts metadata and calls `post_job` tool

### Test External Job Ingestion

```bash
# Manually trigger sync
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/job-sources-sync" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# Check logs
supabase functions logs job-sources-sync --tail

# Verify jobs ingested
psql $DATABASE_URL -c "
  SELECT COUNT(*), country_code
  FROM job_listings
  WHERE is_external = true
  GROUP BY country_code;
"
```

### Test Matching

```sql
-- Create test seeker embedding
WITH test_embedding AS (
  SELECT required_skills_embedding
  FROM job_seekers
  WHERE phone_number = '+250788123456'
  LIMIT 1
)
SELECT * FROM match_jobs_for_seeker(
  (SELECT required_skills_embedding FROM test_embedding),
  NULL, -- org_id
  'RW', -- country_code
  0.7,  -- threshold
  5     -- limit
);
```

Expected: 0-5 job matches with similarity scores

---

## 🎯 Usage Examples

### Example 1: One-Day Gig (Seeker)

**User**: "nshaka akazi y'umunsi umwe ku wa gatandatu mu Kigali" (Kinyarwanda)

**Expected Flow**:
1. Agent detects Kinyarwanda
2. Responds in Kinyarwanda: "Ego, nshobora kukufasha! Ushaka akazi k'ubuhe bwoko?"
3. Calls `search_jobs` with `job_types=['gig','part_time']`, `country_code='RW'`
4. Shows 3-5 matches with Kinyarwanda labels

### Example 2: Multi-Slot Job (Poster)

**User**: "Besoin de 5 serveurs pour un événement demain à Kigali, 6h-minuit, 20000 RWF chacun" (French)

**Expected Flow**:
1. Agent detects French
2. Calls `extract_job_metadata`:
   - `slots: 5`
   - `job_type: 'gig'`
   - `category: 'cooking'` (hospitality)
   - `pay: 20000 RWF/person`
   - `duration: "6h-minuit"`
3. Calls `post_job`
4. Shows 5+ matching seekers

### Example 3: External Job (Malta)

**Deep Search Query**: "hospitality jobs in Malta"

**Ingested Job**:
```json
{
  "title": "Bartender - St Julians",
  "company_name": "Malta Hotel Group",
  "location": "St Julians, Malta",
  "country_code": "MT",
  "job_type": "part_time",
  "category": "cooking",
  "pay_min": 8,
  "pay_max": 12,
  "pay_type": "hourly",
  "currency": "EUR",
  "external_url": "https://maltajobs.com/...",
  "is_external": true
}
```

**When MT user searches**:
- Agent shows this along with local jobs
- Includes: "Source: online job board"
- Link to external URL provided

---

## 📊 Monitoring

### Daily Stats

```sql
-- Job posting activity (last 7 days)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE is_external = false) as local_jobs,
  COUNT(*) FILTER (WHERE is_external = true) as external_jobs
FROM job_listings
WHERE created_at > now() - interval '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Seeker activity
SELECT DATE(created_at), COUNT(*)
FROM job_seekers
WHERE created_at > now() - interval '7 days'
GROUP BY DATE(created_at)
ORDER BY 1 DESC;

-- Match success
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM job_matches
WHERE created_at > now() - interval '30 days'
GROUP BY status;

-- Top categories by country
SELECT 
  country_code,
  category,
  COUNT(*) as job_count
FROM job_listings
WHERE status = 'open'
GROUP BY country_code, category
ORDER BY country_code, job_count DESC;
```

### Logs

```bash
# Agent logs
supabase functions logs job-board-ai-agent --tail -n 50

# Sync logs
supabase functions logs job-sources-sync --tail -n 20

# Error events
psql $DATABASE_URL -c "
  SELECT * FROM event_logs
  WHERE event = 'ERROR'
  AND metadata->>'context' LIKE '%job%'
  AND created_at > now() - interval '1 hour'
  ORDER BY created_at DESC
  LIMIT 10;
"
```

---

## 🔧 Troubleshooting

### Issue: Jobs menu not showing for a country

**Diagnosis**:
```sql
SELECT active_countries FROM whatsapp_home_menu_items WHERE key = 'jobs';
```

**Fix**:
```sql
UPDATE whatsapp_home_menu_items
SET active_countries = (
  SELECT array_agg(code) FROM countries WHERE is_active = true
)
WHERE key = 'jobs';
```

### Issue: No external jobs ingested

**Diagnosis**:
```bash
# Check job sources active
psql $DATABASE_URL -c "SELECT name, is_active FROM job_sources;"

# Check last sync
supabase functions logs job-sources-sync | grep "JOB_SOURCES_SYNC"
```

**Fix**:
```sql
-- Enable sources
UPDATE job_sources SET is_active = true;

-- Manually trigger
-- (use curl command from Testing section)
```

### Issue: Poor match quality

**Diagnosis**:
```sql
-- Check if embeddings exist
SELECT 
  COUNT(*) as total,
  COUNT(required_skills_embedding) as with_embedding
FROM job_listings;

-- Check embedding dimensions
SELECT 
  vector_dims(required_skills_embedding) as dims
FROM job_listings
WHERE required_skills_embedding IS NOT NULL
LIMIT 1;
```

**Fix**:
```sql
-- Regenerate embeddings (requires re-posting or re-sync)
-- Or lower threshold:
-- In handler: match_threshold := 0.6 (instead of 0.7)
```

### Issue: Agent not responding

**Diagnosis**:
```bash
# Check function status
supabase functions list

# Check recent errors
supabase functions logs job-board-ai-agent | grep "ERROR"

# Check OpenAI API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Fix**:
- Verify `OPENAI_API_KEY` set correctly
- Check rate limits (OpenAI dashboard)
- Redeploy function if needed

---

## 🌍 Adding a New Country

1. **Add to countries table**:
```sql
INSERT INTO countries (code, name, currency_code, phone_prefix, ...)
VALUES ('KE', 'Kenya', 'KES', '+254', ...);
```

2. **Trigger auto-runs**:
- Job sources queries regenerated (via trigger)
- Job categories seeded (via trigger)
- Menu item updated (via trigger)

3. **Verify**:
```sql
SELECT * FROM job_sources WHERE config->'queries' @> '[{"country": "KE"}]';
SELECT * FROM job_categories_by_country WHERE country_code = 'KE';
```

4. **Optional: Add local language labels**:
```sql
UPDATE job_categories_by_country
SET label_local = 'Kiswahili label here'
WHERE country_code = 'KE' AND category_key = 'delivery';
```

---

## 📚 Next Steps

1. **Enable SerpAPI**: Set `SERPAPI_API_KEY` for broader job coverage
2. **Localization**: Add more language labels for categories
3. **Admin UI**: Build admin panel views for job moderation
4. **Notifications**: Implement proactive WhatsApp notifications for matches
5. **Analytics**: Set up dashboards for job board metrics

---

## 📞 Support

- **Technical**: Check `JOB_BOARD_ALL_COUNTRIES_IMPLEMENTATION.md` for details
- **Logs**: Use `supabase functions logs` + `event_logs` table
- **Database**: All tables prefixed with `job_*`

**Last Updated**: 2025-11-14  
**Version**: 1.0.0  
**Status**: ✅ Ready for Production
