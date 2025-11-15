# 🗄️ Job Board Database Schema

Complete reference for all job board tables, columns, and relationships.

---

## 📊 Overview

**Total Tables**: 8 core + 1 partitioned  
**Total Columns**: 150+  
**Vector Embeddings**: 5 columns (1536 dimensions)  
**RLS Policies**: Enabled on all tables  
**Created**: November 14, 2025

---

## 📋 Table of Contents

1. [Core Tables](#core-tables)
   - [job_listings](#1-job_listings)
   - [job_seekers](#2-job_seekers)
   - [job_matches](#3-job_matches)
   - [job_conversations](#4-job_conversations)
   - [job_applications](#5-job_applications)
2. [Analytics & Configuration](#analytics--configuration)
   - [job_analytics](#6-job_analytics)
   - [job_categories](#7-job_categories)
   - [job_sources](#8-job_sources)
3. [Enums](#enums)
4. [Indexes](#indexes)
5. [RLS Policies](#rls-policies)
6. [Functions & RPCs](#functions--rpcs)

---

## Core Tables

### 1. job_listings

Main table for job postings (both local and external).

**Columns**:

```sql
id                      uuid PRIMARY KEY
posted_by               text NOT NULL              -- WhatsApp phone number
poster_name             text

-- Job Details
title                   text NOT NULL
description             text NOT NULL
job_type                job_type                    -- gig | part_time | full_time | contract | temporary
category                text NOT NULL
is_external             boolean DEFAULT false       -- From Deep Search/SerpAPI

-- Location
location                text NOT NULL
location_details        text
location_embedding      vector(1536)                -- For location-based matching
country_code            text                        -- ISO2: RW, MT, etc.
city                    text
area                    text

-- Compensation
pay_min                 numeric
pay_max                 numeric
pay_type                pay_type                    -- hourly | daily | weekly | monthly | fixed | commission | negotiable
currency                text DEFAULT 'RWF'

-- Timing
duration                text
start_date              timestamptz
end_date                timestamptz
flexible_hours          boolean DEFAULT false

-- Requirements
required_skills         jsonb DEFAULT '[]'
required_skills_embedding vector(1536)              -- AI matching
experience_level        text
physical_demands        text
tools_needed            text[]

-- Logistics
transport_provided      boolean DEFAULT false
team_size               text
weather_dependent       boolean DEFAULT false

-- Contact
contact_method          text
contact_phone           text

-- Status
status                  job_status                  -- open | filled | closed | expired | paused
filled_at               timestamptz

-- External Jobs
source_id               uuid → job_sources(id)
external_id             text                        -- External job board ID
external_url            text                        -- Link to original posting
company_name            text
discovered_at           timestamptz

-- Metadata
metadata                jsonb DEFAULT '{}'

-- Timestamps
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
expires_at              timestamptz
```

**Key Indexes**:

- HNSW vector index on `required_skills_embedding` (cosine similarity)
- B-tree indexes on: `posted_by`, `status`, `category`, `job_type`, `created_at`
- GIN indexes on: `metadata`, `required_skills`

**Typical Rows**:

- Local jobs: 100-500 per city
- External jobs: 20-30 new per day per city

---

### 2. job_seekers

Profiles of users looking for jobs.

**Columns**:

```sql
id                      uuid PRIMARY KEY
phone_number            text UNIQUE NOT NULL
name                    text
bio                     text
bio_embedding           vector(1536)

-- Skills & Experience
skills                  jsonb DEFAULT '[]'          -- ['driver', 'cook', 'waiter']
skills_embedding        vector(1536)                -- AI matching
experience_years        int
certifications          text[]
languages               text[]                      -- ['en', 'fr', 'rw', 'sw']

-- Preferences
preferred_job_types     job_type[]                  -- {gig, part_time}
preferred_categories    text[]                      -- {'cleaning', 'delivery'}
preferred_locations     text[]                      -- {'Kigali', 'Remera'}
preferred_pay_types     pay_type[]

-- Availability
availability            jsonb DEFAULT '{}'          -- {days: ['mon','tue'], hours: {...}}
available_immediately   boolean DEFAULT true
min_pay                 numeric
max_distance_km         numeric

-- Profile Status
profile_complete        boolean DEFAULT false
verified                boolean DEFAULT false
rating                  numeric(3,2)                -- 0.00 to 5.00
total_jobs_completed    int DEFAULT 0

-- Contact
preferred_contact_method text DEFAULT 'whatsapp'
notifications_enabled   boolean DEFAULT true

-- Metadata
metadata                jsonb DEFAULT '{}'

-- Timestamps
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
last_active             timestamptz DEFAULT now()
```

**Key Indexes**:

- HNSW vector index on `skills_embedding`
- B-tree indexes on: `phone_number`, `last_active`, `profile_complete`
- GIN indexes on: `skills`, `preferred_categories`

---

### 3. job_matches

AI-generated matches between jobs and seekers.

**Columns**:

```sql
id                      uuid PRIMARY KEY
job_id                  uuid → job_listings(id)
seeker_id               uuid → job_seekers(id)

-- Match Quality
similarity_score        float                       -- 0.0 to 1.0 (cosine similarity)
match_reasons           jsonb                       -- {location: true, skills: true, ...}
match_type              match_type                  -- automatic | manual | ai_suggested

-- Interest Tracking
seeker_interested       boolean DEFAULT false
seeker_message          text
seeker_viewed_at        timestamptz
poster_interested       boolean DEFAULT false
poster_viewed_at        timestamptz

-- Status
status                  match_status                -- suggested | viewed | contacted | hired | rejected | expired
contacted_at            timestamptz
hired_at                timestamptz
rejected_reason         text

-- Metadata
metadata                jsonb DEFAULT '{}'

-- Timestamps
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()

UNIQUE(job_id, seeker_id)
```

**Key Indexes**:

- B-tree indexes on: `job_id`, `seeker_id`, `status`, `similarity_score DESC`
- Partial indexes on: `seeker_interested`, `poster_interested` (WHERE true)

**Matching Threshold**: similarity_score >= 0.70 (70%)

---

### 4. job_conversations

WhatsApp conversation state for Job Board agent.

**Columns**:

```sql
id                      uuid PRIMARY KEY
phone_number            text NOT NULL
user_name               text
role                    user_role                   -- job_seeker | job_poster | both

-- Conversation State
conversation_state      jsonb DEFAULT '{}'          -- {step: 'collecting_job_details', ...}
current_intent          text                        -- 'posting_job' | 'finding_job'

-- Message History (limited)
messages                jsonb[]                     -- Last N messages
message_count           int DEFAULT 0

-- Extracted Data
extracted_metadata      jsonb DEFAULT '{}'          -- Parsed job/seeker data

-- Context
job_seeker_id           uuid → job_seekers(id)
active_job_id           uuid → job_listings(id)

-- Timestamps
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
last_message_at         timestamptz DEFAULT now()
```

**Used By**: WhatsApp webhook to maintain conversation context.

---

### 5. job_applications

Formal applications submitted through the system.

**Columns**:

```sql
id                      uuid PRIMARY KEY
job_id                  uuid → job_listings(id)
seeker_id               uuid → job_seekers(id)

-- Application Data
cover_message           text
expected_pay            numeric
available_start_date    timestamptz

-- Status
status                  text                        -- pending | reviewed | accepted | rejected
reviewed_at             timestamptz
reviewed_by             text                        -- poster phone number
rejection_reason        text

-- Communication
conversation_history    jsonb[]

-- Metadata
metadata                jsonb DEFAULT '{}'

-- Timestamps
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()

UNIQUE(job_id, seeker_id)
```

---

## Analytics & Configuration

### 6. job_analytics

Partitioned table for tracking all job board events.

**Columns**:

```sql
id                      uuid
event_type              text NOT NULL               -- job_posted | job_viewed | match_created | ...
event_timestamp         timestamptz NOT NULL
phone_number            text
job_id                  uuid → job_listings(id)
seeker_id               uuid → job_seekers(id)
match_id                uuid → job_matches(id)

-- Event Details
event_data              jsonb DEFAULT '{}'

-- Aggregation Fields
country_code            text
city                    text
category                text

-- Metadata
metadata                jsonb DEFAULT '{}'

PRIMARY KEY (id, event_timestamp)
```

**Partitioning**: Monthly partitions by `event_timestamp`

**Event Types**:

- `job_posted`, `job_viewed`, `job_applied`
- `seeker_registered`, `seeker_profile_updated`
- `match_created`, `match_viewed`, `match_accepted`
- `conversation_started`, `conversation_completed`

---

### 7. job_categories

Master list of job categories.

**Columns**:

```sql
id                      uuid PRIMARY KEY
category_name           text UNIQUE NOT NULL
category_slug           text UNIQUE NOT NULL
parent_category_id      uuid → job_categories(id)  -- For hierarchies

-- Display
icon                    text                        -- Emoji or icon code
display_order           int
color_code              text                        -- Hex color

-- Localization
label_en                text
label_fr                text
label_rw                text
label_sw                text

-- Metadata
description             text
keywords                text[]                      -- For category matching
is_active               boolean DEFAULT true
is_malta_specific       boolean DEFAULT false       -- iGaming, Maritime, etc.

-- Timestamps
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
```

**Sample Categories**:

- Cleaning & Housekeeping
- Delivery & Driving
- Construction & Manual Labor
- Food Service & Hospitality
- Childcare & Babysitting
- Office & Administrative
- **Malta**: iGaming & Betting, Maritime & Yachting, Healthcare & Nursing

---

### 8. job_sources

External job board configurations (Deep Search, SerpAPI).

**Columns**:

```sql
id                      uuid PRIMARY KEY
name                    text NOT NULL               -- 'OpenAI Deep Search', 'Google Jobs (SerpAPI)'
source_type             text NOT NULL               -- openai_deep_search | serpapi | custom_rss

-- Configuration
base_url                text
config                  jsonb                       -- {queries: [{country: 'RW', query: '...'}]}
api_credentials         jsonb                       -- Encrypted API keys (service role only)

-- Status
is_active               boolean DEFAULT true
last_sync_at            timestamptz
next_sync_at            timestamptz
sync_frequency          interval DEFAULT '1 day'

-- Stats
total_jobs_discovered   int DEFAULT 0
successful_syncs        int DEFAULT 0
failed_syncs            int DEFAULT 0

-- Metadata
metadata                jsonb DEFAULT '{}'

-- Timestamps
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
```

**Sample config.queries**:

```json
{
  "queries": [
    {
      "country_code": "RW",
      "city": "Kigali",
      "query": "one day casual jobs in Kigali",
      "kind": "one_day"
    },
    {
      "country_code": "MT",
      "city": "Valletta",
      "query": "part time jobs in Valletta Malta",
      "kind": "part_time"
    }
  ]
}
```

---

## Enums

### job_type

```sql
'gig'           -- One-day or short gigs
'part_time'     -- Regular part-time (< 30 hrs/week)
'full_time'     -- Regular full-time (>= 30 hrs/week)
'contract'      -- Fixed-term contract
'temporary'     -- Temporary/seasonal
```

### pay_type

```sql
'hourly'        -- Per hour
'daily'         -- Per day
'weekly'        -- Per week
'monthly'       -- Per month
'fixed'         -- One-time fixed amount
'commission'    -- Commission-based
'negotiable'    -- To be discussed
```

### job_status

```sql
'open'          -- Accepting applications
'filled'        -- Position filled
'closed'        -- Closed by poster
'expired'       -- Expired (past expires_at)
'paused'        -- Temporarily paused
```

### match_type

```sql
'automatic'     -- Generated by AI
'manual'        -- Created by admin/poster
'ai_suggested'  -- AI suggestion reviewed by human
```

### match_status

```sql
'suggested'     -- Initial match
'viewed'        -- Viewed by either party
'contacted'     -- Initial contact made
'hired'         -- Hired successfully
'rejected'      -- Not a fit
'expired'       -- Match expired (job filled/closed)
```

### user_role

```sql
'job_seeker'    -- Looking for jobs
'job_poster'    -- Posting jobs
'both'          -- Can do both
```

---

## Indexes

### Vector Indexes (HNSW)

**Purpose**: Fast semantic similarity search using pgvector.

```sql
-- Job listings
CREATE INDEX job_listings_skills_embedding_idx
ON job_listings USING hnsw (required_skills_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Job seekers
CREATE INDEX job_seekers_skills_embedding_idx
ON job_seekers USING hnsw (skills_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Performance**:

- ~10ms for top-10 matches in 10,000 rows
- ~50ms for top-10 matches in 100,000 rows

### GIN Indexes (JSONB)

**Purpose**: Fast queries on JSONB arrays and objects.

```sql
-- Job listings
CREATE INDEX job_listings_metadata_idx ON job_listings USING gin(metadata);
CREATE INDEX job_listings_required_skills_idx ON job_listings USING gin(required_skills);

-- Job seekers
CREATE INDEX job_seekers_skills_idx ON job_seekers USING gin(skills);
CREATE INDEX job_seekers_metadata_idx ON job_seekers USING gin(metadata);
```

### B-Tree Indexes

**Purpose**: Standard indexes for filtering and sorting.

**Most Important**:

- `job_listings_status_idx` (WHERE status = 'open')
- `job_seekers_available_immediately_idx` (WHERE available_immediately = true)
- `job_matches_similarity_score_idx` (DESC)
- `job_analytics_event_timestamp_idx` (partitioned)

---

## RLS Policies

All tables have Row Level Security enabled.

### Policy Pattern

```sql
-- Public read for open jobs
CREATE POLICY "Anyone can view open jobs"
ON job_listings FOR SELECT
USING (status = 'open');

-- Users can manage their own data
CREATE POLICY "Users can manage own seeker profile"
ON job_seekers FOR ALL
USING (phone_number = current_setting('request.jwt.claims', true)::json->>'phone');

-- Service role can do anything
CREATE POLICY "Service role full access"
ON job_listings FOR ALL
TO service_role
USING (true);
```

**Key Policies**:

- Anonymous users: Can view open jobs only
- Authenticated users: Can manage own profiles, jobs, applications
- Service role: Full access (for Edge Functions)

---

## Functions & RPCs

### Core Matching Functions

#### 1. match_jobs_for_seeker

```sql
CREATE FUNCTION match_jobs_for_seeker(
  p_seeker_id uuid,
  p_limit int DEFAULT 10,
  p_min_score float DEFAULT 0.70
)
RETURNS TABLE (
  job_id uuid,
  similarity_score float,
  match_reasons jsonb
)
```

**Purpose**: Find best job matches for a seeker using vector similarity.

**Algorithm**:

1. Get seeker's skills_embedding
2. Cosine similarity against all open jobs
3. Filter by location, pay expectations
4. Return top N matches with score >= threshold

#### 2. match_seekers_for_job

```sql
CREATE FUNCTION match_seekers_for_job(
  p_job_id uuid,
  p_limit int DEFAULT 10,
  p_min_score float DEFAULT 0.70
)
RETURNS TABLE (
  seeker_id uuid,
  similarity_score float,
  match_reasons jsonb
)
```

**Purpose**: Find best seekers for a job posting.

#### 3. create_job_match

```sql
CREATE FUNCTION create_job_match(
  p_job_id uuid,
  p_seeker_id uuid,
  p_similarity_score float,
  p_match_reasons jsonb DEFAULT '{}'::jsonb,
  p_match_type match_type DEFAULT 'automatic'
)
RETURNS uuid
```

**Purpose**: Create a match and trigger notifications.

#### 4. infer_job_category

```sql
CREATE FUNCTION infer_job_category(
  p_title text,
  p_description text,
  p_keywords text[] DEFAULT NULL
)
RETURNS text
```

**Purpose**: Automatically categorize jobs based on keywords.

**Categories Checked**:

- Cleaning, Delivery, Construction, Food Service
- Office, Childcare, Security, Gardening
- **Malta**: iGaming, Healthcare, Maritime, Finance

---

## Usage Examples

### 1. Find Matches for a New Seeker

```sql
-- Create seeker profile (with embedding from OpenAI)
INSERT INTO job_seekers (
  phone_number,
  name,
  skills,
  skills_embedding,
  preferred_locations,
  min_pay
) VALUES (
  '+250788123456',
  'John Doe',
  '["driver", "delivery", "waiter"]'::jsonb,
  '[0.123, 0.456, ...]'::vector(1536),  -- From OpenAI
  ARRAY['Kigali', 'Remera'],
  5000
);

-- Find matching jobs
SELECT * FROM match_jobs_for_seeker(
  (SELECT id FROM job_seekers WHERE phone_number = '+250788123456'),
  10,  -- limit
  0.75 -- min score
);
```

### 2. Post a Job and Find Seekers

```sql
-- Post job (with embedding)
INSERT INTO job_listings (
  posted_by,
  title,
  description,
  job_type,
  category,
  location,
  pay_min,
  pay_max,
  pay_type,
  currency,
  required_skills,
  required_skills_embedding,
  start_date,
  expires_at
) VALUES (
  '+250788654321',
  'Delivery driver needed - Saturday',
  'Need reliable driver for deliveries around Kigali on Saturday...',
  'gig',
  'delivery',
  'Kigali, Rwanda',
  10000,
  15000,
  'daily',
  'RWF',
  '["driver license", "motorcycle", "smartphone"]'::jsonb,
  '[0.789, 0.012, ...]'::vector(1536),
  '2025-11-16 08:00:00+02',
  '2025-11-15 18:00:00+02'
);

-- Find matching seekers
SELECT * FROM match_seekers_for_job(
  (SELECT id FROM job_listings WHERE posted_by = '+250788654321' ORDER BY created_at DESC LIMIT 1),
  10,
  0.75
);
```

### 3. Track Analytics

```sql
-- Log event
INSERT INTO job_analytics (
  event_type,
  phone_number,
  job_id,
  country_code,
  city,
  category,
  event_data
) VALUES (
  'job_viewed',
  '+250788123456',
  'job-uuid-here',
  'RW',
  'Kigali',
  'delivery',
  '{"source": "whatsapp", "match_score": 0.85}'::jsonb
);

-- Query analytics
SELECT
  event_type,
  COUNT(*) as count,
  DATE_TRUNC('day', event_timestamp) as day
FROM job_analytics
WHERE event_timestamp >= NOW() - INTERVAL '7 days'
  AND country_code = 'RW'
GROUP BY event_type, day
ORDER BY day DESC, count DESC;
```

---

## Verification

To verify all tables are set up correctly:

```bash
# Run verification script
psql $DATABASE_URL -f scripts/verify-job-board-tables.sql

# Expected output:
# ✅ 8 tables created
# ✅ 30+ indexes
# ✅ 6 enums
# ✅ Vector columns ready
# ✅ RLS policies enabled
# ✅ Functions deployed
```

---

## Migration Files

All schema is defined in:

1. **`20251114220000_job_board_system.sql`** (22 KB)
   - Core tables: job_listings, job_seekers, job_matches
   - Support tables: conversations, applications, analytics, categories
   - Indexes, RLS policies, functions

2. **`20251114230000_job_board_enhancements.sql`** (8.2 KB)
   - job_sources table
   - External job fields (is_external, source_id, external_url)
   - Enhanced category inference

3. **`20251114232000_add_jobs_to_menu.sql`** (3.1 KB)
   - WhatsApp menu item
   - Malta job source queries

4. **`20251114232100_malta_job_categories.sql`** (1.0 KB)
   - Malta-specific categories
   - iGaming, Healthcare, Maritime, Finance

**Total**: 34.3 KB SQL, 618 lines

---

## Performance Targets

**Vector Similarity Search**:

- 10K jobs: < 10ms (HNSW index)
- 100K jobs: < 50ms

**JSONB Queries**:

- Metadata filtering: < 5ms (GIN index)
- Skills array matching: < 10ms

**Write Operations**:

- Insert job: < 5ms
- Generate match: < 10ms
- Update status: < 2ms

**Concurrent Users**:

- 100 users: < 50ms p95 latency
- 1,000 users: < 100ms p95 latency

---

## Backup & Maintenance

### Regular Tasks

```sql
-- Expire old jobs (run daily)
UPDATE job_listings
SET status = 'expired'
WHERE status = 'open'
  AND expires_at < NOW();

-- Clean old matches (run weekly)
DELETE FROM job_matches
WHERE status = 'expired'
  AND created_at < NOW() - INTERVAL '30 days';

-- Vacuum analytics (run monthly)
VACUUM ANALYZE job_analytics;

-- Reindex vectors (run quarterly)
REINDEX INDEX job_listings_skills_embedding_idx;
REINDEX INDEX job_seekers_skills_embedding_idx;
```

### Backup Schedule

- **Full backup**: Daily at 2 AM
- **Transaction logs**: Continuous (Supabase handles this)
- **Retention**: 30 days

---

## Summary

**Database Ready**: ✅  
**Tables**: 8 core + partitions  
**Columns**: 150+  
**Indexes**: 30+ (HNSW, GIN, B-Tree)  
**RLS**: Enabled  
**Functions**: 4+ matching RPCs  
**Vector Embeddings**: 1536 dimensions (OpenAI)  
**Performance**: < 50ms for matches

**Status**: Production Ready 🚀

---

**Last Updated**: November 14, 2025  
**Version**: 1.1.0 (Malta Support)
