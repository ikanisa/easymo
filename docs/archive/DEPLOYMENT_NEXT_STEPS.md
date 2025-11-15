# Deployment Next Steps

**Status:** ✅ Function Deployed Successfully  
**Function URL:** https://vacltfdslodqybxojytc.supabase.co/functions/v1/openai-deep-research

---

## ✅ Completed

- [x] Enhanced deep research function deployed
- [x] Multi-source integration (Econfary + SerpAPI + OpenAI)
- [x] Contact number validation implemented
- [x] Documentation created

---

## 🔧 Manual Steps Required

### Step 1: Apply Database Migrations

**Option A: Via Supabase Dashboard (Recommended)**

1. Go to: https://supabase.com/dashboard/project/vacltfdslodqybxojytc/sql/new

2. Copy and paste this SQL:

```sql
-- =====================================================
-- Migration 1: Deep Research Tables
-- =====================================================
$(cat supabase/migrations/20251114194200_openai_deep_research_tables.sql)
```

3. Click "Run"

4. Then copy and paste this SQL:

```sql
-- =====================================================
-- Migration 2: Cron Schedule (1x daily at 11am EAT)
-- =====================================================
$(cat supabase/migrations/20251114194300_schedule_deep_research_cron.sql)
```

5. Click "Run"

**Option B: Via Command Line**

If you have DATABASE_URL set:

```bash
cd /Users/jeanbosco/workspace/easymo-
cat supabase/migrations/20251114194200_openai_deep_research_tables.sql | psql $DATABASE_URL
cat supabase/migrations/20251114194300_schedule_deep_research_cron.sql | psql $DATABASE_URL
```

---

### Step 2: Set Environment Variables

1. Go to: https://supabase.com/dashboard/project/vacltfdslodqybxojytc/settings/functions

2. Click "Add new secret"

3. Add these:
   - **Name:** `SERPAPI_KEY`  
     **Value:** `YOUR_SERPAPI_KEY_HERE` (get from https://serpapi.com)
   
   - **Name:** `OPENAI_API_KEY` (if not already set)  
     **Value:** `sk-...`

---

### Step 3: Test the Function

```bash
# Replace YOUR_SERVICE_ROLE_KEY with actual key from:
# https://supabase.com/dashboard/project/vacltfdslodqybxojytc/settings/api

curl -X POST "https://vacltfdslodqybxojytc.supabase.co/functions/v1/openai-deep-research" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "scrape",
    "testMode": true,
    "countries": ["RW"]
  }'
```

**Expected result (after 3-6 minutes):**
```json
{
  "success": true,
  "sessionId": "...",
  "statistics": {
    "countriesSearched": 1,
    "propertiesFound": 60-95,
    "propertiesInserted": 60-95,
    "duplicates": 0,
    "failed": 0,
    "noContact": 0
  }
}
```

---

### Step 4: Verify Data

Run this SQL in Supabase Dashboard:

```sql
-- Check if properties were inserted
SELECT 
  source,
  COUNT(*) as total,
  COUNT(contact_info) as with_contacts,
  MIN(contact_info) as sample_contact,
  AVG(price) as avg_price
FROM researched_properties
WHERE scraped_at > NOW() - INTERVAL '1 hour'
GROUP BY source;

-- Expected output:
-- Econfary API          | 30-50 | 30-50 | +250... | 150000
-- SerpAPI              | 20-30 | 20-30 | +250... | 200000
-- OpenAI Deep Research | 10-15 | 10-15 | +250... | 180000
```

---

### Step 5: Update Cron Settings (After Migration)

After applying migrations, update the cron job settings:

```sql
-- Update Supabase URL and service role key
UPDATE app_settings 
SET value = 'https://vacltfdslodqybxojytc.supabase.co' 
WHERE key = 'app.supabase_url';

UPDATE app_settings 
SET value = 'YOUR_SERVICE_ROLE_KEY_HERE' 
WHERE key = 'app.service_role_key';

-- Verify cron job
SELECT * FROM cron.job WHERE jobname = 'openai-deep-research-daily';
```

---

## 🎯 Success Checklist

After completing all steps:

- [ ] Migrations applied successfully
- [ ] SERPAPI_KEY set in dashboard
- [ ] OPENAI_API_KEY set (if needed)
- [ ] Test run completed (60-95 properties)
- [ ] All properties have contact_info
- [ ] Cron settings updated
- [ ] Schedule verified (11am EAT daily)

---

## 📊 Monitoring

### Daily Check (11:30am EAT)

```sql
-- Check today's run
SELECT 
  started_at,
  properties_found,
  properties_inserted,
  (metadata->>'econfaryCount')::int as econfary,
  (metadata->>'serpAPICount')::int as serpapi,
  (metadata->>'openAICount')::int as openai
FROM research_sessions
WHERE started_at > CURRENT_DATE
ORDER BY started_at DESC
LIMIT 1;
```

### Weekly Summary

```sql
-- Properties by country
SELECT 
  location_country,
  COUNT(*) as total_properties,
  COUNT(DISTINCT contact_info) as unique_contacts,
  ROUND(AVG(price), 2) as avg_price
FROM researched_properties
WHERE scraped_at > NOW() - INTERVAL '7 days'
GROUP BY location_country
ORDER BY total_properties DESC;
```

---

## 🚨 Troubleshooting

### Issue: Migrations fail

**Solution:** Apply them one at a time via Dashboard SQL Editor

### Issue: Function returns "SERPAPI_KEY not set"

**Solution:** Add SERPAPI_KEY in Function Settings

### Issue: No properties inserted

**Solution:** Check function logs:
```bash
supabase functions logs openai-deep-research --tail 100
```

### Issue: Cron job not running

**Solution:** Check cron jobs:
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'openai-deep-research-daily')
ORDER BY start_time DESC LIMIT 5;
```

---

## 📞 Support

**Documentation:**
- Full Guide: `FINAL_DEPLOYMENT_SUMMARY.md`
- Contact Validation: `DEEP_RESEARCH_CONTACT_VALIDATION.md`
- Configuration: `AI_AGENTS_PHASE2_CONFIGURATION.md`

**Dashboards:**
- Functions: https://supabase.com/dashboard/project/vacltfdslodqybxojytc/functions
- Database: https://supabase.com/dashboard/project/vacltfdslodqybxojytc/editor
- SQL Editor: https://supabase.com/dashboard/project/vacltfdslodqybxojytc/sql/new
- Settings: https://supabase.com/dashboard/project/vacltfdslodqybxojytc/settings/api

---

## 🎉 You're Almost There!

**Function is deployed and ready.**  
**Just complete the 5 manual steps above and you're live!**

Expected timeline:
- Step 1 (Migrations): 5 minutes
- Step 2 (Secrets): 2 minutes
- Step 3 (Testing): 6 minutes (function runtime)
- Step 4 (Verification): 2 minutes
- Step 5 (Cron update): 1 minute

**Total: ~15 minutes to full deployment!**

🚀 Let's finish this!
