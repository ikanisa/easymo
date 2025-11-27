# 🚀 QUICK START: World-Class Job & Property Scraping

## TL;DR
Your job board had **14 jobs** → Will have **100+ jobs** after deployment.  
**25+ job sources** + **20+ property sources** configured for Malta & Rwanda.

---

## 🎯 ONE-LINE DEPLOYMENT

```bash
./deploy-comprehensive-scraping.sh
```

---

## 📋 WHAT IT DOES

### Jobs (25+ Sources) - **ALL CONTACT INFO INCLUDED** 📞
- **Malta**: JobsPlus, LinkedIn, KeepMePosted, Indeed, iGaming boards, Google Jobs, etc.
- **Rwanda**: MyJobsinRwanda, BrighterMonday, LinkedIn, Akazi Kanoze, casual jobs, etc.
- **🎯 CONTACTS**: Phone, Email, WhatsApp, LinkedIn, Facebook, Website extracted!

### Properties (30+ Sources) - **ALL HAVE CONTACTS** 📞
- **Malta**: Property.com.mt, Frank Salt, Remax, Dhalia, Perry, Century 21, Airbnb, etc.
- **Rwanda**: House.co.rw, RealEstate.co.rw, Housing Authority, Expat Housing, etc.
- **🎯 CRITICAL**: Every property has WhatsApp/phone contact for direct messaging!

### Automation
- **Daily Sync**: 2 AM UTC (jobs), 3 AM UTC (properties)
- **AI-Powered**: GPT-4o + SerpAPI + Econfary API
- **Deduplication**: Content hashing
- **Validation**: Contact info required

---

## ✅ PRE-DEPLOYMENT CHECKLIST

```bash
# Required secrets (check with: supabase secrets list)
✅ OPENAI_API_KEY          # From: https://platform.openai.com/api-keys
✅ SERPAPI_API_KEY         # From: https://serpapi.com/users/sign_up
✅ SUPABASE_URL            # From: Supabase Dashboard → Settings → API
✅ SUPABASE_SERVICE_ROLE_KEY  # From: Supabase Dashboard → Settings → API
```

Set missing secrets:
```bash
supabase secrets set OPENAI_API_KEY='sk-...'
supabase secrets set SERPAPI_API_KEY='...'
```

---

## 📊 MONITORING COMMANDS

### Check Job Count
```sql
SELECT COUNT(*) FROM job_listings WHERE is_external = true;
-- Expected: 50+ after first sync, 100+ after week 1
```

### Check Property Count
```sql
SELECT COUNT(*) FROM researched_properties WHERE status = 'active';
-- Expected: 20+ after first sync, 50+ after week 1
```

### View Recent Jobs
```sql
SELECT title, company_name, location, discovered_at 
FROM job_listings 
WHERE is_external = true 
ORDER BY discovered_at DESC 
LIMIT 10;
```

### Check for Errors
```sql
SELECT * FROM observability_logs 
WHERE event LIKE '%ERROR%' 
ORDER BY timestamp DESC 
LIMIT 10;
```

### View Source Performance
```sql
SELECT 
  js.name,
  COUNT(jl.id) as job_count
FROM job_sources js
LEFT JOIN job_listings jl ON jl.source_id = js.id
GROUP BY js.id, js.name
ORDER BY job_count DESC;
```

---

## 🔧 MANUAL TRIGGERS (If Needed)

### Trigger Job Sync
```bash
supabase functions invoke job-sources-sync --method POST --body '{}'
```

### Trigger Property Sync
```bash
supabase functions invoke openai-deep-research --method POST --body '{"action":"sync_all"}'
```

---

## 🎯 SUCCESS TARGETS

### Week 1
- ✅ 100+ jobs
- ✅ 50+ properties
- ✅ Both countries represented

### Steady State
- ✅ 200-300+ jobs
- ✅ 100-150+ properties
- ✅ 20-50 new jobs/day
- ✅ 10-20 new properties/day

---

## 🆘 TROUBLESHOOTING

### Still only 14 jobs?
```bash
# Check sources enabled
supabase db execute "SELECT name, is_active FROM job_sources;"

# Manual sync
supabase functions invoke job-sources-sync --method POST --body '{}'

# Check logs
supabase functions logs job-sources-sync --limit 50
```

### SerpAPI errors?
```bash
# Check key
supabase secrets list | grep SERPAPI

# Set if missing
supabase secrets set SERPAPI_API_KEY='...'
```

### No automated runs?
```sql
-- Check pg_cron
SELECT * FROM cron.job WHERE jobname LIKE '%sources-sync%';

-- Re-apply migrations if missing
```

---

## 📚 FULL DOCUMENTATION

- **Implementation Guide**: `/WORLD_CLASS_SCRAPING_IMPLEMENTATION.md`
- **Job Board Details**: `/supabase/functions/job-sources-sync/COMPREHENSIVE_JOB_BOARD_IMPLEMENTATION.md`
- **Property Rental Details**: `/PROPERTY_RENTAL_DEEP_SEARCH.md` ⭐
- **Deployment Script**: `/deploy-comprehensive-scraping.sh`

---

## 🎉 READY TO DEPLOY?

```bash
cd /Users/jeanbosco/workspace/easymo-
./deploy-comprehensive-scraping.sh
```

**⏱️ Takes 5-10 minutes**  
**🎯 Results**: 100+ jobs within 24 hours

---

**Status**: ✅ Production Ready  
**Last Updated**: 2025-01-15  
**Next Action**: Run deployment script ↑
