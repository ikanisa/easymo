# Job Board AI Agent - Quick Start Guide

## 🚀 Ready to Use!

The Job Board AI Agent is **LIVE** and ready for users in **ALL countries**.

---

## For Users (WhatsApp)

### Finding a Job

1. Send **"menu"** to the bot
2. Click **💼 Jobs & Gigs** (first item)
3. Click **🔍 Find a Job**
4. Describe what you want naturally:
   ```
   "I need part-time work in Kigali, cleaning or office, 50k RWF/month"
   ```
5. AI will show you matching jobs
6. Reply with the number to apply

### Posting a Job

1. Send **"menu"** → **💼 Jobs & Gigs**
2. Click **📝 Post a Job**
3. Describe your job naturally:
   ```
   "Need waiter Saturday evening Remera, 10k RWF for 4 hours"
   ```
4. AI will create the listing
5. See matched candidates instantly

### View Applications & Jobs

- **📋 My Applications**: See jobs you've applied to
- **💼 My Posted Jobs**: See your listings and applicants

---

## For Admins

### Testing the Deployment

```bash
# 1. Test AI agent
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/job-board-ai-agent \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+250788123456",
    "message": "I need work",
    "language": "en",
    "role": "job_seeker"
  }'

# 2. Check menu item
supabase db execute \
  "SELECT * FROM whatsapp_home_menu_items WHERE key='jobs';"

# 3. Watch logs
supabase functions logs job-board-ai-agent --tail
```

### Completing Setup (Optional - External Jobs)

1. **Add SerpAPI Key**:
   - Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/settings/functions
   - Add secret: `SERPAPI_API_KEY = your_key`

2. **Set Up Daily Sync**:
   - Go to: Database → Cron Jobs → Create
   - Schedule: `0 3 * * *`
   - URL: `/functions/v1/job-sources-sync`
   - Method: POST
   - Add Authorization header

3. **Trigger First Sync**:
   ```bash
   curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/job-sources-sync \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
   ```

---

## For Developers

### File Locations

**Core Logic**:
- `supabase/functions/job-board-ai-agent/` - AI agent
- `supabase/functions/job-sources-sync/` - External sync
- `supabase/functions/wa-webhook/domains/jobs/` - WhatsApp integration

**Database**:
- `supabase/migrations/20251114220000_job_board_system.sql`
- `supabase/migrations/20251114233000_job_board_all_countries.sql`

**Translations**:
- `supabase/functions/wa-webhook/i18n/messages/en.json`
- `supabase/functions/wa-webhook/i18n/messages/fr.json`
- `supabase/functions/wa-webhook/i18n/messages/jobs_rw.json`

### Key Tables

```sql
job_listings          -- Jobs (local + external)
job_seekers           -- Seeker profiles
job_applications      -- Applications tracker
job_conversations     -- WhatsApp state
job_sources           -- External source config
job_categories_by_country -- Localized categories
```

### Monitoring

```bash
# Real-time logs
supabase functions logs job-board-ai-agent --tail
supabase functions logs wa-webhook --tail | grep JOB

# Check stats
psql $DATABASE_URL -c "
SELECT 
  (SELECT COUNT(*) FROM job_listings) as jobs,
  (SELECT COUNT(*) FROM job_seekers) as seekers,
  (SELECT COUNT(*) FROM job_applications) as applications;
"
```

---

## Troubleshooting

### Agent Not Responding
1. Check logs: `supabase functions logs job-board-ai-agent --tail`
2. Verify OPENAI_API_KEY is set
3. Check state: `SELECT * FROM job_conversations WHERE phone_number='+...'`

### No Matches Found
1. Check embeddings: `SELECT COUNT(*) FROM job_listings WHERE required_skills_embedding IS NOT NULL`
2. Lower threshold in matching functions (currently 0.7)
3. Verify country_code: `SELECT country_code, COUNT(*) FROM job_listings GROUP BY country_code`

### Menu Not Showing
1. Check feature flag: `FEATURE_JOB_BOARD=true`
2. Verify menu: `SELECT * FROM whatsapp_home_menu_items WHERE key='jobs'`
3. Check user's country in active_countries array

---

## Architecture Overview

```
WhatsApp → wa-webhook → domains/jobs → job-board-ai-agent
                                      ↓
                              PostgreSQL + pgvector
                                      ↑
                              job-sources-sync (daily)
                                      ↑
                          OpenAI Deep Search + SerpAPI
```

---

## Features

✅ **Natural Language**: No rigid forms, just chat  
✅ **AI-Powered**: OpenAI GPT-4 + embeddings  
✅ **Multi-Country**: ALL active countries  
✅ **Multi-Language**: EN, FR, RW  
✅ **Semantic Matching**: Finds jobs by meaning, not keywords  
✅ **External Jobs**: Daily sync from job boards (optional)  
✅ **One-Click Apply**: Simple for users  
✅ **Instant Matching**: See candidates/jobs immediately  

---

## Support

**Documentation**:
- Full Implementation: `JOB_BOARD_FULL_IMPLEMENTATION.md`
- Deployment Details: `JOB_BOARD_DEPLOYMENT_COMPLETE.md`
- Visual Diagram: `JOB_BOARD_VISUAL_COMPLETE.txt`
- Status: `JOB_BOARD_DEPLOYMENT_STATUS.md`

**Ground Rules**: `docs/GROUND_RULES.md`

**Dashboard**: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt

---

## Status

🟢 **PRODUCTION READY**

All core features work. External job scraping is optional enhancement (requires SerpAPI key).

**Deployed**: 2025-11-14 23:30 UTC  
**Version**: 1.0.0  
**Ready for**: Real users NOW!

---

_Simple. Natural. Powerful._
