# 💼 Jobs & Gigs Feature - Complete Documentation

**Last Updated:** 2025-12-10  
**Status:** Production Ready ✅  
**Version:** 2.0

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Agent Implementations](#agent-implementations)
5. [API & Tools](#api--tools)
6. [User Flows](#user-flows)
7. [Multi-Country Support](#multi-country-support)
8. [Recent Fixes & Improvements](#recent-fixes--improvements)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Jobs & Gigs feature connects job seekers with employers across 7 countries (Rwanda, Burundi,
Tanzania, DRC, Zambia, Togo, Malta) via WhatsApp, supporting both formal employment and gig work.

### Key Features

- ✅ **Job Posting** - Employers create listings with pay ranges, requirements
- ✅ **Semantic Search** - AI-powered matching using OpenAI embeddings
- ✅ **Profile Management** - Job seekers build profiles with skills, experience
- ✅ **Application Tracking** - Track submitted applications and status
- ✅ **Multi-Platform** - WhatsApp, Web, API
- ✅ **Multi-Country** - 7 countries with localized content
- ✅ **Backward Compatible** - Views for legacy table names

### Supported Job Types

- Full-time employment
- Part-time work
- Contract positions
- Gig work (one-off tasks)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACES                          │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│  WhatsApp   │   Web UI    │   Admin     │   External APIs  │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬───────────┘
       │             │             │             │
       ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                    AGENT LAYER                               │
├──────────────────┬──────────────────┬───────────────────────┤
│ Webhook Agent    │ Package Agent    │ Agent Orchestrator    │
│ (Deno/Gemini)    │ (Node/OpenAI)    │ (Shared Logic)        │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    TOOLS LAYER                               │
├──────────────────┬──────────────────┬───────────────────────┤
│ jobs-matcher.ts  │ search_jobs      │ apply_to_job          │
│ (Semantic)       │ (Standard)       │ (Application)         │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER                             │
├──────────────────┬──────────────────┬───────────────────────┤
│ job_listings     │ job_seekers      │ job_matches           │
│ (Main table)     │ (Profiles)       │ (Applications)        │
├──────────────────┼──────────────────┼───────────────────────┤
│ job_sources      │ job_categories   │ Compatibility Views:  │
│ (External sync)  │ (Taxonomy)       │ • job_posts           │
│                  │                  │ • worker_profiles     │
│                  │                  │ • job_applications    │
└──────────────────┴──────────────────┴───────────────────────┘
```

### Data Flow

```
┌──────────────┐
│ User Message │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│ WhatsApp Webhook                      │
│ (wa-webhook or wa-webhook-jobs)       │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Jobs Agent (Gemini 2.5 Pro)          │
│ - Understands intent                 │
│ - Selects appropriate tool           │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Tool Execution                        │
│ - search_jobs: Find listings         │
│ - create_worker_profile: Save profile│
│ - apply_to_job: Submit application   │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Database Operations                   │
│ - Semantic search with embeddings    │
│ - CRUD operations                    │
│ - Match scoring                      │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Response to User                      │
│ - Formatted results                  │
│ - Quick reply options                │
│ - Follow-up suggestions              │
└──────────────────────────────────────┘
```

---

## Database Schema

### Core Tables

#### `job_listings` (Main jobs table)

```sql
CREATE TABLE job_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenantId UUID,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- e.g., "construction", "driving", "tech"
  job_type TEXT, -- full-time, part-time, contract, gig
  location TEXT,
  pay_min NUMERIC,
  pay_max NUMERIC,
  pay_type TEXT, -- hourly, daily, monthly, one-time
  currency TEXT DEFAULT 'RWF',
  status TEXT DEFAULT 'active', -- active, filled, closed, expired
  posted_by TEXT, -- Company name or user
  user_id UUID REFERENCES profiles(user_id),
  country_code TEXT, -- RW, BI, TZ, CD, ZM, TG, MT
  required_skills TEXT[],
  is_external BOOLEAN DEFAULT false,
  external_url TEXT,
  source_id UUID REFERENCES job_sources(id),
  verified BOOLEAN DEFAULT false,
  embedding vector(1536), -- OpenAI embeddings for semantic search
  location_geography GEOGRAPHY(Point),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `job_seekers` (Worker profiles)

```sql
CREATE TABLE job_seekers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenantId UUID,
  user_id UUID REFERENCES profiles(user_id),
  name TEXT,
  phone TEXT,
  skills TEXT[], -- e.g., ["carpentry", "plumbing"]
  experience TEXT, -- Free-form or structured
  location TEXT,
  location_preference TEXT,
  resume_url TEXT,
  embedding vector(1536), -- Profile embeddings for matching
  country_code TEXT,
  availability TEXT, -- immediate, 2 weeks, etc.
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `job_matches` (Applications & matches)

```sql
CREATE TABLE job_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES job_listings(id),
  seeker_id UUID REFERENCES job_seekers(user_id),
  score DOUBLE PRECISION, -- Match score 0.0-1.0
  status TEXT DEFAULT 'matched', -- matched, applied, reviewed, accepted, rejected
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Compatibility Views

```sql
-- For backward compatibility with old code
CREATE VIEW job_posts AS SELECT * FROM job_listings;
CREATE VIEW worker_profiles AS SELECT * FROM job_seekers;
CREATE VIEW job_applications AS SELECT * FROM job_matches;
```

### Supporting Tables

- `job_sources` - External job board sources (JobInRwanda, Umurava, etc.)
- `job_categories` - Hierarchical job taxonomy
- `jobs_call_intakes` - Call center intake forms
- `deep_research_jobs` - Deep research results

---

## Agent Implementations

### 1. Webhook Agent (Production - WhatsApp)

**Location:** `supabase/functions/wa-webhook/domains/ai-agents/jobs_agent.ts`

**AI Model:** Gemini 2.5 Pro

**Tools:**

- `search_jobs` - Find jobs by role, location, salary
- `create_worker_profile` - Build/update worker profile
- `apply_to_job` - Submit application
- `check_application_status` - View applications
- `get_salary_insights` - Market salary data
- `web_search` - External job search
- `deep_search` - Research companies/careers

**Status:** ✅ Production-ready, uses real database

### 2. Package Agent (Multi-platform)

**Location:** `packages/agents/src/agents/jobs/jobs.agent.ts`

**AI Model:** OpenAI GPT-4

**Tools:**

- `search_jobs` - Semantic search with embeddings
- `create_worker_profile` - Profile management
- `verify_employer` - Trust score checking
- `application_tracker` - Application CRUD
- `salary_insights` - Salary statistics

**Status:** ✅ Production-ready, semantic search enabled

### 3. Shared Tools

**Location:** `supabase/functions/_shared/wa-webhook-shared/tools/jobs-matcher.ts`

**Features:**

- Hybrid search (semantic + traditional)
- Match scoring algorithm
- Location-based filtering
- Category matching

**Status:** ✅ Enhanced with semantic search support

---

## API & Tools

### Tool: `search_jobs`

**Purpose:** Find job listings matching criteria

**Parameters:**

```typescript
{
  role: string;           // Job title/role
  location?: string;      // City or area
  min_salary?: number;    // Minimum pay in RWF
  job_type?: string;      // full-time, part-time, contract, gig
  category?: string;      // Job category
  query?: string;         // Natural language search
}
```

**Returns:**

```typescript
{
  jobs: Array<{
    id: string;
    title: string;
    company: string;
    location: string;
    salary: number;
    salary_max?: number;
    type: string;
    verified: boolean;
    similarity?: number; // 0.0-1.0 if semantic search
  }>;
  count: number;
}
```

### Tool: `create_worker_profile`

**Purpose:** Create or update job seeker profile

**Parameters:**

```typescript
{
  user_id: string;
  skills: string[];
  experience: string;
  location: string;
  categories?: string[];
}
```

### Tool: `apply_to_job`

**Purpose:** Submit job application

**Parameters:**

```typescript
{
  job_id: string;
  user_id: string;
}
```

**Returns:**

```typescript
{
  application_id: string;
  status: "applied" | "duplicate";
  message: string;
}
```

### Database Functions

#### `match_job_listings()`

```sql
CREATE FUNCTION match_job_listings(
  query_embedding vector(1536),
  match_threshold DOUBLE PRECISION DEFAULT 0.7,
  match_count INTEGER DEFAULT 5
) RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  location TEXT,
  similarity DOUBLE PRECISION
);
```

#### `search_jobs_unified()`

```sql
CREATE FUNCTION search_jobs_unified(
  p_query TEXT,
  p_location TEXT,
  p_category TEXT,
  p_min_salary NUMERIC,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (...);
```

---

## User Flows

### Flow 1: Job Seeker Searches for Work

```
User: "I need a construction job in Kigali"
  ↓
Agent: Extracts intent = find_job
       Parameters: category="construction", location="Kigali"
  ↓
Tool: search_jobs()
      - Queries job_listings
      - Filters by category, location, status=active
      - Orders by created_at DESC
  ↓
Response:
"Found 12 construction jobs in Kigali 🏗️

1️⃣ Mason - 150,000-200,000 RWF - BuildIt Ltd
2️⃣ Carpenter - 180,000-250,000 RWF - City Construction
3️⃣ Plumber - 200,000-300,000 RWF - Kigali Projects

Reply with number to apply or ask for more info!"
  ↓
User: "1"
  ↓
Tool: apply_to_job(job_id, user_id)
      - Inserts into job_matches
      - Sets status='applied'
  ↓
Response:
"✅ Application submitted for Mason position!

The employer will contact you if interested.
View all applications: Type 'my applications'"
```

### Flow 2: Employer Posts Job

```
User: "I need to hire a driver"
  ↓
Agent: Extracts intent = post_job
       Asks clarifying questions:
       - Location?
       - Salary range?
       - Full-time or part-time?
  ↓
User: "Kigali, 200-250k monthly, full-time"
  ↓
Tool: Creates job_listing
      - Generates embedding for semantic matching
      - Searches job_seekers for matches
  ↓
Response:
"✅ Job posted: Driver - Kigali

Found 8 matching candidates with driver experience.
We'll notify them about your opening.

1️⃣ View candidates
2️⃣ Edit job posting
3️⃣ Post another job"
```

### Flow 3: Profile Creation

```
User: "I have 5 years carpentry experience"
  ↓
Agent: Extracts skills from conversation
  ↓
Tool: create_worker_profile()
      - Saves to job_seekers
      - Generates embedding from skills+experience
  ↓
Response:
"✅ Profile created!

Skills: Carpentry (5 years)
Location: [detects from user profile]

We'll notify you when matching jobs are posted.
Search jobs now? Reply 'find work'"
```

---

## Multi-Country Support

### Supported Countries

| Country  | Code | Currency | Status    |
| -------- | ---- | -------- | --------- |
| Rwanda   | RW   | RWF      | ✅ Active |
| Burundi  | BI   | BIF      | ✅ Active |
| Tanzania | TZ   | TZS      | ✅ Active |
| DR Congo | CD   | CDF      | ✅ Active |
| Zambia   | ZM   | ZMW      | ✅ Active |
| Togo     | TG   | XOF      | ✅ Active |
| Malta    | MT   | EUR      | ✅ Active |

### External Job Sources

Configured in `job_sources` table:

- JobInRwanda (RW)
- Umurava (RW)
- RDB Careers (RW)
- BrighterMonday Rwanda (RW)
- Indeed Malta (MT)
- LinkedIn Jobs (Global)

**Sync Schedule:** Daily at 03:00 UTC

---

## Recent Fixes & Improvements

### 2025-12-10: P0 & P1 Fixes

#### P0 - Critical Production Fixes ✅

1. **Fixed jobs-matcher.ts table reference**
   - Was: `job_posts` (non-existent)
   - Now: `job_listings` (correct)
   - Impact: Job search now returns results

2. **Fixed webhook agent profile management**
   - Was: `worker_profiles` (non-existent)
   - Now: `job_seekers` (correct)
   - Impact: Profile creation works

3. **Fixed application tracking**
   - Was: `job_applications` (non-existent)
   - Now: `job_matches` (correct)
   - Impact: Applications tracked properly

#### P1 - Improvements ✅

4. **Standardized tool names**
   - `search_gigs` → `search_jobs` (consistent naming)

5. **Enhanced semantic search**
   - Added hybrid search architecture
   - Ready for full embedding integration
   - Improved match scoring

6. **Backward compatibility**
   - Created views for old table names
   - Zero breaking changes
   - Migration: `20251210163000_jobs_backward_compatibility.sql`

---

## Testing

### Manual Testing (WhatsApp)

```
# Test 1: Job Search
User: "I'm looking for work in Kigali"
Expected: Returns active job listings

# Test 2: Profile Creation
User: "I'm a driver with 3 years experience"
Expected: Creates profile, extracts skills

# Test 3: Job Application
User: [After seeing jobs] "1"
Expected: Submits application, confirms

# Test 4: Application Status
User: "my applications"
Expected: Shows list of applications

# Test 5: Job Posting
User: "I need to hire a carpenter"
Expected: Creates job, finds matches
```

### Database Testing

```sql
-- Test semantic search
SELECT * FROM match_job_listings(
  (SELECT embedding FROM job_seekers WHERE user_id = 'test-user'),
  0.7,
  5
);

-- Test unified search
SELECT * FROM search_jobs_unified(
  'carpenter',
  'Kigali',
  'construction',
  150000,
  10
);

-- Test backward compatibility
SELECT * FROM job_posts WHERE status = 'active';
```

---

## Troubleshooting

### Common Issues

#### Issue: Search returns 0 results

**Causes:**

- No active jobs in database
- Wrong table reference (use `job_listings`, not `job_posts`)
- Filters too restrictive

**Solution:**

```sql
-- Check active jobs
SELECT COUNT(*) FROM job_listings WHERE status = 'active';

-- Verify table reference in code
grep -r "job_posts" supabase/functions/
```

#### Issue: Profile creation fails

**Causes:**

- Wrong table name (`worker_profiles` instead of `job_seekers`)
- Missing user_id
- Invalid data types

**Solution:**

- Ensure code uses `job_seekers` table
- Verify user_id exists in profiles table

#### Issue: Applications not tracked

**Causes:**

- Wrong table (`job_applications` instead of `job_matches`)
- Duplicate key error
- Missing foreign keys

**Solution:**

- Use `job_matches` table
- Check for existing applications before inserting
- Handle error code '23505' for duplicates

### Debug Queries

```sql
-- Check recent jobs
SELECT id, title, location, status, created_at
FROM job_listings
ORDER BY created_at DESC
LIMIT 10;

-- Check applications
SELECT jm.*, jl.title, js.name
FROM job_matches jm
JOIN job_listings jl ON jm.job_id = jl.id
JOIN job_seekers js ON jm.seeker_id = js.user_id
ORDER BY jm.created_at DESC;

-- Check profile count
SELECT country_code, COUNT(*)
FROM job_seekers
GROUP BY country_code;
```

---

## Deployment

### Prerequisites

- Supabase project with pgvector extension
- OpenAI API key (for embeddings)
- Gemini API key (for webhook agent)
- WhatsApp Business API credentials

### Migration Checklist

- [x] Apply database migrations
- [x] Deploy edge functions
- [x] Configure environment variables
- [x] Test with sample data
- [x] Enable in production

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# Optional
JOBS_SYNC_ENABLED=true
JOBS_SYNC_SCHEDULE="0 3 * * *"
```

---

## Future Enhancements

### Planned (P2)

- [ ] Full semantic search with OpenAI embeddings in edge functions
- [ ] Consolidated agent implementation (single source)
- [ ] Real-time notifications for new job matches
- [ ] Video interview scheduling
- [ ] Skill verification system

### Under Consideration

- Mobile app integration
- Employer dashboard
- Payment processing for premium listings
- AI-powered resume generation
- Automated reference checking

---

## Support

**Documentation:** `docs/features/jobs/`  
**Issues:** GitHub Issues  
**Team:** Jobs & Marketplace vertical

**Last Review:** 2025-12-10  
**Next Review:** Q1 2026
