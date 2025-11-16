# Job Board AI Agent - Complete Implementation

## Overview
A WhatsApp-integrated AI-powered job marketplace that matches job seekers with opportunities using OpenAI embeddings and deep semantic search. Supports all countries in the system with automated external job ingestion.

## Features

### Core Capabilities
- **AI-Powered Matching**: Uses OpenAI embeddings (1536-dim vectors) for semantic job-seeker matching
- **Natural Conversations**: Free-text input - no rigid forms
- **Multi-Country Support**: Automatically covers all active countries in database
- **External Job Ingestion**: Daily sync from OpenAI Deep Search + SerpAPI
- **WhatsApp Native**: Fully integrated into WhatsApp flows with dynamic menus

### User Flows

#### 1. Find a Job (Job Seeker)
```
User: Types "Jobs" or clicks Jobs menu
→ Shows menu: Find Job | Post Job | My Applications | My Jobs
User: Clicks "Find a Job"
→ AI Agent: "Tell me what kind of work you're looking for..."
User: "I need one-day work Saturday in Kimironko, driver or loader, 10,000 RWF"
→ AI extracts metadata + generates embedding
→ Searches job_listings with semantic matching
→ Returns top 5-10 matches with details
User: Replies "1" to view job details
→ Agent: Shows full job + "Do you want to apply?"
User: "Yes"
→ Creates job_application record
→ Notifies job owner (optional)
```

#### 2. Post a Job (Job Owner)
```
User: Clicks "Post a Job"
→ AI Agent: "Tell me about the job..."
User: "Need waiter Saturday evening Remera, 10k RWF, 4 hours, English/French"
→ AI extracts:
   - title: "Waiter for Saturday evening event"
   - job_type: "one_day"
   - category: "cooking"
   - location: "Remera, Kigali"
   - pay_min/max: 10000
   - pay_type: "once"
   - required_skills: ["English", "French"]
→ Generates embedding
→ Inserts into job_listings
→ Immediately searches job_seekers for matches
→ Shows top 3-5 potential candidates
User: "Send message to candidate 1"
→ Notifies seeker via WhatsApp template
```

## Database Schema

### Tables Created
```sql
-- Job postings (local + external)
job_listings (
  id, source_id, title, description, company_name,
  location, country_code, category, job_type,
  pay_min, pay_max, pay_type, currency,
  status, posted_by, is_external, external_url,
  required_skills_embedding vector(1536),
  discovered_at, last_seen_at, expires_at, job_hash
)

-- Job seekers profiles
job_seekers (
  id, phone_number, country_code, profile_id,
  skills, preferred_categories, location,
  available_immediately, availability_details,
  min_pay_expectation, preferred_pay_type,
  skills_embedding vector(1536), last_active
)

-- Job applications
job_applications (
  id, job_id, seeker_id, status, applied_at,
  notes, contact_initiated_at
)

-- Conversations state
job_conversations (
  phone_number, role, messages, message_count,
  last_message_at, active_seeker_id, active_job_id
)

-- External job sources config
job_sources (
  id, name, source_type, base_url, config,
  is_active, last_sync_at
)

-- Country-specific job categories
job_categories_by_country (
  country_code, category_key, label_en, label_fr,
  label_local, is_popular, display_order
)
```

### Key Indexes
- `job_listings_embedding_idx` (vector ivfflat for fast similarity search)
- `job_seekers_embedding_idx` (vector ivfflat)
- `job_listings_country_code_idx`
- `job_seekers_country_code_idx`
- `job_applications_seeker_job_unique_idx` (prevent duplicate applications)

## Edge Functions

### 1. job-board-ai-agent
**Path**: `supabase/functions/job-board-ai-agent/`

Main agent endpoint that handles conversational interactions.

**Tools**:
- `extract_job_metadata`: Parses free-text into structured fields
- `post_job`: Creates job listing + matches seekers
- `search_jobs`: Finds jobs matching seeker intent
- `update_seeker_profile`: Updates/creates seeker profile with embedding
- `express_interest`: Applies to a job
- `view_applicants`: Shows applicants for job owner
- `get_my_jobs`: Lists user's posted jobs
- `get_my_applications`: Lists user's applications
- `update_job_status`: Open/close job
- `get_job_details`: Full job information

**Request**:
```json
{
  "phone_number": "+250788123456",
  "message": "I need part-time work in Kigali",
  "language": "en",
  "role": "job_seeker"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Here are jobs that match...",
  "tool_calls": [
    {"name": "search_jobs", "result": {...}}
  ]
}
```

### 2. job-sources-sync
**Path**: `supabase/functions/job-sources-sync/`

Daily scheduled function to ingest external jobs.

**Sources**:
1. **OpenAI Deep Search**: Structured queries per country/category
2. **SerpAPI**: Google job search results

**Process**:
```
For each active job_source:
  For each configured query:
    1. Call external API (Deep Search or SerpAPI)
    2. Parse results into normalized format
    3. Generate job_hash for deduplication
    4. Check if job exists (by source_id + job_hash)
    5. If new: Insert + generate embedding
    6. If exists: Update last_seen_at
```

**Schedule**: Daily at 03:00 local time (via Supabase Scheduled Functions or pg_cron)

**Request**:
```json
POST /functions/v1/job-sources-sync
Authorization: Bearer <service_role_key>
{}
```

**Response**:
```json
{
  "success": true,
  "stats": {
    "inserted": 45,
    "updated": 12,
    "skipped": 3,
    "errors": 0
  }
}
```

## WhatsApp Integration

### Menu Items
Added to `whatsapp_home_menu_items`:
```sql
key: 'jobs'
name: '💼 Jobs & Gigs'
label_en: 'Jobs & Gigs'
label_fr: 'Emplois & Petits Boulots'
label_rw: 'Imirimo n\'Akazi'
display_order: 1  -- First item on page 1
active_countries: ['RW', 'MT', ...all active countries]
```

### Routing
**File**: `supabase/functions/wa-webhook/domains/jobs/index.ts`

**Handlers**:
- `showJobBoardMenu()`: Main menu (Find | Post | My Apps | My Jobs)
- `startJobSearch()`: Initiates job seeker conversation
- `startJobPosting()`: Initiates job poster conversation
- `handleJobBoardText()`: Routes messages to AI agent
- `showMyApplications()`: Lists user's applications
- `showMyJobs()`: Lists user's posted jobs

**State Management**:
```typescript
state.key = "job_conversation"
state.data = {
  role: "job_seeker" | "job_poster",
  language: "en" | "fr" | "rw" | "sw",
  status: "active",
  startedAt: "2025-11-14T23:00:00Z"
}
```

### Translations
**Files**:
- `i18n/messages/jobs_en.json` (English)
- `i18n/messages/jobs_fr.json` (French)
- `i18n/messages/jobs_rw.json` (Kinyarwanda)

Merged into main `en.json` and `fr.json`.

**Key Phrases**:
- `jobs.menu.greeting`: Main menu welcome
- `jobs.seeker.welcome`: Job seeker onboarding
- `jobs.poster.welcome`: Job poster onboarding
- `jobs.type.*`: Job type labels (one_day, part_time, etc.)
- `jobs.status.*`: Application/job statuses

## Matching Algorithm

### Job Seeker → Jobs
```sql
SELECT *
FROM job_listings
WHERE 
  status = 'open'
  AND (expires_at IS NULL OR expires_at > now())
  AND (country_code = seeker_country OR is_external = true)
ORDER BY 
  CASE WHEN country_code = seeker_country THEN 0 ELSE 1 END,
  required_skills_embedding <=> seeker_embedding
LIMIT 20;
```

### Job → Seekers
```sql
SELECT *
FROM job_seekers
WHERE
  available_immediately = true
  AND (country_code = job_country OR country_code IS NULL)
  AND (min_pay_expectation IS NULL OR job_pay_max >= min_pay_expectation)
ORDER BY
  CASE WHEN country_code = job_country THEN 0 ELSE 1 END,
  skills_embedding <=> job_embedding
LIMIT 20;
```

**Similarity Threshold**: 0.7 (configurable)

**Distance Metric**: Cosine distance (`<=>` operator)

**Index**: IVFFlat with 100 lists (auto-maintained)

## Configuration

### Environment Variables
```bash
# Required
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Optional (for external ingestion)
SERPAPI_API_KEY=...
OPENAI_DEEPSEARCH_MODEL=gpt-4-turbo-preview

# Feature flags
FEATURE_JOB_BOARD=true
```

### Job Source Configuration
Auto-generated for all active countries:
```sql
SELECT * FROM job_sources WHERE source_type = 'openai_deep_search';
-- config: {
--   "queries": [
--     {"country": "RW", "city": "Kigali", "query": "one day casual jobs in Kigali", "kind": "one_day"},
--     {"country": "MT", "city": "Valletta", "query": "part time jobs in Valletta Malta", "kind": "part_time"},
--     ... (6 queries per country)
--   ]
-- }
```

## Deployment

### 1. Apply Migrations
```bash
cd /Users/jeanbosco/workspace/easymo-
supabase db push
```

Migrations:
- `20251114220000_job_board_system.sql` (core schema)
- `20251114232000_add_jobs_to_menu.sql` (menu item + Malta)
- `20251114233000_job_board_all_countries.sql` (all countries)

### 2. Deploy Edge Functions
```bash
# Job Board AI Agent
supabase functions deploy job-board-ai-agent

# Job Sources Sync
supabase functions deploy job-sources-sync
```

### 3. Set Up Scheduler
**Option A: Supabase Dashboard**
- Go to Database → Cron Jobs
- Create schedule: `0 3 * * *` (daily 03:00)
- HTTP endpoint: `/functions/v1/job-sources-sync`
- Method: POST
- Auth: Service role key

**Option B: pg_cron**
```sql
SELECT cron.schedule(
  'job-sources-daily-sync',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := 'https://PROJECT.supabase.co/functions/v1/job-sources-sync',
    headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb
  )$$
);
```

### 4. Verify Deployment
```bash
# Test agent
curl -X POST https://PROJECT.supabase.co/functions/v1/job-board-ai-agent \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"+250788123456","message":"I need work","language":"en","role":"job_seeker"}'

# Test sync
curl -X POST https://PROJECT.supabase.co/functions/v1/job-sources-sync \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# Check menu
psql $DATABASE_URL -c "SELECT * FROM whatsapp_home_menu_items WHERE key='jobs';"
```

## Monitoring

### Key Metrics
```sql
-- Total jobs (local + external)
SELECT COUNT(*), is_external, status FROM job_listings GROUP BY is_external, status;

-- Total seekers
SELECT COUNT(*), country_code FROM job_seekers GROUP BY country_code;

-- Applications
SELECT COUNT(*), status FROM job_applications GROUP BY status;

-- External sync stats
SELECT name, source_type, last_sync_at FROM job_sources;

-- Top categories per country
SELECT country_code, category, COUNT(*) 
FROM job_listings 
WHERE status='open' 
GROUP BY country_code, category 
ORDER BY country_code, COUNT(*) DESC;
```

### Logs
```bash
# Agent logs
supabase functions logs job-board-ai-agent --tail

# Sync logs
supabase functions logs job-sources-sync --tail
```

**Structured events**:
- `JOB_BOARD_MENU_SHOWN`
- `JOB_SEARCH_START`
- `JOB_POST_START`
- `JOB_AGENT_MESSAGE`
- `JOB_AGENT_TOOLS`
- `JOB_SOURCES_SYNC_START`
- `JOB_SOURCES_SYNC_COMPLETE`

## Testing

### Manual Tests
1. **WhatsApp Flow**:
   - Send "menu" to bot
   - Click "💼 Jobs & Gigs" (should be first item)
   - Click "🔍 Find a Job"
   - Type: "I need part-time work in Kigali, cleaning or office, 50k RWF/month"
   - Verify agent responds with matches

2. **Post Job**:
   - From Jobs menu, click "📝 Post a Job"
   - Type: "Need driver for Saturday in Remera, one day, 15k RWF"
   - Verify job is created and seekers are matched

3. **External Jobs**:
   - Trigger sync: `curl -X POST .../job-sources-sync ...`
   - Check: `SELECT * FROM job_listings WHERE is_external=true LIMIT 10;`
   - Search for external job as seeker

### Integration Tests
```bash
cd supabase/functions/job-board-ai-agent
deno test --allow-all index.test.ts
```

## Troubleshooting

### Agent Not Responding
1. Check logs: `supabase functions logs job-board-ai-agent --tail`
2. Verify OPENAI_API_KEY is set
3. Check conversation state: `SELECT * FROM job_conversations WHERE phone_number='+250...'`

### No Matches Returned
1. Check embeddings exist: `SELECT COUNT(*) FROM job_listings WHERE required_skills_embedding IS NOT NULL`
2. Lower similarity threshold in matching functions
3. Verify country_code is set on jobs/seekers

### External Sync Failing
1. Check API keys (SERPAPI_API_KEY)
2. Review logs: `supabase functions logs job-sources-sync`
3. Manually trigger: `curl -X POST .../job-sources-sync`
4. Check source config: `SELECT config FROM job_sources WHERE is_active=true`

### Menu Item Not Showing
1. Verify feature flag: `FEATURE_JOB_BOARD=true`
2. Check menu item: `SELECT * FROM whatsapp_home_menu_items WHERE key='jobs'`
3. Verify user's country is in `active_countries` array
4. Clear menu cache (if applicable)

## Performance

### Expected Response Times
- Agent message: 2-5 seconds (OpenAI + DB)
- Job search: <1 second (pgvector index)
- External sync: 5-10 minutes (depends on source count)

### Scaling Considerations
- **Embeddings**: IVFFlat index recommended for >100k jobs
- **Sync**: Consider parallel processing for 50+ countries
- **Conversations**: Archive old conversations (>30 days) to separate table

## Future Enhancements
- [ ] SMS notifications for matched jobs
- [ ] Skill verification (ratings/reviews)
- [ ] Video introductions (job seekers)
- [ ] In-app chat between seeker and poster
- [ ] Scheduled/recurring jobs (e.g., "every Saturday")
- [ ] Multi-language job postings
- [ ] Location-based ranking (geo distance)
- [ ] AI-powered interview scheduling

## Support
- Documentation: `docs/JOB_BOARD_QUICKSTART.md`
- Implementation summaries: `JOB_BOARD_*.md` files
- Ground rules: `docs/GROUND_RULES.md`

---
**Last Updated**: 2025-11-14
**Version**: 1.0
**Status**: ✅ Production Ready (All Countries)
