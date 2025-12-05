-- ============================================================================
-- Jobs Call Intake Schema
-- Structured capture for job-related calls (jobseekers and posters)
-- ============================================================================

BEGIN;

-- Jobs call intake table
CREATE TABLE IF NOT EXISTS jobs_call_intakes (
  call_id UUID PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('jobseeker','poster')),
  
  -- Role details
  role_title TEXT,
  category TEXT,                      -- 'waiter', 'driver', 'accountant', 'construction', etc.
  seniority TEXT,                     -- 'junior','mid','senior'
  
  -- Location
  location_country TEXT DEFAULT 'Rwanda',
  location_city TEXT,
  location_district TEXT,
  location_sector TEXT,
  
  -- Compensation
  salary_min NUMERIC,
  salary_max NUMERIC,
  currency TEXT DEFAULT 'RWF',
  
  -- Employment details
  employment_type TEXT CHECK (employment_type IN ('full_time','part_time','gig','one_off','internship','freelance')),
  remote_preference TEXT CHECK (remote_preference IN ('onsite','remote','hybrid')),
  
  -- Experience and skills
  experience_years NUMERIC,
  skills TEXT[],                      -- Key skills array
  certifications TEXT[],              -- Required/possessed certifications
  education_level TEXT,               -- 'none', 'primary', 'secondary', 'vocational', 'university'
  
  -- Availability
  availability_date DATE,
  can_start_immediately BOOLEAN DEFAULT false,
  
  -- Contact preferences
  preferred_contact_method TEXT CHECK (preferred_contact_method IN ('whatsapp','phone','sms','email')),
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  extracted_from_summary BOOLEAN DEFAULT false,  -- True if auto-extracted from call_summaries
  confidence_score NUMERIC(4,3),                 -- Extraction confidence
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_call_intakes_mode ON jobs_call_intakes(mode);
CREATE INDEX IF NOT EXISTS idx_jobs_call_intakes_category ON jobs_call_intakes(category);
CREATE INDEX IF NOT EXISTS idx_jobs_call_intakes_location ON jobs_call_intakes(location_district, location_sector);
CREATE INDEX IF NOT EXISTS idx_jobs_call_intakes_skills ON jobs_call_intakes USING GIN (skills);

-- Jobs matches table
CREATE TABLE IF NOT EXISTS jobs_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The intake that triggered matching
  intake_call_id UUID NOT NULL REFERENCES jobs_call_intakes(call_id) ON DELETE CASCADE,
  
  -- Match details (one of these will be populated)
  matched_job_id UUID,                -- If intake was jobseeker, this is the matched job posting
  matched_profile_id UUID,            -- If intake was poster, this is the matched candidate profile
  matched_intake_call_id UUID REFERENCES jobs_call_intakes(call_id), -- Match to another call intake
  
  -- Scoring
  match_score NUMERIC(5,4) NOT NULL,  -- 0.0000 to 1.0000
  match_reasons JSONB DEFAULT '[]'::jsonb,  -- Array of { field, score, reason }
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'viewed', 'accepted', 'rejected', 'expired')),
  notified_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_matches_intake_call_id ON jobs_matches(intake_call_id);
CREATE INDEX IF NOT EXISTS idx_jobs_matches_status ON jobs_matches(status);
CREATE INDEX IF NOT EXISTS idx_jobs_matches_score ON jobs_matches(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_matches_expires ON jobs_matches(expires_at) WHERE status = 'pending';

-- Comments
COMMENT ON TABLE jobs_call_intakes IS 'Structured job-related data extracted from calls';
COMMENT ON COLUMN jobs_call_intakes.mode IS 'Whether caller is seeking a job or posting one';
COMMENT ON COLUMN jobs_call_intakes.skills IS 'Array of skills mentioned during call';

COMMENT ON TABLE jobs_matches IS 'Matches between jobseekers and job postings';
COMMENT ON COLUMN jobs_matches.match_score IS 'Computed match score between 0 and 1';
COMMENT ON COLUMN jobs_matches.match_reasons IS 'Detailed breakdown of why this match scored well';

-- Enable RLS
ALTER TABLE jobs_call_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs_matches ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Service role can manage jobs intakes"
  ON jobs_call_intakes FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view their own job intakes"
  ON jobs_call_intakes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM calls WHERE calls.id = jobs_call_intakes.call_id AND calls.user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage jobs matches"
  ON jobs_matches FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view their own matches"
  ON jobs_matches FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM jobs_call_intakes jci
    JOIN calls c ON c.id = jci.call_id
    WHERE jci.call_id = jobs_matches.intake_call_id AND c.user_id = auth.uid()
  ));

COMMIT;
