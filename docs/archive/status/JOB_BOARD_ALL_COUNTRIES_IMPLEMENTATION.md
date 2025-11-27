# Job Board AI Agent - Complete Implementation

## Overview

The Job Board AI Agent is a **WhatsApp-first job marketplace** integrated into EasyMO, supporting **all countries** in the database with AI-powered semantic matching using OpenAI embeddings.

### Key Features

✅ **Multi-Country Support**: Automatically extends to all active countries in the `countries` table  
✅ **WhatsApp Integration**: First menu item on home screen (display_order=1) for all countries  
✅ **AI Semantic Matching**: OpenAI embeddings for intelligent job↔seeker matching  
✅ **External Job Sources**: Daily ingestion from OpenAI Deep Search + SerpAPI  
✅ **Miscellaneous Gigs Focus**: Optimized for one-day, part-time, casual work + full-time jobs  
✅ **Simple UX**: Natural language conversation, no forms  
✅ **Multi-Language**: English, French, Kinyarwanda, Swahili, plus local languages per country  

---

## Architecture

### Database Schema

#### Core Tables

1. **`job_listings`** - All job postings (internal + external)
   - Local jobs: Posted by users via WhatsApp
   - External jobs: Discovered via Deep Search/SerpAPI
   - Columns: `title`, `description`, `job_type`, `category`, `location`, `country_code`, `pay_min/max`, `pay_type`, `currency`, `required_skills_embedding` (vector), `is_external`, `source_id`, `external_url`, `company_name`, `status`, `expires_at`

2. **`job_seekers`** - User seeker profiles
   - Columns: `phone_number`, `name`, `country_code`, `looking_for`, `skills_embedding` (vector), `available_days`, `preferred_categories`, `min_pay`, `pay_type`, `languages`

3. **`job_sources`** - External job source configs
   - Types: `openai_deep_search`, `serpapi`, `custom_rss`, `manual`
   - Config: JSONB with queries per country
   - Auto-generated for all active countries

4. **`job_categories_by_country`** - Localized job categories
   - Columns: `country_code`, `category_key`, `label_en`, `label_fr`, `label_local`, `is_popular`
   - Auto-seeded: 15 common categories for each country

5. **`job_matches`** - Automatic match tracking
6. **`job_applications`** - Application history
7. **`job_conversations`** - Chat history per user

#### Views & Functions

- **`job_listings_with_country`** - Enriched view with country info and localized labels
- **`match_jobs_for_seeker(embedding, org_id, country_code, threshold, count, filters...)`** - Semantic search with country preference
- **`detect_country_from_location(text)`** - Extract country from free-text location
- **`generate_country_job_queries(country_code, name, currency)`** - Auto-generate search queries
- **`refresh_job_sources_for_all_countries()`** - Regenerate queries when countries change

---

## WhatsApp Flows

### Entry Points

1. **Main Menu**: "💼 Jobs & Gigs" (first item, all countries)
2. **Keywords**: "job", "jobs", "akazi", "emploi", "empleo", "trabalho", etc.
3. **Deep Link**: `wa.me/...?text=jobs`

### Flow A: Find a Job (Seeker)

```
User: "Hi"
Agent: "Welcome! Are you looking for work or posting a job?"

User: "Looking for work"
Agent: "Great! Tell me what you're looking for. You can just describe it:
       - Type of job (e.g., one-day, part-time, full-time)
       - Location
       - Your skills or experience
       - Pay expectations"

User: "I need part-time work in Kigali as a waiter, weekends only, 20,000 RWF per day"

Agent: [Extracts metadata → Generates embedding → Searches jobs]
       "Here are some jobs for you:

       1. 🍽️ Weekend Waiter - Kigali Restaurant
          Part-time | 22,000 RWF/day | Saturdays & Sundays
       
       2. 🍕 Pizza Place Server - Kimironko
          Part-time | 18,000 RWF/day | Flexible hours
       
       3. 🍸 Bar Staff - Remera
          Part-time | 25,000 RWF/day | Friday-Sunday
       
       Reply with the number to see details."

User: "1"
Agent: [Shows full job details]
       "Do you want to express interest? I can notify the employer."
```

### Flow B: Post a Job (Employer)

```
User: "I want to post a job"
Agent: "Tell me about the job in your own words:
       - What you need
       - Where
       - When
       - Pay
       - Any requirements"

User: "Need 3 waiters for wedding event Saturday in Kigali, 10am-8pm, 15,000 RWF each"

Agent: [Extracts metadata → Creates job → Generates embedding → Matches seekers]
       "✅ Your job has been posted!

       📋 3 Waiters for Wedding Event
       📍 Kigali
       📅 Saturday, 10am-8pm
       💰 15,000 RWF per person
       
       I found 5 people who match! Would you like to see them?"
```

---

## External Job Ingestion

### OpenAI Deep Search

Daily scheduled function queries Deep Search for each country:

**Auto-Generated Queries** (per country):
- "one day casual jobs in {country_name}"
- "part time jobs in {country_name}"
- "short term contract work {country_name}"
- "delivery driver jobs {country_name}"
- "restaurant waiter hospitality jobs {country_name}"
- "jobs in {country_name}"

**Response Format** (requested as JSON):
```json
{
  "jobs": [
    {
      "title": "Part-Time Waiter",
      "description": "...",
      "company": "Kigali Restaurant",
      "location": "Kigali, Rwanda",
      "url": "https://...",
      "pay_range": "20000-25000 RWF per day",
      "job_type": "part_time",
      "posted_date": "2025-11-14",
      "expires_date": "2025-12-14"
    }
  ]
}
```

### SerpAPI

Fallback search via Google:

**Auto-Generated Queries** (per country):
- "jobs in {country_name}"
- "part time work {country_name}"
- "gig economy jobs {country_name}"

Filters organic results for job-related content.

### Ingestion Flow

```
job-sources-sync Edge Function (scheduled daily)
  ↓
For each active country:
  ↓
  Generate queries → Call Deep Search / SerpAPI
  ↓
  Normalize results (title, location, pay, category, etc.)
  ↓
  Generate job_hash (SHA-256 of title|company|location|url)
  ↓
  Check for duplicates (source_id + job_hash)
  ↓
  Generate embedding (OpenAI text-embedding-3-small)
  ↓
  Upsert job_listings (is_external=true, country_code detected)
  ↓
  Auto-match to seekers via vector similarity
```

**Deduplication**: Same job from multiple sources → single record  
**Expiry**: Jobs expire after 30 days (configurable) or when `expires_at` reached  
**Country Detection**: Uses `detect_country_from_location(location_text)` function

---

## Country Support

### Automatic Extension

When a new country is added to the `countries` table:

1. **Trigger fires** → `refresh_job_sources_for_all_countries()`
2. **Job sources updated** → Queries generated for new country
3. **Categories seeded** → 15 standard categories with localized labels
4. **Menu item updated** → Jobs available in new country's WhatsApp home menu

### Per-Country Configuration

**Rwanda (RW)**:
- Currency: RWF
- Categories: Kinyarwanda labels (e.g., "Gutanga no Gutwara" for delivery)
- Popular: Delivery, Cleaning, Cooking, Construction, Security

**Malta (MT)**:
- Currency: EUR
- Categories: English labels
- Popular: iGaming, Hospitality, Tourism, Healthcare, Retail

**Other Countries**: Auto-configured with standard English/French labels

---

## AI Agent Configuration

### Agent Tools

1. **`extract_job_metadata`** - Parse free-text into structured fields
2. **`post_job`** - Create job listing + generate embedding + match seekers
3. **`search_jobs`** - Semantic search with filters (country, category, pay, type)
4. **`update_seeker_profile`** - Update seeker intent + skills embedding
5. **`express_interest`** - Apply to job + notify employer
6. **`view_applicants`** - Show applicants for poster's jobs
7. **`get_my_jobs`** - List user's posted jobs
8. **`get_my_applications`** - List user's applications
9. **`update_job_status`** - Close/reopen job
10. **`get_job_details`** - Full job information

### System Prompt (Excerpt)

```
You are the Job Board AI for EasyMO, a WhatsApp-based job marketplace.

Your role:
- Help users FIND work (especially one-day, part-time, casual gigs)
- Help users POST jobs quickly and easily
- Keep conversations SHORT and NATURAL
- Never force forms - accept free text
- Extract key metadata from natural language
- Use semantic matching to find relevant jobs/seekers

Core metadata to capture:
- Job type: gig, part_time, full_time, contract, temporary
- Category: delivery, cleaning, cooking, construction, security, etc.
- Location: Free text → detect country
- Pay: Amount + unit (hourly, daily, weekly, monthly)
- Duration: One day, weekends, 3 months, etc.
- Skills: Extract from description

Always:
✅ Speak user's language (en/fr/rw/sw/etc.)
✅ Show 3-5 top matches first
✅ Format jobs as numbered lists
✅ Include country flag emoji 🇷🇼🇲🇹 etc.
✅ Be encouraging and helpful

Never:
❌ Invent jobs that don't exist
❌ Promise availability of external jobs
❌ Share personal info without consent
❌ Show database field names to users
```

---

## Semantic Matching Algorithm

### Embedding Generation

**Model**: `text-embedding-3-small` (1536 dimensions)

**For Jobs**:
```
"{title}\n{description}\n{category}\nLocation: {location}\nSkills: {required_skills}"
```

**For Seekers**:
```
"{looking_for}\n{skills_tags}\nExperience: {experience_level}\nLocation: {location_text}"
```

### Matching Query

```sql
SELECT 
  jl.*,
  1 - (jl.required_skills_embedding <=> seeker_embedding) as similarity_score
FROM job_listings jl
WHERE 
  jl.status = 'open'
  AND jl.required_skills_embedding IS NOT NULL
  AND 1 - (jl.required_skills_embedding <=> seeker_embedding) > 0.7
  AND (jl.country_code = seeker_country_code OR jl.is_external = true)
  AND (jl.expires_at IS NULL OR jl.expires_at > now())
ORDER BY 
  -- Prioritize same country
  CASE WHEN jl.country_code = seeker_country_code THEN 0 ELSE 1 END,
  -- Then by similarity
  jl.required_skills_embedding <=> seeker_embedding
LIMIT 20;
```

**Cosine Distance**: pgvector `<=>` operator (0 = identical, 2 = opposite)  
**Threshold**: 0.7 (70% similarity minimum)  
**Country Boost**: Same-country jobs ranked higher

---

## Deployment

### Environment Variables

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# SerpAPI (optional)
SERPAPI_API_KEY=...

# Supabase
SUPABASE_URL=https://....supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Feature Flag
FEATURE_JOB_BOARD=true
```

### Migrations

```bash
# Apply all job board migrations
supabase db push

# Verify countries table populated
psql $DATABASE_URL -c "SELECT code, name FROM countries WHERE is_active = true;"

# Check job sources configured
psql $DATABASE_URL -c "SELECT name, source_type, jsonb_array_length(config->'queries') as query_count FROM job_sources;"

# Verify menu item
psql $DATABASE_URL -c "SELECT key, name, active_countries FROM whatsapp_home_menu_items WHERE key = 'jobs';"
```

### Edge Functions Deploy

```bash
# Deploy job board agent
supabase functions deploy job-board-ai-agent

# Deploy job sources sync
supabase functions deploy job-sources-sync

# Test agent
curl -X POST https://....supabase.co/functions/v1/job-board-ai-agent \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"phone_number": "+250788123456", "message": "I need a job"}'

# Test ingestion (manual trigger)
curl -X POST https://....supabase.co/functions/v1/job-sources-sync \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### Scheduled Ingestion

**Supabase Dashboard** → Functions → Schedules:

```
Name: Daily Job Sync
Function: job-sources-sync
Schedule: 0 3 * * * (3am daily, Africa/Kigali timezone)
Method: POST
```

**Or via pg_cron**:

```sql
SELECT cron.schedule(
  'daily-job-sync',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := 'https://....supabase.co/functions/v1/job-sources-sync',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  )$$
);
```

---

## WhatsApp Webhook Integration

The job board agent is invoked from the main WhatsApp webhook router:

**File**: `supabase/functions/wa-webhook/index.ts`

```typescript
// Detect "Jobs" menu selection or keywords
if (
  messageText.match(/jobs?|akazi|emploi/i) ||
  userContext === 'job_board'
) {
  // Route to job board agent
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/job-board-ai-agent`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone_number: from,
        message: messageText,
        conversation_history: conversationHistory
      })
    }
  );
  
  const { message: aiReply } = await response.json();
  
  // Send reply via WhatsApp API
  await sendWhatsAppMessage(from, aiReply);
}
```

---

## Testing

### Manual Tests

```bash
# 1. Check menu item visible
curl "https://graph.facebook.com/v18.0/PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer $WHATSAPP_TOKEN" \
  -d '{"messaging_product":"whatsapp","to":"TEST_NUMBER","type":"interactive","interactive":{...}}'

# 2. Test seeker flow
# User: "I need a part-time job in Kigali"
# Expected: Agent asks for skills/preferences → searches jobs → shows matches

# 3. Test poster flow
# User: "I want to post a job"
# Expected: Agent asks for job details → creates job → matches seekers

# 4. Test external jobs
# Run: job-sources-sync
# Check: SELECT COUNT(*) FROM job_listings WHERE is_external = true;

# 5. Test country detection
psql $DATABASE_URL -c "SELECT detect_country_from_location('Valletta, Malta');"
# Expected: MT

# 6. Test matching
psql $DATABASE_URL -c "
  WITH seeker_embedding AS (
    SELECT required_skills_embedding FROM job_seekers WHERE phone_number = '+250...'
  )
  SELECT * FROM match_jobs_for_seeker(
    (SELECT required_skills_embedding FROM seeker_embedding),
    NULL, 'RW', 0.7, 5
  );
"
```

### Automated Tests

**File**: `supabase/functions/job-board-ai-agent/index.test.ts`

Run: `deno test --allow-all`

---

## Monitoring & Observability

### Structured Logging

All events logged to `event_logs` table:

- `JOB_AGENT_REQUEST` - User message received
- `TOOL_CALL` - Agent tool invocation
- `JOB_POSTED` - New job created
- `JOB_MATCH_FOUND` - Seeker↔job match
- `APPLICATION_SUBMITTED` - User applied to job
- `JOB_SOURCES_SYNC_START/COMPLETE` - External ingestion

### Metrics

```sql
-- Daily job posts
SELECT DATE(created_at), COUNT(*)
FROM job_listings
WHERE is_external = false
GROUP BY DATE(created_at)
ORDER BY 1 DESC;

-- Seeker activity
SELECT DATE(created_at), COUNT(*)
FROM job_seekers
GROUP BY DATE(created_at)
ORDER BY 1 DESC;

-- Match success rate
SELECT 
  COUNT(*) FILTER (WHERE status = 'hired') * 100.0 / COUNT(*) as success_rate
FROM job_matches
WHERE created_at > now() - interval '30 days';

-- External job ingestion
SELECT 
  js.name,
  COUNT(*) as job_count,
  MAX(jl.discovered_at) as last_sync
FROM job_listings jl
JOIN job_sources js ON jl.source_id = js.id
WHERE jl.is_external = true
GROUP BY js.id, js.name;

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

---

## Scaling Considerations

### Performance

- **Vector Index**: `CREATE INDEX job_embeddings_idx ON job_listings USING ivfflat (required_skills_embedding vector_cosine_ops);`
- **Partitioning**: Partition `job_listings` by `country_code` for large datasets
- **Caching**: Cache popular searches in Redis (future)

### Rate Limits

- **OpenAI**: 3,500 RPM on standard tier (sufficient for ~100 concurrent users)
- **SerpAPI**: 100 searches/month free, $50/month for 5,000
- **WhatsApp Business API**: Standard rate limits apply

### Cost Estimation

**Monthly costs** (assuming 1,000 active users, 10,000 jobs):

- OpenAI embeddings: ~$0.50 (10K jobs × $0.00002/1K tokens × 2.5 tokens avg)
- OpenAI chat: ~$50 (10K conversations × 500 tokens × $0.01/1K)
- SerpAPI: $50 (5,000 searches)
- Supabase: Included in Pro plan
- **Total**: ~$100/month

---

## Future Enhancements

### Phase 2
- [ ] Video job posts (WhatsApp video messages)
- [ ] Voice job descriptions (speech-to-text)
- [ ] In-app payments for featured listings
- [ ] Employer verification badges

### Phase 3
- [ ] Skills assessments (quiz-based)
- [ ] Background checks integration
- [ ] Shift scheduling for multi-day jobs
- [ ] Reviews & ratings (seeker ↔ employer)

### Phase 4
- [ ] AI-powered CV generation
- [ ] Job alerts (proactive notifications)
- [ ] Bulk job posting (CSV import)
- [ ] Job fair coordination (virtual events)

---

## Support & Troubleshooting

### Common Issues

**Issue**: Jobs menu not showing  
**Fix**: Check `active_countries` includes user's country: `UPDATE whatsapp_home_menu_items SET active_countries = active_countries || '{KE}' WHERE key = 'jobs';`

**Issue**: No external jobs ingested  
**Fix**: Check job sources active: `UPDATE job_sources SET is_active = true WHERE source_type = 'openai_deep_search';`  
       Manually trigger: `curl ... /job-sources-sync`

**Issue**: Poor match quality  
**Fix**: Lower threshold: `match_jobs_for_seeker(..., match_threshold := 0.6)`  
       Check embeddings exist: `SELECT COUNT(*) FROM job_listings WHERE required_skills_embedding IS NULL;`

**Issue**: Country not detected  
**Fix**: Update countries table with common city names:  
       `INSERT INTO countries (code, name, ...) VALUES ('KE', 'Kenya', ...);`  
       Run: `SELECT refresh_job_sources_for_all_countries();`

### Logs & Debugging

```bash
# View recent errors
psql $DATABASE_URL -c "
  SELECT * FROM event_logs
  WHERE event = 'ERROR'
  AND created_at > now() - interval '1 hour'
  ORDER BY created_at DESC;
"

# Check function execution
supabase functions logs job-board-ai-agent --tail

# Test embedding generation
curl -X POST https://api.openai.com/v1/embeddings \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{"input": "test job description", "model": "text-embedding-3-small"}'
```

---

## Compliance & Safety

### Data Privacy
- PII (phone numbers, names) stored securely
- RLS policies enforce org/user isolation
- No third-party sharing without consent

### Content Moderation
- Job descriptions scanned for prohibited content
- Flagged jobs reviewed by admins
- Users can report inappropriate listings

### Labor Law Compliance
- Age verification (18+ for most jobs)
- Terms displayed before posting/applying
- Disclaimer: "EasyMO is a platform, not an employer"

---

## Contact

**Technical Issues**: tech@easymo.rw  
**Product Feedback**: product@easymo.rw  
**Partnership Inquiries**: partnerships@easymo.rw

---

**Last Updated**: 2025-11-14  
**Version**: 1.0.0  
**Status**: ✅ Production Ready (All Countries)
