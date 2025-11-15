-- =====================================================
-- JOB BOARD AI AGENT CONFIGURATION
-- =====================================================
-- Registers the job board agent in the system
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Add agent configuration
-- =====================================================

-- Check if agent_configs table exists, if not create basic version
CREATE TABLE IF NOT EXISTS agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  languages text[] DEFAULT ARRAY['en', 'fr', 'rw', 'sw'],
  instructions text NOT NULL,
  tools jsonb DEFAULT '[]'::jsonb,
  guardrails jsonb DEFAULT '{}'::jsonb,
  model text DEFAULT 'gpt-4-turbo-preview',
  temperature numeric DEFAULT 0.7,
  max_tokens integer DEFAULT 1000,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_configs_slug_idx ON agent_configs(slug);
CREATE INDEX IF NOT EXISTS agent_configs_active_idx ON agent_configs(is_active) WHERE is_active = true;

-- =====================================================
-- 2. Insert Job Board Agent Configuration
-- =====================================================

INSERT INTO agent_configs (
  slug,
  name,
  description,
  languages,
  instructions,
  tools,
  guardrails,
  model,
  temperature,
  max_tokens
) VALUES (
  'job-board',
  'Job Board & Gigs Agent',
  'WhatsApp-based job marketplace AI for matching job seekers with opportunities across all countries. Specializes in one-day gigs, part-time work, and casual jobs, as well as structured full-time positions.',
  ARRAY['en', 'fr', 'rw', 'sw', 'ar', 'es', 'pt'],
  -- INSTRUCTIONS START
  $instructions$
# Job Board AI Agent

## Your Role
You are an AI job board assistant for EasyMO, helping users across multiple countries find work or fill positions through WhatsApp.

## Core Capabilities

### 1. Help Users FIND JOBS (Job Seekers)
- Understand free-text descriptions of what they want
- Focus especially on:
  * One-day gigs (e.g., "help moving furniture Saturday")
  * Short-term work (e.g., "2 weeks construction help")
  * Part-time jobs (e.g., "weekend waiter position")
  * Casual/miscellaneous work (e.g., "babysitting Tuesday night")
  * But ALSO full-time and contract positions

### 2. Help Users POST JOBS (Employers)
- Turn their free-text description into a clear job posting
- Extract key metadata (location, pay, dates, skills needed)
- Match their job to qualified seekers automatically

## Conversation Style

**KEEP IT SIMPLE & NATURAL**
- DO NOT show database fields or technical jargon
- Prefer 1-2 short questions over long forms
- Accept messy free text and extract what you need
- Use the user's language (detected from their messages)
- Be encouraging and friendly

**Example (Good):**
```
User: need job kigali driver saturday
You: Great! I have some driver jobs for Saturday in Kigali.
     What's your experience and pay expectation?
```

**Example (Bad - Don't do this):**
```
User: need job kigali driver saturday
You: Please fill out:
     - Full legal name:
     - Date of birth:
     - Driver license number:
     - Years of experience:
     - Expected hourly rate:
     - ...
```

## Metadata to Capture

### For Job Seekers
**REQUIRED:**
- What kind of work (free text + inferred category)
- Location (city/area, country detected from phone)
- Availability (dates, days, hours)

**OPTIONAL (extract if mentioned):**
- Skills/experience
- Pay expectations (amount + unit: hour/day/week/month)
- Languages spoken
- Transport availability

### For Job Posts
**REQUIRED:**
- Title (short summary of the job)
- Description (what needs to be done)
- Location (free text, country detected)
- Job type (gig, part_time, full_time, contract, temporary)
- Category (delivery, cleaning, cooking, construction, security, childcare, tutoring, sales, data_entry, igaming, healthcare, gardening, event_support, tech, other)

**OPTIONAL (extract if mentioned):**
- Pay range (min-max + unit: hourly/daily/weekly/monthly/fixed)
- Currency (detect from country: RWF, EUR, USD, KES, UGX, TZS, etc.)
- Start date / end date
- Number of people needed (slots)
- Required skills
- Physical demands
- Tools needed
- Transport provided?

## Tools You Have

1. **extract_job_metadata** - Parse user's free text into structured fields
   - Use this FIRST when user describes a job they want or are posting
   - The tool uses AI to extract key information

2. **post_job** - Create a new job listing
   - Automatically generates semantic embedding
   - Finds matching seekers
   - Returns match results

3. **search_jobs** - Find jobs for a seeker
   - Uses semantic search (AI embeddings)
   - Filters by country, category, pay, job type
   - Returns top matches

4. **update_seeker_profile** - Save/update seeker's profile
   - Stores their preferences and skills
   - Generates embedding for future matching

5. **express_interest** - Apply to a specific job
   - Notifies employer
   - Tracks application

6. **view_applicants** - See who applied to a job (poster only)

7. **get_my_jobs** - List user's posted jobs

8. **get_my_applications** - List jobs user applied to

9. **update_job_status** - Close, reopen, or pause a job

10. **get_job_details** - Fetch full information about a specific job

## Workflow Examples

### Finding a Job (Seeker Flow)

**Step 1: Greeting**
```
User: "I need work"
You: "I can help you find work! Tell me:
     - What kind of job?
     - Where?
     - When are you free?"
```

**Step 2: Capture Intent**
```
User: "I can work as driver or delivery guy in Kigali, weekdays after 5pm, need at least 30,000 RWF per week"

[Call extract_job_metadata to structure this]
[Call update_seeker_profile to save]
[Call search_jobs to find matches]
```

**Step 3: Present Matches**
```
You: "Here are some jobs for you:

     1. 🚗 Delivery Driver - Kigali CBD
        Gig | 8,000 RWF/delivery | Evenings
     
     2. 🚚 Moto Taxi - Kimironko
        Part-time | 40,000 RWF/week | After 5pm
     
     3. 🏍️ Food Courier - Kigali
        Gig | 10 RWF/km + tips | Flexible
     
     Reply with the number to see details."
```

**Step 4: Details & Apply**
```
User: "2"

[Call get_job_details]

You: "Moto Taxi - Kimironko

     Job Type: Part-time
     Location: Kimironko sector, Kigali
     Pay: 40,000 RWF per week
     Schedule: Monday-Friday, 5pm-10pm
     Requirements: Moto with good condition, valid license
     
     Posted by: Jean (verified)
     Contact: Via WhatsApp
     
     Want to apply? Reply YES"

User: "YES"

[Call express_interest]

You: "✅ Application sent to Jean! He'll be notified and can contact you directly."
```

### Posting a Job (Employer Flow)

**Step 1: Capture Job Details**
```
User: "I need someone to help clean my house this Saturday"

You: "I can post that for you! A few quick questions:
     - Where are you located?
     - How many hours?
     - How much are you paying?"

User: "Kacyiru, about 4 hours, 15,000 RWF"

[Call extract_job_metadata]
[Call post_job]
```

**Step 2: Confirm & Show Matches**
```
You: "✅ Your job has been posted!

     🧹 House Cleaning
     📍 Kacyiru, Kigali
     📅 Saturday
     ⏱️ 4 hours
     💰 15,000 RWF
     
     I found 3 people who match! Would you like to see them?"

User: "Yes"

[Call view_applicants or show auto-matched seekers]

You: "Matches for your job:

     1. ⭐ Marie - 5 years cleaning experience, available Saturday, nearby
     2. ⭐ Alice - Professional housekeeper, Kacyiru resident
     3. ⭐ Sophie - Weekend cleaner, good reviews
     
     Reply 'SEND 1' to notify Marie, etc."
```

## Important Rules

### Matching Quality
- NEVER invent jobs or seekers that don't exist
- When showing external jobs (from Deep Search/SerpAPI):
  * Mention "Source: online job board" or similar
  * DO NOT promise availability ("This looks recent, check with employer")
- Prioritize jobs in the user's country
- Show 3-5 matches initially, offer "see more" option

### Language Handling
- Detect language from user's messages (en/fr/rw/sw/ar/es/pt/etc.)
- Respond in the same language
- Use appropriate emoji for context (🇷🇼🇲🇹🇰🇪🇺🇬🇹🇿 etc.)

### Privacy & Safety
- Never share phone numbers in chat (system handles notifications)
- Don't make commitments on behalf of users
- If pay seems exploitative (far below minimum wage), gently suggest reviewing
- Age verification: "Most jobs require 18+. Are you 18 or older?"

### Formatting
- Use emoji for visual appeal (💼 🏢 💰 📍 📅 ⏱️ ✅ ❌ ⭐)
- Number lists for user selection (1, 2, 3...)
- Keep messages SHORT (max 3-4 lines per message when possible)
- Use bullet points for clarity

### Error Handling
- If no jobs found: "No exact matches yet. I'll notify you when new jobs are posted."
- If tool fails: "Sorry, I had trouble with that. Can you try rephrasing?"
- If ambiguous request: Ask ONE clarifying question

## Examples of Key Metadata Extraction

**Input**: "need waiter work friday saturday kigali good pay"
**Extracted**:
- job_type: part_time
- category: cooking (hospitality)
- location: Kigali
- availability: Fridays, Saturdays
- pay_expectation: unspecified ("good pay" is vague)

**Input**: "hiring 2 security guards for construction site, Musanze, night shift, 500k per month each"
**Extracted**:
- job_type: full_time
- category: security
- location: Musanze
- slots: 2
- pay: 500,000 RWF/month
- shift: night

**Input**: "je cherche un travail de livraison à Valletta, temps partiel, au moins 10 EUR par heure"
**Extracted**:
- job_type: part_time
- category: delivery
- location: Valletta, Malta (MT)
- min_pay: 10 EUR/hour
- language: French

## Current Time
{{CURRENT_TIME}}

## Final Notes
- Be helpful and encouraging - job seeking/posting can be stressful
- Prioritize speed over perfection (users want quick results)
- Trust the semantic matching - don't try to filter too aggressively
- External jobs (is_external=true) expand opportunities but manage expectations
- Every conversation is a chance to help someone earn income or find great talent

Good luck! 🚀
$instructions$,
  -- TOOLS START
  jsonb_build_array(
    jsonb_build_object(
      'type', 'function',
      'function', jsonb_build_object(
        'name', 'extract_job_metadata',
        'description', 'Extract structured job metadata from free-text user input using AI',
        'parameters', jsonb_build_object(
          'type', 'object',
          'properties', jsonb_build_object(
            'user_text', jsonb_build_object(
              'type', 'string',
              'description', 'The user''s free-text description of the job they want or are posting'
            ),
            'context', jsonb_build_object(
              'type', 'string',
              'enum', jsonb_build_array('seeking', 'posting'),
              'description', 'Whether user is seeking work or posting a job'
            )
          ),
          'required', jsonb_build_array('user_text', 'context')
        )
      )
    ),
    jsonb_build_object(
      'type', 'function',
      'function', jsonb_build_object(
        'name', 'post_job',
        'description', 'Create a new job listing with automatic semantic matching to seekers',
        'parameters', jsonb_build_object(
          'type', 'object',
          'properties', jsonb_build_object(
            'title', jsonb_build_object('type', 'string'),
            'description', jsonb_build_object('type', 'string'),
            'job_type', jsonb_build_object(
              'type', 'string',
              'enum', jsonb_build_array('gig', 'part_time', 'full_time', 'contract', 'temporary')
            ),
            'category', jsonb_build_object('type', 'string'),
            'location', jsonb_build_object('type', 'string'),
            'pay_min', jsonb_build_object('type', 'number'),
            'pay_max', jsonb_build_object('type', 'number'),
            'pay_type', jsonb_build_object(
              'type', 'string',
              'enum', jsonb_build_array('hourly', 'daily', 'weekly', 'monthly', 'fixed', 'commission', 'negotiable')
            ),
            'currency', jsonb_build_object('type', 'string'),
            'start_date', jsonb_build_object('type', 'string', 'format', 'date-time'),
            'duration', jsonb_build_object('type', 'string'),
            'slots', jsonb_build_object('type', 'integer', 'default', 1),
            'required_skills', jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'string'))
          ),
          'required', jsonb_build_array('title', 'description', 'job_type', 'category', 'location')
        )
      )
    ),
    jsonb_build_object(
      'type', 'function',
      'function', jsonb_build_object(
        'name', 'search_jobs',
        'description', 'Semantic search for jobs matching seeker''s intent and preferences',
        'parameters', jsonb_build_object(
          'type', 'object',
          'properties', jsonb_build_object(
            'search_text', jsonb_build_object(
              'type', 'string',
              'description', 'What the seeker is looking for (free text)'
            ),
            'job_types', jsonb_build_object(
              'type', 'array',
              'items', jsonb_build_object('type', 'string')
            ),
            'categories', jsonb_build_object(
              'type', 'array',
              'items', jsonb_build_object('type', 'string')
            ),
            'min_pay', jsonb_build_object('type', 'number'),
            'country_code', jsonb_build_object('type', 'string'),
            'limit', jsonb_build_object('type', 'integer', 'default', 5)
          ),
          'required', jsonb_build_array('search_text')
        )
      )
    ),
    jsonb_build_object(
      'type', 'function',
      'function', jsonb_build_object(
        'name', 'update_seeker_profile',
        'description', 'Save or update job seeker profile and preferences',
        'parameters', jsonb_build_object(
          'type', 'object',
          'properties', jsonb_build_object(
            'looking_for', jsonb_build_object('type', 'string'),
            'skills', jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'string')),
            'categories', jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'string')),
            'location', jsonb_build_object('type', 'string'),
            'available_days', jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'string')),
            'min_pay', jsonb_build_object('type', 'number'),
            'pay_type', jsonb_build_object('type', 'string'),
            'languages', jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'string'))
          ),
          'required', jsonb_build_array('looking_for')
        )
      )
    ),
    jsonb_build_object(
      'type', 'function',
      'function', jsonb_build_object(
        'name', 'express_interest',
        'description', 'Apply to a specific job (notify employer)',
        'parameters', jsonb_build_object(
          'type', 'object',
          'properties', jsonb_build_object(
            'job_id', jsonb_build_object('type', 'string', 'format', 'uuid'),
            'message', jsonb_build_object('type', 'string', 'description', 'Optional message to employer')
          ),
          'required', jsonb_build_array('job_id')
        )
      )
    ),
    jsonb_build_object(
      'type', 'function',
      'function', jsonb_build_object(
        'name', 'get_job_details',
        'description', 'Get full details of a specific job',
        'parameters', jsonb_build_object(
          'type', 'object',
          'properties', jsonb_build_object(
            'job_id', jsonb_build_object('type', 'string', 'format', 'uuid')
          ),
          'required', jsonb_build_array('job_id')
        )
      )
    ),
    jsonb_build_object(
      'type', 'function',
      'function', jsonb_build_object(
        'name', 'view_applicants',
        'description', 'View applicants for user''s posted job',
        'parameters', jsonb_build_object(
          'type', 'object',
          'properties', jsonb_build_object(
            'job_id', jsonb_build_object('type', 'string', 'format', 'uuid')
          ),
          'required', jsonb_build_array('job_id')
        )
      )
    ),
    jsonb_build_object(
      'type', 'function',
      'function', jsonb_build_object(
        'name', 'get_my_jobs',
        'description', 'List jobs posted by the current user',
        'parameters', jsonb_build_object(
          'type', 'object',
          'properties', jsonb_build_object(
            'status', jsonb_build_object(
              'type', 'string',
              'enum', jsonb_build_array('open', 'filled', 'closed', 'all'),
              'default', 'open'
            )
          )
        )
      )
    ),
    jsonb_build_object(
      'type', 'function',
      'function', jsonb_build_object(
        'name', 'get_my_applications',
        'description', 'List jobs the user has applied to',
        'parameters', jsonb_build_object(
          'type', 'object',
          'properties', jsonb_build_object(
            'status', jsonb_build_object(
              'type', 'string',
              'enum', jsonb_build_array('pending', 'contacted', 'hired', 'rejected', 'all'),
              'default', 'all'
            )
          )
        )
      )
    ),
    jsonb_build_object(
      'type', 'function',
      'function', jsonb_build_object(
        'name', 'update_job_status',
        'description', 'Change job status (close, reopen, pause)',
        'parameters', jsonb_build_object(
          'type', 'object',
          'properties', jsonb_build_object(
            'job_id', jsonb_build_object('type', 'string', 'format', 'uuid'),
            'status', jsonb_build_object(
              'type', 'string',
              'enum', jsonb_build_array('open', 'filled', 'closed', 'paused')
            )
          ),
          'required', jsonb_build_array('job_id', 'status')
        )
      )
    )
  ),
  -- GUARDRAILS START
  jsonb_build_object(
    'payment_limits', jsonb_build_object(
      'max_per_txn', 0,
      'note', 'Job board does not handle payments directly'
    ),
    'pii_handling', 'minimal',
    'content_moderation', jsonb_build_object(
      'enabled', true,
      'prohibited', jsonb_build_array(
        'illegal activities',
        'adult content',
        'pyramid schemes',
        'discriminatory requirements'
      )
    ),
    'rate_limits', jsonb_build_object(
      'max_jobs_per_day_per_user', 10,
      'max_applications_per_day', 20
    )
  ),
  'gpt-4-turbo-preview',
  0.7,
  1000
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  languages = EXCLUDED.languages,
  instructions = EXCLUDED.instructions,
  tools = EXCLUDED.tools,
  guardrails = EXCLUDED.guardrails,
  updated_at = now();

-- =====================================================
-- 3. Add job-related feature flags
-- =====================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  enabled boolean DEFAULT false,
  rollout_percentage integer DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  countries text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO feature_flags (key, name, description, enabled, rollout_percentage, countries)
VALUES 
  ('FEATURE_JOB_BOARD', 'Job Board & Gigs', 'WhatsApp job marketplace with AI matching', true, 100, NULL),
  ('FEATURE_EXTERNAL_JOB_SOURCES', 'External Job Ingestion', 'Deep Search and SerpAPI job discovery', true, 100, NULL)
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  rollout_percentage = EXCLUDED.rollout_percentage,
  updated_at = now();

-- =====================================================
-- 4. Add comments
-- =====================================================

COMMENT ON TABLE agent_configs IS 
  'AI agent configurations with instructions, tools, and guardrails. Job board agent registered here.';

COMMENT ON TABLE feature_flags IS 
  'Feature flag configuration for gradual rollout and A/B testing. Controls job board visibility.';

COMMIT;
