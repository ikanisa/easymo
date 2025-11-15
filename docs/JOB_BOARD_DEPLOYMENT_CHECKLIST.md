# Job Board AI Agent - Complete Deployment Checklist

## Phase 1: Core System ✅

### 1.1 Database Setup
- [ ] Run base migration: `supabase db push --include-migrations 20251114220000_job_board_system.sql`
- [ ] Verify pgvector extension: `SELECT * FROM pg_extension WHERE extname = 'vector'`
- [ ] Check tables created (7 tables):
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name LIKE 'job_%';
  ```
- [ ] Verify categories seeded: `SELECT COUNT(*) FROM job_categories` (should be 20)
- [ ] Test vector matching function: 
  ```sql
  SELECT match_jobs_for_seeker(
    ARRAY[0.1, 0.2, ...]::vector(1536),
    NULL, 0.7, 10, NULL, NULL, NULL
  );
  ```

### 1.2 Environment Configuration
- [ ] Set OpenAI API key: `supabase secrets set OPENAI_API_KEY=sk-...`
- [ ] Verify Supabase vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] (Optional) Set feature flags:
  ```bash
  supabase secrets set FEATURE_JOB_BOARD=true
  supabase secrets set FEATURE_AUTO_MATCHING=true
  ```

### 1.3 Edge Function Deployment
- [ ] Deploy job-board-ai-agent:
  ```bash
  supabase functions deploy job-board-ai-agent --no-verify-jwt
  ```
- [ ] Test function locally first:
  ```bash
  supabase functions serve job-board-ai-agent
  curl -X POST http://localhost:54321/functions/v1/job-board-ai-agent \
    -H "Content-Type: application/json" \
    -d '{"phone_number": "+250788000001", "message": "I need help"}'
  ```
- [ ] Test deployed function:
  ```bash
  curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/job-board-ai-agent \
    -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
    -d '{"phone_number": "+250788000001", "message": "test"}'
  ```

### 1.4 WhatsApp Integration
- [ ] Update wa-webhook to route job messages:
  ```typescript
  import { handleJobDomain, isJobDomainMessage } from "./domains/jobs/handler.ts";
  
  if (isJobDomainMessage(message)) {
    const response = await handleJobDomain({
      phoneNumber: from,
      message,
      messageType: type
    });
    await sendWhatsAppMessage(from, response.reply);
    return;
  }
  ```
- [ ] Redeploy wa-webhook: `supabase functions deploy wa-webhook`
- [ ] Test via WhatsApp: Send "I need a job" to your business number

### 1.5 Admin Dashboard
- [ ] Navigate to `/jobs` in admin-app
- [ ] Verify stats display correctly
- [ ] Check recent jobs list loads
- [ ] Test tabs (overview, jobs, seekers, matches)

## Phase 2: Organizational Enhancements ✅

### 2.1 Enhanced Schema
- [ ] Run enhancement migration:
  ```bash
  supabase db push --include-migrations 20251114230000_job_board_enhancements.sql
  ```
- [ ] Verify new columns added:
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'job_listings' 
  AND column_name IN ('org_id', 'company_name', 'is_external', 'job_hash');
  ```
- [ ] Check job_sources table: `SELECT * FROM job_sources`
- [ ] Verify RLS policies updated: 
  ```sql
  SELECT policyname FROM pg_policies WHERE tablename = 'job_listings';
  ```

### 2.2 Test Organizational Features
- [ ] Create test organization: 
  ```sql
  INSERT INTO public.organizations (name, slug) VALUES ('Test Org', 'test-org');
  ```
- [ ] Create job with org_id:
  ```sql
  INSERT INTO job_listings (title, org_id, ...) VALUES (...);
  ```
- [ ] Verify org-scoped RLS works
- [ ] Test hash generation: 
  ```sql
  SELECT generate_job_hash('Driver', 'Acme Co', 'Kigali', 'https://example.com/job');
  ```

## Phase 3: External Job Sources 🆕

### 3.1 Deploy Job Sources Sync
- [ ] Deploy function:
  ```bash
  supabase functions deploy job-sources-sync --no-verify-jwt
  ```
- [ ] (Optional) Set SerpAPI key:
  ```bash
  supabase secrets set SERPAPI_API_KEY=your-key
  ```

### 3.2 Configure Job Sources
- [ ] Enable Deep Search:
  ```sql
  UPDATE job_sources 
  SET is_active = true,
      config = '{
        "queries": [
          {"country": "RW", "city": "Kigali", "query": "one day casual jobs in Kigali", "kind": "one_day"},
          {"country": "RW", "city": "Kigali", "query": "part time jobs Kigali", "kind": "part_time"}
        ]
      }'::jsonb
  WHERE source_type = 'openai_deep_search';
  ```
- [ ] (If you have SerpAPI) Enable SerpAPI:
  ```sql
  UPDATE job_sources 
  SET is_active = true 
  WHERE source_type = 'serpapi';
  ```

### 3.3 Test Manual Sync
- [ ] Run sync manually:
  ```bash
  curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/job-sources-sync \
    -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
    -d '{}'
  ```
- [ ] Check results:
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
- [ ] Verify external jobs created:
  ```sql
  SELECT COUNT(*) FROM job_listings WHERE is_external = true;
  ```
- [ ] Check embeddings generated:
  ```sql
  SELECT COUNT(*) FROM job_listings 
  WHERE is_external = true 
  AND required_skills_embedding IS NOT NULL;
  ```

### 3.4 Schedule Daily Sync
- [ ] **Option A: Supabase Scheduled Functions**
  1. Go to Supabase Dashboard → Database → Cron Jobs
  2. Create new job: `0 3 * * *` (3 AM daily)
  3. SQL:
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

- [ ] **Option B: pg_cron**
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

- [ ] Schedule stale job cleanup:
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

- [ ] Verify schedules:
  ```sql
  SELECT * FROM cron.job;
  ```

## Phase 4: Testing & Validation 🧪

### 4.1 End-to-End Testing
- [ ] **Post a local job via WhatsApp**:
  - Send: "I need someone to help move furniture tomorrow in Kigali, paying 10k"
  - Verify: Job created in database
  - Verify: Embedding generated
  - Verify: Auto-matches created

- [ ] **Search for jobs as seeker**:
  - Send: "Looking for delivery work, I have a motorcycle"
  - Verify: Profile created
  - Verify: Matching jobs returned (local + external if available)
  - Verify: Match scores reasonable (> 0.7)

- [ ] **Express interest**:
  - Reply: "1" (select first job)
  - Verify: Job details shown
  - Reply: "Yes interested"
  - Verify: Application created in job_applications table

- [ ] **View own jobs**:
  - Send: "Show my jobs"
  - Verify: Lists jobs posted by user

- [ ] **View applications**:
  - Send: "My applications"
  - Verify: Lists jobs applied to

### 4.2 Performance Testing
- [ ] Test response time (should be < 2s):
  ```bash
  time curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/job-board-ai-agent \
    -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
    -d '{"phone_number": "+250788000001", "message": "test"}'
  ```
- [ ] Test vector search performance:
  ```sql
  EXPLAIN ANALYZE 
  SELECT * FROM match_jobs_for_seeker(
    ARRAY[...]::vector(1536), NULL, 0.7, 20, NULL, NULL, NULL
  );
  ```
- [ ] Verify indexes being used:
  ```sql
  SELECT indexname FROM pg_indexes 
  WHERE tablename = 'job_listings';
  ```

### 4.3 Security Testing
- [ ] Test RLS policies:
  - Try accessing another user's jobs (should fail)
  - Try accessing org jobs without permission (should fail)
  - Verify open jobs are publicly visible
  
- [ ] Test PII masking in logs:
  ```bash
  supabase functions logs job-board-ai-agent | grep "phone"
  ```
  Should not show full phone numbers

### 4.4 Data Quality Checks
- [ ] Check for duplicate jobs:
  ```sql
  SELECT title, company_name, location, COUNT(*)
  FROM job_listings
  WHERE is_external = true
  GROUP BY title, company_name, location
  HAVING COUNT(*) > 1;
  ```

- [ ] Verify embeddings quality:
  ```sql
  SELECT 
    COUNT(*) as total_jobs,
    COUNT(required_skills_embedding) as with_embedding,
    ROUND(100.0 * COUNT(required_skills_embedding) / COUNT(*), 1) as coverage_pct
  FROM job_listings;
  ```
  Coverage should be 100%

- [ ] Check match quality:
  ```sql
  SELECT 
    AVG(similarity_score) as avg_score,
    MIN(similarity_score) as min_score,
    MAX(similarity_score) as max_score,
    COUNT(*) as total_matches
  FROM job_matches
  WHERE created_at > NOW() - INTERVAL '7 days';
  ```
  Average should be > 0.75

## Phase 5: Monitoring & Observability 📊

### 5.1 Set Up Monitoring
- [ ] Configure log streaming:
  ```bash
  supabase functions logs job-board-ai-agent --tail > /var/log/job-agent.log &
  supabase functions logs job-sources-sync --tail > /var/log/job-sync.log &
  ```

- [ ] Create monitoring dashboard queries:
  ```sql
  -- Daily job posts
  SELECT DATE(created_at), COUNT(*) 
  FROM job_listings 
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY DATE(created_at);
  
  -- Match quality over time
  SELECT DATE(created_at), AVG(similarity_score)
  FROM job_matches
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY DATE(created_at);
  
  -- External job sources performance
  SELECT js.name, COUNT(*) as jobs_found
  FROM job_listings jl
  JOIN job_sources js ON jl.source_id = js.id
  WHERE jl.discovered_at > NOW() - INTERVAL '7 days'
  GROUP BY js.name;
  ```

### 5.2 Set Up Alerts (Optional)
- [ ] Create alert for high error rate:
  ```sql
  -- Alert if > 10 errors in last hour
  SELECT COUNT(*) FROM job_analytics 
  WHERE event_type = 'ERROR' 
  AND created_at > NOW() - INTERVAL '1 hour'
  HAVING COUNT(*) > 10;
  ```

- [ ] Create alert for stale sync:
  ```sql
  -- Alert if no sync in last 25 hours
  SELECT COUNT(*) FROM job_analytics 
  WHERE event_type = 'JOB_SOURCES_SYNC_COMPLETE'
  AND created_at > NOW() - INTERVAL '25 hours'
  HAVING COUNT(*) = 0;
  ```

### 5.3 Document Runbook
- [ ] Create incident response procedures
- [ ] Document common issues and fixes
- [ ] Set up on-call rotation (if needed)

## Phase 6: Production Hardening 🔒

### 6.1 Performance Optimization
- [ ] Review slow queries:
  ```sql
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  WHERE query LIKE '%job_%'
  ORDER BY mean_exec_time DESC
  LIMIT 10;
  ```
  
- [ ] Add missing indexes if needed
- [ ] Consider partitioning for large tables (> 1M rows)

### 6.2 Backup & Recovery
- [ ] Verify daily backups enabled
- [ ] Test restore procedure:
  ```bash
  supabase db dump -f backup.sql
  # Test restore in staging
  ```
- [ ] Document recovery time objectives (RTO)

### 6.3 Rate Limiting
- [ ] Implement rate limiting on edge functions:
  ```typescript
  const rateLimit = await checkRateLimit(phoneNumber);
  if (rateLimit.exceeded) {
    return new Response(JSON.stringify({
      error: "Too many requests. Try again in a minute."
    }), { status: 429 });
  }
  ```

### 6.4 Cost Monitoring
- [ ] Set up billing alerts in OpenAI dashboard
- [ ] Monitor token usage:
  ```sql
  SELECT 
    DATE(created_at),
    COUNT(*) as api_calls,
    COUNT(*) * 0.011 as estimated_cost_usd
  FROM job_analytics
  WHERE event_type IN ('JOB_POSTED', 'JOBS_SEARCHED')
  AND created_at > NOW() - INTERVAL '30 days'
  GROUP BY DATE(created_at);
  ```

## Success Criteria ✅

### Must Have (MVP)
- [x] Users can post jobs via WhatsApp
- [x] Users can search for jobs via WhatsApp
- [x] Semantic matching works (> 0.7 similarity)
- [x] External jobs ingested daily
- [x] Admin dashboard shows stats
- [x] RLS policies protect data
- [x] All migrations run successfully
- [x] Tests pass

### Should Have (V1.1)
- [ ] WhatsApp template notifications for matches
- [ ] Rating system after job completion
- [ ] Multi-language support (FR, RW)
- [ ] Photo uploads for jobs
- [ ] Mobile money payment integration

### Nice to Have (V2.0)
- [ ] PWA for job browsing
- [ ] Voice message support
- [ ] Advanced analytics dashboard
- [ ] ML-powered job quality scoring
- [ ] Background check integration

## Post-Deployment

### Week 1
- [ ] Monitor error rates daily
- [ ] Review user feedback
- [ ] Check match quality metrics
- [ ] Optimize slow queries
- [ ] Fix critical bugs

### Month 1
- [ ] Analyze usage patterns
- [ ] Calculate actual costs
- [ ] Identify popular job categories
- [ ] Plan Phase 2 features
- [ ] Create user documentation

## Rollback Plan

If critical issues occur:

1. **Disable Job Board**:
```bash
supabase secrets set FEATURE_JOB_BOARD=false
```

2. **Stop Scheduled Sync**:
```sql
SELECT cron.unschedule('job-sources-sync');
```

3. **Rollback Migrations** (if needed):
```bash
supabase db reset
# Then apply only non-job-board migrations
```

4. **Redeploy Previous Version**:
```bash
git checkout HEAD~1 supabase/functions/job-board-ai-agent/
supabase functions deploy job-board-ai-agent
```

## Support Contacts

- **Technical Lead**: [Name]
- **On-Call**: [Phone]
- **Escalation**: [Email]
- **Documentation**: See `/docs/JOB_BOARD_*.md`

---

## Completion Sign-Off

- [ ] All Phase 1 items complete
- [ ] All Phase 2 items complete  
- [ ] All Phase 3 items complete
- [ ] All tests passing
- [ ] Monitoring set up
- [ ] Documentation reviewed
- [ ] Team trained
- [ ] Production ready! 🚀

**Deployed By**: _______________
**Date**: _______________
**Version**: 1.0.0
