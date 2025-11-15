# 🚀 MANUAL MIGRATION GUIDE
## Apply Database Migrations via Supabase Dashboard

**Date**: November 15, 2025  
**Reason**: `supabase db push` timed out due to network latency  
**Status**: Edge Functions deployed ✅ | Migrations pending ⏳

---

## 📋 WHAT NEEDS TO BE DONE

You need to manually apply **3 migration files** via the Supabase Dashboard SQL Editor.

---

## 🎯 STEP-BY-STEP INSTRUCTIONS

### Step 1: Open Supabase SQL Editor

Go to: **https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql**

---

### Step 2: Apply Migration 1 - Job Sources

**File**: `supabase/migrations/20251115110000_comprehensive_job_sources.sql`

1. Open this file in your code editor
2. **Copy the entire contents** (Ctrl+A, Ctrl+C)
3. Go to Supabase SQL Editor
4. Click **"New query"**
5. **Paste** the SQL (Ctrl+V)
6. Click **"Run"** (or press F5)
7. Wait for success message

**This migration adds**:
- 25+ job sources (Malta: 12, Rwanda: 11+)
- JobsPlus, LinkedIn, KeepMePosted, Indeed, BrighterMonday, etc.
- Daily automated sync at 2 AM UTC

---

### Step 3: Apply Migration 2 - Property Sources

**File**: `supabase/migrations/20251115120000_comprehensive_property_sources.sql`

1. Open this file in your code editor
2. **Copy the entire contents**
3. Go to Supabase SQL Editor
4. Click **"New query"**
5. **Paste** the SQL
6. Click **"Run"**
7. Wait for success message

**This migration adds**:
- 30+ property sources (Malta: 16, Rwanda: 14)
- Property.com.mt, Frank Salt, Remax, House.co.rw, etc.
- Creates `property_sources` table
- Daily automated sync at 3 AM UTC

---

### Step 4: Apply Migration 3 - Job Contact Enhancement

**File**: `supabase/migrations/20251115120100_job_contact_enhancement.sql`

1. Open this file in your code editor
2. **Copy the entire contents**
3. Go to Supabase SQL Editor
4. Click **"New query"**
5. **Paste** the SQL
6. Click **"Run"**
7. Wait for success message

**This migration adds**:
- 7 new contact fields: email, whatsapp, linkedin, facebook, twitter, website, other
- Phone normalization function (+250, +356)
- Contact validation trigger
- `job_listings_with_contacts` view

---

### Step 5: Verify Migrations

In the SQL Editor, run these verification queries:

```sql
-- Check job sources (expect 25+)
SELECT COUNT(*) as total_job_sources 
FROM job_sources 
WHERE is_active = true;

-- Check property sources (expect 30+)
SELECT COUNT(*) as total_property_sources 
FROM property_sources 
WHERE is_active = true;

-- Check contact fields added
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'job_listings' 
  AND column_name LIKE 'contact_%';

-- Check pg_cron jobs configured
SELECT jobname, schedule 
FROM cron.job 
WHERE jobname LIKE '%sync%';
```

**Expected Results**:
- ✅ `total_job_sources`: 25+
- ✅ `total_property_sources`: 30+
- ✅ Contact fields: 7 columns
- ✅ Cron jobs: 2 (job sync @ 2 AM, property sync @ 3 AM)

---

## 🚀 STEP 6: TRIGGER SCRAPING

After migrations are applied, trigger the scraping functions manually:

### Option 1: Via Dashboard

1. Go to: **https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions**
2. Click **"job-sources-sync"** → **"Invoke"** → **"Send request"**
3. Click **"openai-deep-research"** → **"Invoke"** → Body: `{"action":"sync_all"}` → **"Send request"**

### Option 2: Via cURL (Terminal)

```bash
# Trigger job scraping
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/job-sources-sync \
  -H "Content-Type: application/json" \
  -d '{}'

# Trigger property scraping
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/openai-deep-research \
  -H "Content-Type: application/json" \
  -d '{"action":"sync_all"}'
```

---

## 📊 STEP 7: MONITOR PROGRESS

### Check Logs

Go to: **https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions**

1. Click **"job-sources-sync"** → **"Logs"** tab
2. Click **"openai-deep-research"** → **"Logs"** tab

Watch for:
- ✅ "Processing source: JobsPlus Malta..."
- ✅ "Inserted X jobs from source..."
- ✅ "Total jobs processed: X"

### Check Data

Run these queries in SQL Editor:

```sql
-- Check current job count
SELECT COUNT(*) as total_jobs 
FROM job_listings 
WHERE is_external = true;

-- Check recent jobs with contacts
SELECT 
  title, 
  company_name, 
  contact_phone, 
  contact_email, 
  contact_whatsapp,
  discovered_at
FROM job_listings
WHERE is_external = true
ORDER BY discovered_at DESC
LIMIT 10;

-- Check property count
SELECT COUNT(*) as total_properties 
FROM researched_properties 
WHERE status = 'active';

-- Check recent properties
SELECT 
  title, 
  property_type, 
  bedrooms, 
  price, 
  location_city,
  contact_info,
  scraped_at
FROM researched_properties
WHERE status = 'active'
ORDER BY scraped_at DESC
LIMIT 10;
```

---

## ⏱️ EXPECTED TIMELINE

### Immediately After Triggering
- ⏳ Scraping starts (functions running)
- 👀 Monitor logs for progress

### Within 30-60 Minutes
- ✅ 20-40 jobs added
- ✅ 10-20 properties added
- 📊 Contact info: 80%+ (jobs), 100% (properties)

### Within 1-2 Hours
- ✅ 50-80 jobs (with comprehensive contacts)
- ✅ 20-30 properties (100% with contacts)

### Within 24 Hours
- ✅ 100+ jobs (85%+ contact coverage)
- ✅ 50+ properties (100% contact coverage)
- ✅ Daily automated sync running

---

## 🔧 TROUBLESHOOTING

### If Migration Fails

**Error**: "relation already exists"
- **Solution**: That table/column was already created. Skip to next migration.

**Error**: "permission denied"
- **Solution**: Make sure you're logged in as database owner in Dashboard.

**Error**: "syntax error"
- **Solution**: Make sure you copied the ENTIRE file contents (including `BEGIN;` and `COMMIT;`).

### If Scraping Returns 0 Results

**Check**: Verify migrations were applied
```sql
SELECT COUNT(*) FROM job_sources WHERE is_active = true;
-- If 0, migrations didn't apply
```

**Solution**: Re-run the migration steps.

### If Functions Return Errors

**Check logs** in Dashboard → Functions → [function name] → Logs

Common issues:
- Missing API keys (OPENAI_API_KEY, SERPAPI_KEY)
- Rate limits (wait and retry)
- Network timeouts (normal for first run)

---

## ✅ SUCCESS CRITERIA

After completing all steps, you should have:

- ✅ 25+ job sources configured
- ✅ 30+ property sources configured
- ✅ 7 new contact fields in job_listings
- ✅ 2 pg_cron jobs scheduled
- ✅ 20-80 jobs with contact info
- ✅ 10-30 properties with contact info
- ✅ Daily automated sync running

---

## 📚 RELATED DOCUMENTATION

- **QUICKSTART_SCRAPING.md** - Quick reference
- **WORLD_CLASS_SCRAPING_IMPLEMENTATION.md** - Complete overview
- **JOB_CONTACT_ENHANCEMENT_COMPLETE.md** - Contact extraction details
- **PROPERTY_RENTAL_DEEP_SEARCH.md** - Property scraping
- **FINAL_DEPLOYMENT_STATUS.md** - Deployment summary

---

## 🎯 QUICK SUMMARY

1. ✅ Open Supabase Dashboard SQL Editor
2. ✅ Copy & paste migration 1 → Run
3. ✅ Copy & paste migration 2 → Run
4. ✅ Copy & paste migration 3 → Run
5. ✅ Verify: Check counts (25+ sources, 30+ sources)
6. ✅ Trigger scraping (Dashboard or cURL)
7. ✅ Monitor logs & check data
8. ✅ Wait 1-2 hours for initial results

**Dashboard URL**: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql

---

**Status**: ⏳ **ACTION REQUIRED - APPLY MIGRATIONS NOW**  
**Then**: 🚀 Trigger scraping & watch the data flow in!
