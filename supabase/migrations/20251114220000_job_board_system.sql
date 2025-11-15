-- =====================================================
-- JOB BOARD AI AGENT - Database Schema
-- =====================================================
-- WhatsApp-based job marketplace with AI matching
-- Supports miscellaneous gig jobs and structured positions
-- Uses OpenAI embeddings for semantic matching
-- =====================================================

BEGIN;

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE job_type AS ENUM ('gig', 'part_time', 'full_time', 'contract', 'temporary');
CREATE TYPE pay_type AS ENUM ('hourly', 'daily', 'weekly', 'monthly', 'fixed', 'commission', 'negotiable');
CREATE TYPE job_status AS ENUM ('open', 'filled', 'closed', 'expired', 'paused');
CREATE TYPE match_type AS ENUM ('automatic', 'manual', 'ai_suggested');
CREATE TYPE match_status AS ENUM ('suggested', 'viewed', 'contacted', 'hired', 'rejected', 'expired');
CREATE TYPE user_role AS ENUM ('job_seeker', 'job_poster', 'both');

-- =====================================================
-- TABLE: job_listings
-- =====================================================

CREATE TABLE job_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Poster info
  posted_by text NOT NULL,
  poster_name text,
  
  -- Job details
  title text NOT NULL,
  description text NOT NULL,
  job_type job_type NOT NULL DEFAULT 'gig',
  category text NOT NULL,
  
  -- Location
  location text NOT NULL,
  location_details text,
  location_embedding vector(1536),
  
  -- Compensation
  pay_min numeric,
  pay_max numeric,
  pay_type pay_type NOT NULL DEFAULT 'negotiable',
  currency text DEFAULT 'RWF',
  
  -- Timing
  duration text,
  start_date timestamptz,
  end_date timestamptz,
  flexible_hours boolean DEFAULT false,
  
  -- Requirements
  required_skills jsonb DEFAULT '[]'::jsonb,
  required_skills_embedding vector(1536),
  experience_level text,
  physical_demands text,
  tools_needed text[],
  
  -- Logistics
  transport_provided boolean DEFAULT false,
  team_size text,
  weather_dependent boolean DEFAULT false,
  
  -- Contact
  contact_method text,
  contact_phone text,
  
  -- Status
  status job_status NOT NULL DEFAULT 'open',
  filled_at timestamptz,
  
  -- AI-extracted metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  
  -- Constraints
  CONSTRAINT pay_range_valid CHECK (pay_min IS NULL OR pay_max IS NULL OR pay_min <= pay_max)
);

-- Indexes
CREATE INDEX job_listings_posted_by_idx ON job_listings(posted_by);
CREATE INDEX job_listings_status_idx ON job_listings(status) WHERE status = 'open';
CREATE INDEX job_listings_category_idx ON job_listings(category);
CREATE INDEX job_listings_job_type_idx ON job_listings(job_type);
CREATE INDEX job_listings_created_at_idx ON job_listings(created_at DESC);
CREATE INDEX job_listings_start_date_idx ON job_listings(start_date) WHERE start_date IS NOT NULL;
CREATE INDEX job_listings_expires_at_idx ON job_listings(expires_at) WHERE expires_at IS NOT NULL;

-- Vector index for semantic search
CREATE INDEX job_listings_skills_embedding_idx 
ON job_listings 
USING hnsw (required_skills_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- GIN index for JSONB metadata
CREATE INDEX job_listings_metadata_idx ON job_listings USING gin(metadata);
CREATE INDEX job_listings_required_skills_idx ON job_listings USING gin(required_skills);

-- =====================================================
-- TABLE: job_seekers
-- =====================================================

CREATE TABLE job_seekers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  phone_number text UNIQUE NOT NULL,
  name text,
  bio text,
  bio_embedding vector(1536),
  
  -- Skills & Experience
  skills jsonb DEFAULT '[]'::jsonb,
  skills_embedding vector(1536),
  experience_years int,
  certifications text[],
  languages text[],
  
  -- Preferences
  preferred_job_types job_type[],
  preferred_categories text[],
  preferred_locations text[],
  preferred_pay_types pay_type[],
  
  -- Availability
  availability jsonb DEFAULT '{}'::jsonb,
  available_immediately boolean DEFAULT true,
  min_pay numeric,
  max_distance_km numeric,
  
  -- Profile status
  profile_complete boolean DEFAULT false,
  verified boolean DEFAULT false,
  rating numeric(3,2) CHECK (rating >= 0 AND rating <= 5),
  total_jobs_completed int DEFAULT 0,
  
  -- Contact preferences
  preferred_contact_method text DEFAULT 'whatsapp',
  notifications_enabled boolean DEFAULT true,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_active timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX job_seekers_phone_number_idx ON job_seekers(phone_number);
CREATE INDEX job_seekers_last_active_idx ON job_seekers(last_active DESC);
CREATE INDEX job_seekers_profile_complete_idx ON job_seekers(profile_complete);
CREATE INDEX job_seekers_available_immediately_idx ON job_seekers(available_immediately) WHERE available_immediately = true;

-- Vector index for matching
CREATE INDEX job_seekers_skills_embedding_idx 
ON job_seekers 
USING hnsw (skills_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- GIN indexes
CREATE INDEX job_seekers_skills_idx ON job_seekers USING gin(skills);
CREATE INDEX job_seekers_metadata_idx ON job_seekers USING gin(metadata);
CREATE INDEX job_seekers_preferred_categories_idx ON job_seekers USING gin(preferred_categories);

-- =====================================================
-- TABLE: job_matches
-- =====================================================

CREATE TABLE job_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Match parties
  job_id uuid NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
  seeker_id uuid NOT NULL REFERENCES job_seekers(id) ON DELETE CASCADE,
  
  -- Match quality
  similarity_score float NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  match_reasons jsonb DEFAULT '{}'::jsonb,
  match_type match_type NOT NULL DEFAULT 'automatic',
  
  -- Interest tracking
  seeker_interested boolean DEFAULT false,
  seeker_message text,
  seeker_viewed_at timestamptz,
  poster_interested boolean DEFAULT false,
  poster_viewed_at timestamptz,
  
  -- Status
  status match_status NOT NULL DEFAULT 'suggested',
  contacted_at timestamptz,
  hired_at timestamptz,
  rejected_reason text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(job_id, seeker_id)
);

-- Indexes
CREATE INDEX job_matches_job_id_idx ON job_matches(job_id);
CREATE INDEX job_matches_seeker_id_idx ON job_matches(seeker_id);
CREATE INDEX job_matches_status_idx ON job_matches(status);
CREATE INDEX job_matches_similarity_score_idx ON job_matches(similarity_score DESC);
CREATE INDEX job_matches_created_at_idx ON job_matches(created_at DESC);
CREATE INDEX job_matches_seeker_interested_idx ON job_matches(seeker_interested) WHERE seeker_interested = true;
CREATE INDEX job_matches_poster_interested_idx ON job_matches(poster_interested) WHERE poster_interested = true;

-- =====================================================
-- TABLE: job_conversations
-- =====================================================

CREATE TABLE job_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identity
  phone_number text NOT NULL,
  user_name text,
  role user_role NOT NULL DEFAULT 'job_seeker',
  
  -- Conversation state
  conversation_state jsonb DEFAULT '{}'::jsonb,
  current_intent text,
  
  -- Message history (limited for performance)
  messages jsonb[] DEFAULT ARRAY[]::jsonb[],
  message_count int DEFAULT 0,
  
  -- Extracted data from conversation
  extracted_metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Context
  active_job_id uuid REFERENCES job_listings(id) ON DELETE SET NULL,
  active_seeker_id uuid REFERENCES job_seekers(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT messages_array_size_limit CHECK (array_length(messages, 1) IS NULL OR array_length(messages, 1) <= 50)
);

-- Indexes
CREATE INDEX job_conversations_phone_number_idx ON job_conversations(phone_number);
CREATE INDEX job_conversations_last_message_at_idx ON job_conversations(last_message_at DESC);
CREATE INDEX job_conversations_active_job_id_idx ON job_conversations(active_job_id) WHERE active_job_id IS NOT NULL;
CREATE INDEX job_conversations_active_seeker_id_idx ON job_conversations(active_seeker_id) WHERE active_seeker_id IS NOT NULL;
CREATE INDEX job_conversations_extracted_metadata_idx ON job_conversations USING gin(extracted_metadata);

-- =====================================================
-- TABLE: job_applications
-- =====================================================

CREATE TABLE job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Application details
  job_id uuid NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
  seeker_id uuid NOT NULL REFERENCES job_seekers(id) ON DELETE CASCADE,
  match_id uuid REFERENCES job_matches(id) ON DELETE SET NULL,
  
  -- Application content
  cover_message text,
  proposed_rate numeric,
  availability_note text,
  
  -- Status
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  response_message text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(job_id, seeker_id)
);

-- Indexes
CREATE INDEX job_applications_job_id_idx ON job_applications(job_id);
CREATE INDEX job_applications_seeker_id_idx ON job_applications(seeker_id);
CREATE INDEX job_applications_status_idx ON job_applications(status);
CREATE INDEX job_applications_created_at_idx ON job_applications(created_at DESC);

-- =====================================================
-- TABLE: job_analytics
-- =====================================================

CREATE TABLE job_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event tracking
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  
  -- User context
  phone_number text,
  user_role user_role,
  
  -- Event data
  event_data jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX job_analytics_event_type_idx ON job_analytics(event_type);
CREATE INDEX job_analytics_entity_type_idx ON job_analytics(entity_type);
CREATE INDEX job_analytics_entity_id_idx ON job_analytics(entity_id);
CREATE INDEX job_analytics_phone_number_idx ON job_analytics(phone_number);
CREATE INDEX job_analytics_created_at_idx ON job_analytics(created_at DESC);

-- Partitioning by month (for large-scale analytics)
-- CREATE TABLE job_analytics_y2025m01 PARTITION OF job_analytics FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_job_listings_updated_at BEFORE UPDATE ON job_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_seekers_updated_at BEFORE UPDATE ON job_seekers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_matches_updated_at BEFORE UPDATE ON job_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_conversations_updated_at BEFORE UPDATE ON job_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_applications_updated_at BEFORE UPDATE ON job_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Vector Similarity Search Functions
-- =====================================================

-- Match jobs for a seeker based on skills embedding
CREATE OR REPLACE FUNCTION match_jobs_for_seeker(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20,
  filter_job_types job_type[] DEFAULT NULL,
  filter_categories text[] DEFAULT NULL,
  min_pay numeric DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  job_type job_type,
  category text,
  location text,
  pay_min numeric,
  pay_max numeric,
  pay_type pay_type,
  similarity_score float
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    jl.id,
    jl.title,
    jl.description,
    jl.job_type,
    jl.category,
    jl.location,
    jl.pay_min,
    jl.pay_max,
    jl.pay_type,
    1 - (jl.required_skills_embedding <=> query_embedding) as similarity_score
  FROM job_listings jl
  WHERE 
    jl.status = 'open'
    AND jl.required_skills_embedding IS NOT NULL
    AND 1 - (jl.required_skills_embedding <=> query_embedding) > match_threshold
    AND (filter_job_types IS NULL OR jl.job_type = ANY(filter_job_types))
    AND (filter_categories IS NULL OR jl.category = ANY(filter_categories))
    AND (min_pay IS NULL OR jl.pay_max IS NULL OR jl.pay_max >= min_pay)
    AND (jl.expires_at IS NULL OR jl.expires_at > now())
  ORDER BY jl.required_skills_embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Match seekers for a job based on skills embedding
CREATE OR REPLACE FUNCTION match_seekers_for_job(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20,
  filter_locations text[] DEFAULT NULL,
  max_pay numeric DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  phone_number text,
  name text,
  bio text,
  skills jsonb,
  experience_years int,
  rating numeric,
  similarity_score float
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    js.id,
    js.phone_number,
    js.name,
    js.bio,
    js.skills,
    js.experience_years,
    js.rating,
    1 - (js.skills_embedding <=> query_embedding) as similarity_score
  FROM job_seekers js
  WHERE 
    js.skills_embedding IS NOT NULL
    AND js.available_immediately = true
    AND 1 - (js.skills_embedding <=> query_embedding) > match_threshold
    AND (filter_locations IS NULL OR js.preferred_locations && filter_locations)
    AND (max_pay IS NULL OR js.min_pay IS NULL OR js.min_pay <= max_pay)
    AND js.last_active > now() - INTERVAL '30 days'
  ORDER BY js.skills_embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Expire old jobs automatically
CREATE OR REPLACE FUNCTION expire_old_jobs()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE job_listings
  SET status = 'expired'
  WHERE status = 'open'
    AND expires_at IS NOT NULL
    AND expires_at < now();
$$;

-- =====================================================
-- RLS (Row Level Security) Policies
-- =====================================================

ALTER TABLE job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_seekers ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_analytics ENABLE ROW LEVEL SECURITY;

-- Job Listings: Public read for open jobs, write for poster
DROP POLICY IF EXISTS "Public can view open job listings" ON job_listings;
CREATE POLICY "Public can view open job listings"
  ON job_listings FOR SELECT
  USING (status = 'open' OR posted_by = current_setting('request.jwt.claims', true)::json->>'phone');

DROP POLICY IF EXISTS "Users can create job listings" ON job_listings;
CREATE POLICY "Users can create job listings"
  ON job_listings FOR INSERT
  WITH CHECK (posted_by = current_setting('request.jwt.claims', true)::json->>'phone');

DROP POLICY IF EXISTS "Poster can update own job listings" ON job_listings;
CREATE POLICY "Poster can update own job listings"
  ON job_listings FOR UPDATE
  USING (posted_by = current_setting('request.jwt.claims', true)::json->>'phone');

DROP POLICY IF EXISTS "Poster can delete own job listings" ON job_listings;
CREATE POLICY "Poster can delete own job listings"
  ON job_listings FOR DELETE
  USING (posted_by = current_setting('request.jwt.claims', true)::json->>'phone');

-- Job Seekers: Users can read/write own profile
DROP POLICY IF EXISTS "Users can view own seeker profile" ON job_seekers;
CREATE POLICY "Users can view own seeker profile"
  ON job_seekers FOR SELECT
  USING (phone_number = current_setting('request.jwt.claims', true)::json->>'phone');

DROP POLICY IF EXISTS "Users can create own seeker profile" ON job_seekers;
CREATE POLICY "Users can create own seeker profile"
  ON job_seekers FOR INSERT
  WITH CHECK (phone_number = current_setting('request.jwt.claims', true)::json->>'phone');

DROP POLICY IF EXISTS "Users can update own seeker profile" ON job_seekers;
CREATE POLICY "Users can update own seeker profile"
  ON job_seekers FOR UPDATE
  USING (phone_number = current_setting('request.jwt.claims', true)::json->>'phone');

-- Job Matches: Seeker and poster can view their matches
DROP POLICY IF EXISTS "Users can view their job matches" ON job_matches;
CREATE POLICY "Users can view their job matches"
  ON job_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM job_seekers js WHERE js.id = job_matches.seeker_id 
      AND js.phone_number = current_setting('request.jwt.claims', true)::json->>'phone'
    )
    OR EXISTS (
      SELECT 1 FROM job_listings jl WHERE jl.id = job_matches.job_id 
      AND jl.posted_by = current_setting('request.jwt.claims', true)::json->>'phone'
    )
  );

DROP POLICY IF EXISTS "Users can update their match status" ON job_matches;
CREATE POLICY "Users can update their match status"
  ON job_matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM job_seekers js WHERE js.id = job_matches.seeker_id 
      AND js.phone_number = current_setting('request.jwt.claims', true)::json->>'phone'
    )
    OR EXISTS (
      SELECT 1 FROM job_listings jl WHERE jl.id = job_matches.job_id 
      AND jl.posted_by = current_setting('request.jwt.claims', true)::json->>'phone'
    )
  );

-- Job Conversations: Users can view/update own conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON job_conversations;
CREATE POLICY "Users can view own conversations"
  ON job_conversations FOR SELECT
  USING (phone_number = current_setting('request.jwt.claims', true)::json->>'phone');

DROP POLICY IF EXISTS "Users can create own conversations" ON job_conversations;
CREATE POLICY "Users can create own conversations"
  ON job_conversations FOR INSERT
  WITH CHECK (phone_number = current_setting('request.jwt.claims', true)::json->>'phone');

DROP POLICY IF EXISTS "Users can update own conversations" ON job_conversations;
CREATE POLICY "Users can update own conversations"
  ON job_conversations FOR UPDATE
  USING (phone_number = current_setting('request.jwt.claims', true)::json->>'phone');

-- Job Applications: Seeker and poster can view
DROP POLICY IF EXISTS "Users can view related applications" ON job_applications;
CREATE POLICY "Users can view related applications"
  ON job_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM job_seekers js WHERE js.id = job_applications.seeker_id 
      AND js.phone_number = current_setting('request.jwt.claims', true)::json->>'phone'
    )
    OR EXISTS (
      SELECT 1 FROM job_listings jl WHERE jl.id = job_applications.job_id 
      AND jl.posted_by = current_setting('request.jwt.claims', true)::json->>'phone'
    )
  );

DROP POLICY IF EXISTS "Seekers can create applications" ON job_applications;
CREATE POLICY "Seekers can create applications"
  ON job_applications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_seekers js WHERE js.id = job_applications.seeker_id 
      AND js.phone_number = current_setting('request.jwt.claims', true)::json->>'phone'
    )
  );

-- Analytics: Admin only (service role)
DROP POLICY IF EXISTS "Service role can manage analytics" ON job_analytics;
CREATE POLICY "Service role can manage analytics"
  ON job_analytics FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- Seed Data for Categories
-- =====================================================

CREATE TABLE job_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  icon text,
  parent_category text,
  typical_pay_range text,
  common_skills text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO job_categories (name, description, icon, typical_pay_range, common_skills) VALUES
  ('construction', 'Construction and building work', '🏗️', '10000-30000 RWF/day', ARRAY['physical_strength', 'tools', 'teamwork']),
  ('delivery', 'Delivery and transportation', '🚚', '5000-15000 RWF/day', ARRAY['driving', 'motorcycle', 'navigation']),
  ('cleaning', 'Cleaning and housekeeping', '🧹', '5000-12000 RWF/day', ARRAY['attention_to_detail', 'reliability']),
  ('moving_labor', 'Moving and furniture handling', '📦', '8000-20000 RWF/day', ARRAY['physical_strength', 'careful_handling']),
  ('gardening', 'Gardening and landscaping', '🌱', '6000-15000 RWF/day', ARRAY['gardening', 'physical_work']),
  ('painting', 'Painting and decoration', '🎨', '10000-25000 RWF/day', ARRAY['painting', 'attention_to_detail']),
  ('plumbing', 'Plumbing services', '🔧', '15000-40000 RWF/day', ARRAY['plumbing', 'problem_solving', 'tools']),
  ('electrical', 'Electrical work', '⚡', '15000-45000 RWF/day', ARRAY['electrical', 'safety', 'problem_solving']),
  ('security', 'Security and guard services', '🛡️', '8000-18000 RWF/day', ARRAY['alertness', 'responsibility']),
  ('cooking', 'Cooking and catering', '👨‍🍳', '10000-30000 RWF/day', ARRAY['cooking', 'food_safety', 'creativity']),
  ('childcare', 'Childcare and babysitting', '👶', '5000-15000 RWF/day', ARRAY['patience', 'responsibility', 'childcare']),
  ('tutoring', 'Tutoring and education', '📚', '5000-20000 RWF/hour', ARRAY['teaching', 'subject_expertise', 'patience']),
  ('data_entry', 'Data entry and admin', '💻', '3000-10000 RWF/hour', ARRAY['computer', 'typing', 'accuracy']),
  ('customer_service', 'Customer service and support', '📞', '5000-15000 RWF/day', ARRAY['communication', 'problem_solving']),
  ('sales', 'Sales and marketing', '💼', 'Commission-based', ARRAY['communication', 'persuasion', 'networking']),
  ('event_help', 'Event assistance', '🎉', '5000-15000 RWF/day', ARRAY['teamwork', 'flexibility', 'energy']),
  ('farm_work', 'Agricultural work', '🌾', '5000-12000 RWF/day', ARRAY['physical_work', 'farming']),
  ('mechanic', 'Mechanical repair', '🔧', '15000-40000 RWF/day', ARRAY['mechanics', 'problem_solving', 'tools']),
  ('tailoring', 'Tailoring and sewing', '✂️', '8000-25000 RWF/day', ARRAY['sewing', 'precision', 'creativity']),
  ('other', 'Other miscellaneous jobs', '🔧', 'Varies', ARRAY['flexibility']);

COMMIT;
