# Job Board AI Agent - Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Setup

Ensure these environment variables are set:

```bash
# OpenAI (required for embeddings and chat)
OPENAI_API_KEY=sk-proj-...

# Supabase (auto-configured in edge functions)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
SUPABASE_ANON_KEY=eyJhbG...

# Optional: Feature flags
FEATURE_JOB_BOARD=true
FEATURE_AUTO_MATCHING=true
```

### 2. Dependencies

**Required**:
- Supabase CLI ≥1.110.0
- pnpm ≥10.18.3 (for building packages)
- Node.js 20+
- Deno 2.x (for edge functions)

**Verify**:
```bash
supabase --version
pnpm --version
node --version
deno --version
```

## Deployment Steps

### Step 1: Database Migration

```bash
cd /Users/jeanbosco/workspace/easymo-

# Dry run (check SQL)
supabase db diff --file supabase/migrations/20251114220000_job_board_system.sql

# Apply migration
supabase db push

# Verify tables created
supabase db run \
  "SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name LIKE 'job_%'"
```

**Expected Output**:
```
job_listings
job_seekers
job_matches
job_conversations
job_applications
job_analytics
job_categories
```

### Step 2: Verify pgvector Extension

```bash
supabase db run "SELECT * FROM pg_extension WHERE extname = 'vector'"
```

If not installed:
```bash
supabase db run "CREATE EXTENSION IF NOT EXISTS vector"
```

### Step 3: Seed Categories (Optional)

Categories are auto-seeded in migration. Verify:

```bash
supabase db run "SELECT name, icon, typical_pay_range FROM job_categories ORDER BY name"
```

Should show 20 categories (construction, delivery, cleaning, etc.)

### Step 4: Deploy Edge Function

```bash
# Deploy with secrets
supabase functions deploy job-board-ai-agent \
  --no-verify-jwt

# Verify deployment
supabase functions list
```

**Output should include**:
```
job-board-ai-agent   deployed   https://...supabase.co/functions/v1/job-board-ai-agent
```

### Step 5: Set Secrets

```bash
# OpenAI API key
supabase secrets set OPENAI_API_KEY=sk-proj-...

# Verify
supabase secrets list
```

### Step 6: Test Edge Function

```bash
# Test health endpoint (if implemented)
curl https://your-project.supabase.co/functions/v1/job-board-ai-agent/health

# Test with sample request
curl -X POST https://your-project.supabase.co/functions/v1/job-board-ai-agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{
    "phone_number": "+250788000001",
    "message": "I need help with test job posting"
  }'
```

**Expected**: JSON response with AI message

### Step 7: Deploy WhatsApp Webhook Update

The wa-webhook function needs to route job messages. Update router:

```typescript
// supabase/functions/wa-webhook/router/index.ts
import { handleJobDomain, isJobDomainMessage } from "../domains/jobs/handler.ts";

// In message routing logic:
if (isJobDomainMessage(message)) {
  const response = await handleJobDomain({
    phoneNumber: from,
    message,
    messageType: type
  });
  return response;
}
```

Then redeploy:
```bash
supabase functions deploy wa-webhook
```

### Step 8: Deploy Admin Dashboard

```bash
cd admin-app

# Install dependencies (if needed)
npm ci

# Build
npm run build

# Deploy (example: Vercel)
vercel --prod

# Or Netlify
netlify deploy --prod
```

### Step 9: Verify End-to-End

1. **Send WhatsApp Message**:
   ```
   To: Your WhatsApp Business Number
   Message: "I need a delivery driver for tomorrow"
   ```

2. **Check Logs**:
   ```bash
   supabase functions logs job-board-ai-agent --tail
   ```

3. **Verify Database**:
   ```bash
   supabase db run \
     "SELECT id, title, category, status FROM job_listings 
      ORDER BY created_at DESC LIMIT 5"
   ```

4. **Check Admin Dashboard**:
   - Navigate to: `https://your-admin-url.com/jobs`
   - Should show stats and recent jobs

## Post-Deployment Verification

### Database Checks

```sql
-- Check embeddings are being generated
SELECT 
  id, 
  title, 
  required_skills_embedding IS NOT NULL as has_embedding 
FROM job_listings 
LIMIT 5;

-- Check matches are being created
SELECT COUNT(*) as total_matches FROM job_matches;

-- Check RLS is active
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'job_%';
```

All should show `rowsecurity = true`.

### Function Checks

```sql
-- Verify vector search function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('match_jobs_for_seeker', 'match_seekers_for_job');
```

### Performance Checks

```bash
# Check function response time
time curl -X POST https://your-project.supabase.co/functions/v1/job-board-ai-agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"phone_number": "+250788000001", "message": "test"}'
```

Should complete in < 2 seconds.

## Monitoring Setup

### 1. Enable Structured Logging

Already implemented in code. View logs:

```bash
# Real-time
supabase functions logs job-board-ai-agent --tail

# Filter by event
supabase functions logs job-board-ai-agent | grep "JOB_POSTED"

# Last hour
supabase functions logs job-board-ai-agent --since 1h
```

### 2. Set Up Alerts (Optional)

Create database trigger for critical events:

```sql
CREATE OR REPLACE FUNCTION notify_job_posted()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('job_posted', 
    json_build_object(
      'job_id', NEW.id,
      'category', NEW.category,
      'posted_by', NEW.posted_by
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_posted_notification
AFTER INSERT ON job_listings
FOR EACH ROW
EXECUTE FUNCTION notify_job_posted();
```

### 3. Analytics Queries

Save these for regular monitoring:

```sql
-- Daily job posts
SELECT 
  DATE(created_at) as date,
  COUNT(*) as jobs_posted,
  COUNT(DISTINCT posted_by) as unique_posters
FROM job_listings
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Match quality
SELECT 
  AVG(similarity_score) as avg_score,
  COUNT(*) FILTER (WHERE similarity_score > 0.8) as high_quality,
  COUNT(*) FILTER (WHERE similarity_score > 0.7) as medium_quality
FROM job_matches
WHERE created_at > NOW() - INTERVAL '7 days';

-- Popular categories
SELECT 
  category,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (COALESCE(filled_at, NOW()) - created_at)) / 86400) as avg_days_to_fill
FROM job_listings
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY category
ORDER BY count DESC
LIMIT 10;
```

## Rollback Plan

If issues occur:

### 1. Rollback Database

```bash
# Create backup first
supabase db dump -f backup_before_rollback.sql

# Rollback migration
supabase db reset
supabase db push --exclude-migrations 20251114220000_job_board_system.sql
```

### 2. Rollback Edge Function

```bash
# Undeploy function
supabase functions delete job-board-ai-agent

# Or deploy previous version
git checkout HEAD~1 supabase/functions/job-board-ai-agent/
supabase functions deploy job-board-ai-agent
```

### 3. Disable Feature Flag

```bash
supabase secrets set FEATURE_JOB_BOARD=false
```

Update wa-webhook to skip job routing:

```typescript
if (Deno.env.get("FEATURE_JOB_BOARD") !== "true") {
  return fallbackResponse();
}
```

## Troubleshooting

### Issue: Function times out

**Cause**: OpenAI API slow or rate limited

**Fix**:
1. Check OpenAI API status
2. Increase function timeout (default 60s)
3. Add retry logic for API calls

### Issue: No matches created

**Cause**: Embeddings not generated

**Check**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE required_skills_embedding IS NOT NULL) as with_embedding,
  COUNT(*) as total
FROM job_listings;
```

**Fix**: Regenerate embeddings for existing jobs:
```typescript
// Run as admin script
const jobs = await supabase.from('job_listings')
  .select('*')
  .is('required_skills_embedding', null);

for (const job of jobs.data) {
  const embedding = await generateEmbedding(openai, jobText);
  await supabase.from('job_listings')
    .update({ required_skills_embedding: embedding })
    .eq('id', job.id);
}
```

### Issue: RLS blocks queries

**Cause**: Missing auth context

**Fix**: Ensure using service role key in edge function (already done)

### Issue: High costs

**Check**:
```sql
-- Count API calls (rough estimate)
SELECT 
  DATE(created_at),
  COUNT(*) as embedding_calls
FROM job_listings
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at);
```

**Optimize**:
- Batch embeddings (OpenAI supports arrays)
- Cache common searches
- Use cheaper model (text-embedding-3-small already used)

## Cost Estimation

### OpenAI Costs (text-embedding-3-small)

- **Per 1M tokens**: $0.02
- **Average job**: ~100 tokens = $0.000002 per job
- **Average seeker**: ~50 tokens = $0.000001 per profile
- **1000 jobs + 1000 seekers**: ~$0.003 (less than 1 cent!)

### OpenAI Costs (GPT-4 Turbo)

- **Per 1M input tokens**: $10
- **Per 1M output tokens**: $30
- **Average conversation**: 500 input + 200 output = $0.011
- **1000 conversations/month**: ~$11

### Supabase Costs

- **Database**: Included in plan
- **Edge Functions**: 500K invocations free, then $2 per million
- **Storage**: Minimal (text data only)

**Total estimated cost for 1000 users**: ~$15-20/month

## Success Metrics

Monitor these post-deployment:

- **Job Post Rate**: Jobs per day
- **Match Quality**: Avg similarity score
- **Fill Rate**: % of jobs filled
- **Time to Fill**: Avg days from post to filled
- **User Engagement**: Messages per user
- **Function Performance**: P95 latency < 2s
- **Error Rate**: < 1%

## Support

**Logs Location**:
- Edge function: `supabase functions logs job-board-ai-agent`
- Database: `SELECT * FROM job_analytics ORDER BY created_at DESC`

**Common Queries**:
- Recent errors: `SELECT * FROM job_analytics WHERE event_type = 'ERROR' ORDER BY created_at DESC LIMIT 10`
- User activity: `SELECT phone_number, COUNT(*) FROM job_conversations GROUP BY phone_number ORDER BY COUNT(*) DESC`

**Contact**: See main project README for support channels

---

**Deployment Checklist**: ✅ Complete this guide step-by-step before marking as deployed
