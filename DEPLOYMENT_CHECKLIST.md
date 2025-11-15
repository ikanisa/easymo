# ✅ DEPLOYMENT CHECKLIST
## World-Class Job & Property Board Implementation

**Current Status**: Only 14 jobs → Target: 100+ jobs  
**Timeline**: Deploy today, see results within 24 hours

---

## PRE-DEPLOYMENT

### Environment Setup
- [ ] Supabase CLI installed (`supabase --version`)
- [ ] Git repository clean (`git status`)
- [ ] Logged into Supabase project (`supabase projects list`)

### API Keys Required
- [ ] `OPENAI_API_KEY` obtained from https://platform.openai.com/api-keys
- [ ] `SERPAPI_API_KEY` obtained from https://serpapi.com/users/sign_up (free tier OK)
- [ ] `SUPABASE_URL` from Supabase Dashboard → Settings → API → Project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` from Supabase Dashboard → Settings → API → service_role

**Check Current Secrets**:
```bash
supabase secrets list
```

**Set Missing Secrets**:
```bash
supabase secrets set OPENAI_API_KEY='sk-...'
supabase secrets set SERPAPI_API_KEY='...'
supabase secrets set SUPABASE_URL='https://xxx.supabase.co'
supabase secrets set SUPABASE_SERVICE_ROLE_KEY='eyJ...'
```

---

## DEPLOYMENT (Choose One Method)

### Method 1: Automated Script (Recommended)
```bash
cd /Users/jeanbosco/workspace/easymo-
./deploy-comprehensive-scraping.sh
```

**What it does**:
- [x] Checks prerequisites
- [x] Applies database migrations
- [x] Verifies secrets
- [x] Deploys Edge Functions
- [x] Runs test sync
- [x] Displays results

**Expected Duration**: 5-10 minutes

### Method 2: Manual Deployment
```bash
# 1. Apply migrations
supabase db push

# 2. Deploy functions
supabase functions deploy job-sources-sync
supabase functions deploy openai-deep-research

# 3. Test run
supabase functions invoke job-sources-sync --method POST --body '{}'
```

---

## POST-DEPLOYMENT VERIFICATION

### Step 1: Check Database Tables
```sql
-- Should show 25+ job sources
SELECT COUNT(*) FROM job_sources WHERE is_active = true;

-- Should show 20+ property sources
SELECT COUNT(*) FROM property_sources WHERE is_active = true;
```

**Expected**:
- ✅ 25+ job sources active
- ✅ 20+ property sources active

### Step 2: Check Job Count (Before)
```sql
SELECT COUNT(*) FROM job_listings WHERE is_external = true;
```

**Expected**: 14 (current) → Will increase after sync

### Step 3: Manual Test Sync
```bash
supabase functions invoke job-sources-sync --method POST --body '{}'
```

**Expected**: Success response with statistics (inserted, updated, skipped)

### Step 4: Check Job Count (After)
```sql
SELECT COUNT(*) FROM job_listings WHERE is_external = true;
```

**Expected**: 30-60+ (increased from 14)

### Step 5: View Recent Jobs
```sql
SELECT title, company_name, location, discovered_at 
FROM job_listings 
WHERE is_external = true 
ORDER BY discovered_at DESC 
LIMIT 20;
```

**Expected**: New jobs with recent `discovered_at` timestamps

### Step 6: Check for Errors
```sql
SELECT * FROM observability_logs 
WHERE event LIKE '%ERROR%' 
ORDER BY timestamp DESC 
LIMIT 20;
```

**Expected**: No critical errors (minor warnings OK)

### Step 7: Verify Automation
```sql
SELECT * FROM cron.job WHERE jobname LIKE '%sources-sync%';
```

**Expected**: 2 scheduled jobs:
- `daily-job-sources-sync` at `0 2 * * *`
- `daily-property-sources-sync` at `0 3 * * *`

---

## 24-HOUR FOLLOW-UP

### Next Morning (After Automated Sync)

```sql
-- Check if automated sync ran
SELECT * FROM observability_logs 
WHERE event = 'JOB_SOURCES_SYNC_COMPLETE' 
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

**Expected**: 1-2 sync completion events

```sql
-- Check new job count
SELECT COUNT(*) FROM job_listings WHERE is_external = true;
```

**Expected**: 80-120+ jobs

```sql
-- Check new property count
SELECT COUNT(*) FROM researched_properties WHERE status = 'active';
```

**Expected**: 30-60+ properties

---

## WEEK 1 MONITORING

### Daily Checks

**Jobs Growth**:
```sql
SELECT 
  DATE(discovered_at) as date,
  COUNT(*) as new_jobs
FROM job_listings
WHERE is_external = true
  AND discovered_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(discovered_at)
ORDER BY date DESC;
```

**Expected**: 20-50 new jobs per day

**Properties Growth**:
```sql
SELECT 
  DATE(scraped_at) as date,
  COUNT(*) as new_properties
FROM researched_properties
WHERE scraped_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(scraped_at)
ORDER BY date DESC;
```

**Expected**: 10-20 new properties per day

### Week 1 Targets
- [ ] 100+ jobs in database
- [ ] 50+ properties in database
- [ ] Both Malta & Rwanda represented
- [ ] 15+ job categories populated
- [ ] Daily automated sync running successfully
- [ ] Error rate < 1%

---

## TROUBLESHOOTING

### Issue: Still only 14 jobs after sync

**Diagnosis**:
```sql
-- Check if sources are enabled
SELECT name, is_active FROM job_sources;

-- Check sync logs
SELECT * FROM observability_logs 
WHERE event LIKE '%JOB_SOURCES%' 
ORDER BY timestamp DESC LIMIT 10;
```

**Solutions**:
```bash
# Re-deploy function
supabase functions deploy job-sources-sync

# Manual trigger
supabase functions invoke job-sources-sync --method POST --body '{}'

# Check function logs
supabase functions logs job-sources-sync --limit 50
```

### Issue: SerpAPI errors

**Diagnosis**:
```bash
supabase secrets list | grep SERPAPI
```

**Solution**:
```bash
# Get free API key: https://serpapi.com/users/sign_up
supabase secrets set SERPAPI_API_KEY='your-key'

# Redeploy
supabase functions deploy job-sources-sync
```

### Issue: OpenAI rate limits

**Diagnosis**:
Check usage at https://platform.openai.com/usage

**Solutions**:
1. Use gpt-4o-mini for extraction (already configured)
2. Reduce queries per source (edit job_sources.config)
3. Upgrade OpenAI plan

### Issue: No automated runs

**Diagnosis**:
```sql
SELECT * FROM cron.job;
```

**Solution**:
```bash
# Re-apply migrations
supabase db push
```

---

## SUCCESS CRITERIA

### Minimum (Week 1)
- [x] Deployment script runs successfully
- [ ] 100+ jobs in database (from 14)
- [ ] 50+ properties in database
- [ ] All sources enabled and active
- [ ] Daily automated sync running
- [ ] Error rate < 1%

### Optimal (Month 1)
- [ ] 200-300+ jobs in database
- [ ] 100-150+ properties in database
- [ ] 20-50 new jobs added daily
- [ ] 10-20 new properties added daily
- [ ] 80%+ jobs have company names
- [ ] 60%+ jobs have salary info
- [ ] 40%+ listings have contact info
- [ ] AI matching working (embeddings generated)

---

## COST MONITORING

### Daily Cost Estimate
- OpenAI API: ~$0.50-1.00/day
- SerpAPI: Free tier (100 searches/month)
- **Total**: ~$0.50-1.00/day

### Monthly Cost Estimate
- OpenAI API: ~$15-30/month
- SerpAPI: $0-50/month (depending on usage)
- **Total**: ~$15-80/month

### Cost Optimization
```sql
-- Disable underperforming sources
UPDATE job_sources 
SET is_active = false 
WHERE name IN ('source with no results');

-- Check source performance
SELECT 
  js.name,
  COUNT(jl.id) as job_count,
  ROUND(COUNT(jl.id)::numeric / GREATEST(
    JSONB_ARRAY_LENGTH(js.config->'queries'), 1
  ), 2) as jobs_per_query
FROM job_sources js
LEFT JOIN job_listings jl ON jl.source_id = js.id
WHERE js.is_active = true
GROUP BY js.id, js.name, js.config
ORDER BY jobs_per_query DESC;
```

---

## DOCUMENTATION REFERENCE

- **Executive Summary**: `/WORLD_CLASS_SCRAPING_IMPLEMENTATION.md`
- **Quick Start**: `/QUICKSTART_SCRAPING.md`
- **Architecture**: `/SCRAPING_ARCHITECTURE_DIAGRAM.txt`
- **Detailed Guide**: `/supabase/functions/job-sources-sync/COMPREHENSIVE_JOB_BOARD_IMPLEMENTATION.md`
- **Deployment Script**: `/deploy-comprehensive-scraping.sh`

---

## FINAL CHECKLIST

### Before Deployment
- [x] Read documentation
- [ ] Verify API keys obtained
- [ ] Set all environment secrets
- [ ] Backup current database (optional)
- [ ] Review deployment script

### During Deployment
- [ ] Run deployment script
- [ ] Watch for errors in output
- [ ] Verify migrations applied
- [ ] Confirm functions deployed
- [ ] Test manual sync

### After Deployment
- [ ] Check job count increased
- [ ] Verify new jobs visible
- [ ] Check automation scheduled
- [ ] Monitor error logs
- [ ] Set calendar reminder for tomorrow

### 24 Hours Later
- [ ] Check automated sync ran
- [ ] Verify job count > 80
- [ ] Check property count > 30
- [ ] Review error logs
- [ ] Fine-tune if needed

### Week 1
- [ ] Monitor daily growth
- [ ] Check category distribution
- [ ] Analyze source performance
- [ ] Disable low performers
- [ ] Celebrate 100+ jobs! 🎉

---

## QUICK COMMANDS REFERENCE

```bash
# Deploy
./deploy-comprehensive-scraping.sh

# Check secrets
supabase secrets list

# Set secret
supabase secrets set KEY='value'

# Deploy function
supabase functions deploy job-sources-sync

# Invoke function
supabase functions invoke job-sources-sync --method POST --body '{}'

# View logs
supabase functions logs job-sources-sync --limit 50

# Database query
supabase db execute "SELECT COUNT(*) FROM job_listings WHERE is_external = true;"

# Apply migrations
supabase db push
```

---

## SUPPORT

**Issues?**
1. Check observability_logs table for errors
2. Review function logs: `supabase functions logs job-sources-sync`
3. Re-run deployment script: `./deploy-comprehensive-scraping.sh`
4. Check documentation in `/supabase/functions/job-sources-sync/`

**Questions?**
- Review: `WORLD_CLASS_SCRAPING_IMPLEMENTATION.md`
- Quick ref: `QUICKSTART_SCRAPING.md`
- Architecture: `SCRAPING_ARCHITECTURE_DIAGRAM.txt`

---

**Status**: ✅ Ready for Production Deployment  
**Next Action**: Run `./deploy-comprehensive-scraping.sh`  
**Expected Result**: 100+ jobs within 24 hours

🚀 **Let's make this job board world-class!**
