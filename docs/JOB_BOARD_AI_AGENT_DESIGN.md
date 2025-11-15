# Job Board AI Agent - Complete Design & Implementation

## Overview
WhatsApp-based AI agent for matching job seekers with job opportunities, specializing in:
- **Miscellaneous/Gig Jobs**: One-day, short-term, part-time work
- **Structured Jobs**: Long-term, full-time positions
- **AI-Powered Matching**: OpenAI embeddings for semantic intent matching
- **Conversational UI**: Natural language job posting and searching

## Architecture

### 1. Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      WhatsApp User                               │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              wa-webhook (Message Router)                         │
│  Routes to: /domains/jobs/handler.ts                            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Jobs AI Agent (Edge Function)                       │
│  • Intent Classification (job seeker vs poster)                 │
│  • Metadata Extraction (skills, location, pay, duration)        │
│  • OpenAI GPT-4 + Function Calling                              │
│  • Embedding Generation (text-embedding-3-small)                │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Supabase Database                              │
│  • job_listings (jobs with embeddings)                          │
│  • job_seekers (seekers with skill embeddings)                  │
│  • job_matches (AI-powered matches)                             │
│  • job_conversations (chat history)                             │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Database Schema

#### Tables

**job_listings**
```sql
- id: uuid (PK)
- posted_by: text (WhatsApp number)
- title: text
- description: text
- job_type: enum (gig, part_time, full_time, contract)
- category: text (construction, delivery, cleaning, etc.)
- location: text
- location_embedding: vector(1536)
- pay_min: numeric
- pay_max: numeric
- pay_type: enum (hourly, daily, weekly, monthly, fixed)
- duration: text (e.g., "1 day", "2 weeks", "permanent")
- required_skills: jsonb
- required_skills_embedding: vector(1536)
- start_date: timestamptz
- flexible_hours: boolean
- contact_method: text
- status: enum (open, filled, closed, expired)
- metadata: jsonb (AI-extracted structured data)
- created_at: timestamptz
- updated_at: timestamptz
- expires_at: timestamptz
```

**job_seekers**
```sql
- id: uuid (PK)
- phone_number: text (unique)
- name: text
- bio: text (user's self-description)
- bio_embedding: vector(1536)
- skills: jsonb
- skills_embedding: vector(1536)
- experience_years: int
- preferred_job_types: text[]
- preferred_categories: text[]
- preferred_locations: text[]
- availability: jsonb (days/times available)
- min_pay: numeric
- preferred_pay_type: text[]
- profile_complete: boolean
- created_at: timestamptz
- updated_at: timestamptz
- last_active: timestamptz
```

**job_matches**
```sql
- id: uuid (PK)
- job_id: uuid (FK -> job_listings)
- seeker_id: uuid (FK -> job_seekers)
- similarity_score: float (0-1, cosine similarity)
- match_reasons: jsonb (why matched)
- match_type: enum (automatic, manual, ai_suggested)
- seeker_interested: boolean
- poster_interested: boolean
- status: enum (suggested, viewed, contacted, hired, rejected)
- created_at: timestamptz
- updated_at: timestamptz
```

**job_conversations**
```sql
- id: uuid (PK)
- phone_number: text
- role: enum (job_seeker, job_poster, both)
- conversation_state: jsonb (FSM state)
- messages: jsonb[] (chat history)
- current_intent: text
- extracted_metadata: jsonb
- created_at: timestamptz
- updated_at: timestamptz
```

### 3. AI Agent Capabilities

#### Function Calling Tools

1. **extract_job_metadata**
   - Input: Natural language job description
   - Output: Structured metadata (title, category, pay, duration, skills, location)
   - Uses: GPT-4 with structured output

2. **search_jobs**
   - Input: Seeker's description or preferences
   - Output: Ranked job matches using embedding similarity
   - Query: pgvector cosine similarity + filters

3. **post_job**
   - Input: Job details from conversation
   - Output: Job listing ID and confirmation
   - Generates: Title embedding + skills embedding

4. **update_seeker_profile**
   - Input: Skills, experience, preferences
   - Output: Updated profile
   - Generates: Bio embedding + skills embedding

5. **get_job_recommendations**
   - Input: Seeker ID
   - Output: Top 10 matched jobs with explanations
   - Logic: Vector similarity + metadata filtering

6. **express_interest**
   - Input: Job ID, message
   - Output: Creates match record, notifies poster
   - Side effect: Sends WhatsApp message to poster

7. **view_applicants**
   - Input: Job ID (from poster)
   - Output: List of interested seekers with match scores

#### Metadata Extraction Strategy

For **miscellaneous/gig jobs**, the AI extracts:
- **Core**: Title, category, location, pay
- **Temporal**: Start date, duration, hours/day
- **Requirements**: Physical demands, tools needed, experience level
- **Logistics**: Transport needed, team size, weather dependency
- **Flexibility**: Negotiable pay, flexible hours, remote option

Example conversation:
```
User: "I need someone to help move furniture tomorrow in Kigali"

AI Extracts:
{
  "title": "Furniture Moving Helper",
  "category": "moving_labor",
  "job_type": "gig",
  "location": "Kigali",
  "start_date": "tomorrow",
  "duration": "1 day",
  "required_skills": ["physical_strength", "furniture_handling"],
  "physical_demands": "heavy_lifting",
  "team_size": "1-2 people",
  "pay_type": "daily",
  "estimated_pay": "5000-10000 RWF"
}
```

### 4. Matching Algorithm

```typescript
// Hybrid matching: Vector similarity + rule-based filters

async function matchJobsForSeeker(seekerId: string) {
  const seeker = await getSeeker(seekerId);
  
  // Step 1: Vector similarity (semantic matching)
  const vectorMatches = await supabase.rpc('match_jobs_vector', {
    query_embedding: seeker.skills_embedding,
    match_threshold: 0.7,
    match_count: 50
  });
  
  // Step 2: Filter by hard constraints
  const filtered = vectorMatches.filter(job => {
    return (
      job.status === 'open' &&
      job.pay_min >= seeker.min_pay &&
      seeker.preferred_job_types.includes(job.job_type) &&
      isLocationMatch(job.location, seeker.preferred_locations) &&
      isAvailable(seeker.availability, job.start_date)
    );
  });
  
  // Step 3: Re-rank with business logic
  const ranked = filtered.map(job => ({
    ...job,
    final_score: calculateFinalScore(job, seeker)
  })).sort((a, b) => b.final_score - a.final_score);
  
  return ranked.slice(0, 10);
}

function calculateFinalScore(job, seeker) {
  let score = job.similarity_score; // Base: 0-1
  
  // Boost recent jobs
  const ageHours = (Date.now() - job.created_at) / 3600000;
  score *= (1 + Math.exp(-ageHours / 24) * 0.2); // +20% for fresh jobs
  
  // Boost location match
  if (job.location === seeker.preferred_locations[0]) score *= 1.15;
  
  // Boost pay match
  if (job.pay_max >= seeker.min_pay * 1.5) score *= 1.1;
  
  // Boost category preference
  if (seeker.preferred_categories.includes(job.category)) score *= 1.1;
  
  return score;
}
```

### 5. Conversation Flows

#### Flow A: Job Seeker
```
1. User: "Looking for part-time work"
   → AI: "I can help! Tell me about your skills and what kind of work you're looking for."

2. User: "I can do deliveries, have a motorcycle, free afternoons"
   → AI extracts: {skills: [delivery, motorcycle], availability: "afternoons"}
   → AI: "Great! I found 5 delivery jobs in your area. Here are the top 3..."

3. User: "Tell me more about job #2"
   → AI: Shows details + "Interested? I can connect you with the employer."

4. User: "Yes, I'm interested"
   → AI creates match, notifies poster
   → AI: "Done! I've notified the employer. They'll contact you at this number."
```

#### Flow B: Job Poster
```
1. User: "I need to hire someone"
   → AI: "What kind of job? Describe what you need help with."

2. User: "Need construction worker for 3 days, concrete work, paying 15k per day"
   → AI extracts metadata
   → AI: "Job posting ready:
          - Construction Worker (Concrete)
          - 3 days starting [date]
          - 15,000 RWF/day
          - Location: [asks if not provided]
          Confirm to post?"

3. User: "Yes, location is Nyarugenge"
   → AI saves job, generates embeddings
   → AI: "Posted! I'll notify qualified workers. You can check applicants anytime by saying 'show applicants'."

4. Later: "Show applicants"
   → AI: "You have 8 interested workers. Top 3 matches:
          1. John - 5 years concrete exp (95% match)
          2. Marie - 3 years general construction (87% match)
          ..."
```

### 6. Implementation Files

```
supabase/
├── migrations/
│   └── 20251114220000_job_board_system.sql          # All tables, indexes, RLS
│
├── functions/
│   ├── job-board-ai-agent/
│   │   ├── index.ts                                  # Main edge function
│   │   ├── prompts.ts                                # System prompts
│   │   ├── tools.ts                                  # Function definitions
│   │   ├── handlers.ts                               # Tool execution
│   │   ├── matching.ts                               # Matching algorithms
│   │   └── deno.json
│   │
│   └── wa-webhook/
│       └── domains/
│           └── jobs/
│               ├── handler.ts                        # Routes to job-board-ai-agent
│               ├── types.ts
│               └── utils.ts
│
admin-app/
└── app/
    └── dashboard/
        └── jobs/
            ├── page.tsx                              # Jobs admin dashboard
            ├── listings/page.tsx                     # View all jobs
            ├── seekers/page.tsx                      # View all seekers
            ├── matches/page.tsx                      # View matches
            └── components/
                ├── JobCard.tsx
                ├── SeekerProfile.tsx
                └── MatchList.tsx
```

### 7. Key Features

#### For Miscellaneous Jobs
- **Rapid Posting**: 30-second conversational job posting
- **Skill Inference**: AI infers required skills from descriptions
- **Urgency Handling**: Prioritizes "today" and "tomorrow" jobs
- **Payment Flexibility**: Supports cash, mobile money, negotiable rates
- **Location Smart**: Understands "near me", city districts, landmarks

#### For Job Seekers
- **Smart Matching**: Semantic search beyond keyword matching
- **Proactive Alerts**: "New job matching your skills posted 5 min ago!"
- **Profile Building**: Extracts skills from conversation history
- **Multi-Job Support**: Can express interest in multiple jobs
- **Availability Sync**: Tracks when user is busy (linked jobs)

### 8. Success Metrics

```sql
-- Dashboard queries
SELECT 
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status = 'filled') as filled_jobs,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_fill_time_hours
FROM job_listings
WHERE created_at > NOW() - INTERVAL '7 days';

SELECT 
  COUNT(DISTINCT seeker_id) as active_seekers,
  AVG(array_length(preferred_job_types, 1)) as avg_preferences
FROM job_seekers
WHERE last_active > NOW() - INTERVAL '7 days';

SELECT 
  AVG(similarity_score) as avg_match_quality,
  COUNT(*) FILTER (WHERE status = 'hired') as successful_hires
FROM job_matches
WHERE created_at > NOW() - INTERVAL '7 days';
```

### 9. Technical Specifications

**OpenAI Models**:
- **Chat**: `gpt-4-turbo-preview` (function calling, metadata extraction)
- **Embeddings**: `text-embedding-3-small` (1536 dimensions, cost-effective)

**Embedding Strategy**:
```typescript
// Job listing: Concatenate key fields for rich semantic search
const jobText = `
  ${job.title}
  ${job.description}
  ${job.category}
  Required skills: ${job.required_skills.join(', ')}
  Location: ${job.location}
  Pay: ${job.pay_min}-${job.pay_max} ${job.pay_type}
`.trim();

const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: jobText
});

// Seeker: Concatenate profile + preferences
const seekerText = `
  ${seeker.bio}
  Skills: ${seeker.skills.join(', ')}
  Experience: ${seeker.experience_years} years
  Looking for: ${seeker.preferred_job_types.join(', ')}
  Preferred: ${seeker.preferred_categories.join(', ')}
`.trim();
```

**pgvector Configuration**:
```sql
-- Use HNSW index for fast similarity search
CREATE INDEX job_listings_embedding_idx 
ON job_listings 
USING hnsw (required_skills_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Match function
CREATE OR REPLACE FUNCTION match_jobs_vector(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  similarity_score float
)
LANGUAGE sql
AS $$
  SELECT 
    id,
    title,
    1 - (required_skills_embedding <=> query_embedding) as similarity_score
  FROM job_listings
  WHERE 
    1 - (required_skills_embedding <=> query_embedding) > match_threshold
    AND status = 'open'
  ORDER BY required_skills_embedding <=> query_embedding
  LIMIT match_count;
$$;
```

## Implementation Checklist

- [ ] Database migration with all tables
- [ ] pgvector extension and indexes
- [ ] RLS policies for security
- [ ] Edge function: job-board-ai-agent
- [ ] wa-webhook domain handler
- [ ] Admin dashboard (Next.js)
- [ ] Observability (structured logging)
- [ ] Tests (Deno tests for edge function)
- [ ] Documentation updates

## Security & Privacy

- **PII Protection**: Phone numbers masked in logs
- **RLS**: Users can only see their own posts and matches
- **Rate Limiting**: Max 20 messages/hour per user
- **Content Moderation**: Flag inappropriate job descriptions
- **Payment Safety**: Never handle actual payments in chat

## Future Enhancements

- **Video Profiles**: Let seekers upload skill demo videos
- **Ratings System**: Poster rates seeker after job completion
- **Skill Verification**: Badge system for verified skills
- **Job Categories ML**: Auto-categorize from descriptions
- **Multi-Language**: Support Kinyarwanda, French, Swahili
- **Voice Input**: WhatsApp voice message transcription
- **Image Recognition**: Extract job details from photos (flyers)
