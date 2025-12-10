-- =====================================================================
-- APPLY INTENT: JOBS AGENT (ENHANCED)
-- =====================================================================
-- Domain-specific intent application for Jobs Agent
-- Called by agent framework after intent is parsed
--
-- FEATURES:
-- - Post job listings (employers)
-- - Search for jobs (job seekers)
-- - Create job seeker profiles
-- - Submit job applications
-- - View application status
-- - Semantic matching (job ↔ seeker)
-- - Multi-country support
--
-- INTENT TYPES SUPPORTED:
-- - post_job, create_job: Employer posts a job
-- - find_job, search_jobs: Job seeker searches for work
-- - create_profile, update_profile: Job seeker creates/updates profile
-- - apply_job: Submit application
-- - view_applications, my_applications: View submitted applications
-- - view_my_jobs, my_postings: Employer views their job posts
-- - update_job: Edit existing job post
-- - close_job: Close job listing
--
-- Updated: 2025-11-22 (Phase 3 - Jobs Agent)
-- =====================================================================

BEGIN;

-- First, ensure job tables exist (minimal schema for agent to work)
CREATE TABLE IF NOT EXISTS public.job_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  country_code text DEFAULT 'RW',
  category text,
  job_type text DEFAULT 'full_time',
  pay_min numeric,
  pay_max numeric,
  currency text DEFAULT 'RWF',
  required_skills text[],
  is_external boolean DEFAULT false,
  source_id text,
  external_url text,
  status text DEFAULT 'open',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_seekers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  skills text[],
  experience_years integer,
  availability text DEFAULT 'full_time',
  location_preference text,
  country_code text DEFAULT 'RW',
  min_pay numeric,
  currency text DEFAULT 'RWF',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_listings(id) ON UPDATE CASCADE ON DELETE CASCADE,
  seeker_id uuid NOT NULL REFERENCES public.job_seekers(id) ON UPDATE CASCADE ON DELETE CASCADE,
  status text DEFAULT 'pending',
  cover_message text,
  applied_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(job_id, seeker_id)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_job_listings_user_id ON public.job_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_job_listings_status ON public.job_listings(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_job_listings_country ON public.job_listings(country_code);
CREATE INDEX IF NOT EXISTS idx_job_seekers_user_id ON public.job_seekers(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_seeker_id ON public.job_applications(seeker_id);

-- Main RPC function
CREATE OR REPLACE FUNCTION public.apply_intent_jobs(
  intent_id uuid,
  payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_intent_type text;
  v_user_id uuid;
  v_result jsonb := '{}';
  v_updated_entities jsonb[] := '{}';
  v_matches jsonb[] := '{}';
  v_next_action text;
BEGIN
  -- 1. Get intent details
  SELECT ai.intent_type, wc.user_id
  INTO v_intent_type, v_user_id
  FROM ai_agent_intents ai
  JOIN whatsapp_conversations wc ON wc.id = ai.conversation_id
  WHERE ai.id = intent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intent not found: %', intent_id;
  END IF;

  -- 2. Apply intent based on type
  CASE v_intent_type
    
    -- POST JOB (Employer creates job listing)
    WHEN 'post_job', 'create_job', 'hire' THEN
      DECLARE
        v_title text;
        v_description text;
        v_location text;
        v_category text;
        v_job_type text;
        v_pay_min numeric;
        v_pay_max numeric;
        v_currency text;
        v_skills text[];
        v_job_id uuid;
      BEGIN
        v_title := payload->>'title';
        v_description := payload->>'description';
        v_location := payload->>'location';
        v_category := payload->>'category';
        v_job_type := COALESCE(payload->>'job_type', 'full_time');
        v_pay_min := (payload->>'pay_min')::numeric;
        v_pay_max := (payload->>'pay_max')::numeric;
        v_currency := COALESCE(payload->>'currency', 'RWF');
        v_skills := CASE 
          WHEN payload->'skills' IS NOT NULL THEN 
            ARRAY(SELECT jsonb_array_elements_text(payload->'skills'))
          ELSE NULL
        END;
        
        IF v_title IS NOT NULL THEN
          INSERT INTO job_listings (
            user_id, title, description, location, category,
            job_type, pay_min, pay_max, currency, required_skills,
            status, metadata
          )
          VALUES (
            v_user_id, v_title, v_description, v_location, v_category,
            v_job_type, v_pay_min, v_pay_max, v_currency, v_skills,
            'open',
            jsonb_build_object('source', 'whatsapp_agent')
          )
          RETURNING id INTO v_job_id;
          
          v_next_action := format('Job "%s" posted! We''ll notify matching candidates.', v_title);
          
          v_updated_entities := ARRAY[
            jsonb_build_object(
              'type', 'job_listing',
              'id', v_job_id::text,
              'action', 'created',
              'title', v_title,
              'pay_range', format('%s-%s %s', v_pay_min, v_pay_max, v_currency)
            )
          ];
          
          -- Find matching job seekers (simplified - production would use embeddings)
          DECLARE
            v_matching_seekers jsonb;
          BEGIN
            SELECT jsonb_agg(
              jsonb_build_object(
                'seeker_id', js.id,
                'user_id', js.user_id,
                'skills', js.skills,
                'experience', js.experience_years
              )
            )
            INTO v_matching_seekers
            FROM job_seekers js
            WHERE js.country_code = (SELECT country_code FROM job_listings WHERE id = v_job_id)
              AND (js.min_pay IS NULL OR js.min_pay <= v_pay_max)
            LIMIT 10;
            
            IF v_matching_seekers IS NOT NULL THEN
              v_matches := ARRAY[
                jsonb_build_object(
                  'type', 'job_seeker_match',
                  'job_id', v_job_id::text,
                  'seekers', v_matching_seekers
                )
              ];
            END IF;
          END;
        ELSE
          v_next_action := 'Need job title. Ask for basic job details.';
        END IF;
      END;
    
    -- SEARCH JOBS (Job seeker finds work)
    WHEN 'find_job', 'search_jobs', 'looking_for_work' THEN
      DECLARE
        v_category text;
        v_location text;
        v_job_type text;
        v_min_pay numeric;
        v_jobs jsonb;
      BEGIN
        v_category := payload->>'category';
        v_location := payload->>'location';
        v_job_type := payload->>'job_type';
        v_min_pay := (payload->>'min_pay')::numeric;
        
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', j.id,
            'title', j.title,
            'location', j.location,
            'pay_range', format('%s-%s %s', j.pay_min, j.pay_max, j.currency),
            'job_type', j.job_type,
            'posted', j.created_at
          )
        )
        INTO v_jobs
        FROM job_listings j
        WHERE j.status = 'open'
          AND (v_category IS NULL OR j.category = v_category)
          AND (v_location IS NULL OR j.location ILIKE '%' || v_location || '%')
          AND (v_job_type IS NULL OR j.job_type = v_job_type)
          AND (v_min_pay IS NULL OR j.pay_max >= v_min_pay)
        ORDER BY j.created_at DESC
        LIMIT 10;
        
        IF v_jobs IS NOT NULL AND jsonb_array_length(v_jobs) > 0 THEN
          v_next_action := format('Found %s jobs. Show with emoji numbers.', jsonb_array_length(v_jobs));
        ELSE
          v_next_action := 'No jobs found matching criteria. Suggest broader search or create job alert.';
        END IF;
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'job_search_results',
            'action', 'searched',
            'jobs', v_jobs
          )
        ];
      END;
    
    -- CREATE/UPDATE JOB SEEKER PROFILE
    WHEN 'create_profile', 'update_profile', 'my_profile' THEN
      DECLARE
        v_skills text[];
        v_experience integer;
        v_availability text;
        v_location text;
        v_min_pay numeric;
        v_seeker_id uuid;
      BEGIN
        v_skills := CASE 
          WHEN payload->'skills' IS NOT NULL THEN 
            ARRAY(SELECT jsonb_array_elements_text(payload->'skills'))
          ELSE NULL
        END;
        v_experience := (payload->>'experience_years')::integer;
        v_availability := payload->>'availability';
        v_location := payload->>'location_preference';
        v_min_pay := (payload->>'min_pay')::numeric;
        
        INSERT INTO job_seekers (
          user_id, skills, experience_years, availability,
          location_preference, min_pay, metadata
        )
        VALUES (
          v_user_id, v_skills, v_experience, v_availability,
          v_location, v_min_pay,
          jsonb_build_object('source', 'whatsapp_agent')
        )
        ON CONFLICT (user_id) 
        DO UPDATE SET
          skills = COALESCE(EXCLUDED.skills, job_seekers.skills),
          experience_years = COALESCE(EXCLUDED.experience_years, job_seekers.experience_years),
          availability = COALESCE(EXCLUDED.availability, job_seekers.availability),
          location_preference = COALESCE(EXCLUDED.location_preference, job_seekers.location_preference),
          min_pay = COALESCE(EXCLUDED.min_pay, job_seekers.min_pay),
          updated_at = now()
        RETURNING id INTO v_seeker_id;
        
        v_next_action := 'Profile updated! Ready to search for jobs.';
        
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'job_seeker_profile',
            'id', v_seeker_id::text,
            'action', 'updated',
            'skills', v_skills
          )
        ];
      END;
    
    -- APPLY FOR JOB
    WHEN 'apply_job', 'submit_application' THEN
      DECLARE
        v_job_id uuid;
        v_seeker_id uuid;
        v_cover_message text;
        v_application_id uuid;
        v_job_title text;
      BEGIN
        v_job_id := (payload->>'job_id')::uuid;
        v_cover_message := payload->>'cover_message';
        
        -- Ensure seeker profile exists
        SELECT id INTO v_seeker_id FROM job_seekers WHERE user_id = v_user_id;
        
        IF v_seeker_id IS NULL THEN
          v_next_action := 'Please create your profile first before applying.';
        ELSIF v_job_id IS NOT NULL THEN
          -- Get job title
          SELECT title INTO v_job_title FROM job_listings WHERE id = v_job_id;
          
          INSERT INTO job_applications (job_id, seeker_id, cover_message, status)
          VALUES (v_job_id, v_seeker_id, v_cover_message, 'pending')
          ON CONFLICT (job_id, seeker_id)
          DO UPDATE SET updated_at = now()
          RETURNING id INTO v_application_id;
          
          v_next_action := format('Application submitted for "%s"! Employer will be notified.', v_job_title);
          
          v_updated_entities := ARRAY[
            jsonb_build_object(
              'type', 'job_application',
              'id', v_application_id::text,
              'action', 'submitted',
              'job_title', v_job_title
            )
          ];
        ELSE
          v_next_action := 'Which job do you want to apply for?';
        END IF;
      END;
    
    -- VIEW APPLICATIONS (Job seeker)
    WHEN 'view_applications', 'my_applications', 'application_status' THEN
      DECLARE
        v_applications jsonb;
      BEGIN
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ja.id,
            'job_title', jl.title,
            'employer', wu.display_name,
            'status', ja.status,
            'applied_at', ja.applied_at
          )
        )
        INTO v_applications
        FROM job_applications ja
        JOIN job_seekers js ON js.id = ja.seeker_id
        JOIN job_listings jl ON jl.id = ja.job_id
        LEFT JOIN whatsapp_users wu ON wu.id = jl.user_id
        WHERE js.user_id = v_user_id
        ORDER BY ja.applied_at DESC
        LIMIT 10;
        
        v_next_action := 'Show application history with emoji numbers';
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'applications_list',
            'action', 'viewed',
            'applications', v_applications
          )
        ];
      END;
    
    -- VIEW MY JOBS (Employer)
    WHEN 'view_my_jobs', 'my_postings', 'my_jobs' THEN
      DECLARE
        v_jobs jsonb;
      BEGIN
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', j.id,
            'title', j.title,
            'status', j.status,
            'applications', (
              SELECT COUNT(*) FROM job_applications WHERE job_id = j.id
            ),
            'posted', j.created_at
          )
        )
        INTO v_jobs
        FROM job_listings j
        WHERE j.user_id = v_user_id
        ORDER BY j.created_at DESC
        LIMIT 10;
        
        v_next_action := 'Show job postings with application counts';
        v_updated_entities := ARRAY[
          jsonb_build_object(
            'type', 'employer_jobs',
            'action', 'viewed',
            'jobs', v_jobs
          )
        ];
      END;
    
    -- CLOSE JOB
    WHEN 'close_job', 'fill_position' THEN
      DECLARE
        v_job_id uuid;
      BEGIN
        v_job_id := (payload->>'job_id')::uuid;
        
        IF v_job_id IS NOT NULL THEN
          UPDATE job_listings
          SET status = 'closed', updated_at = now()
          WHERE id = v_job_id AND user_id = v_user_id;
          
          IF FOUND THEN
            v_next_action := 'Job closed. No more applications will be accepted.';
          ELSE
            v_next_action := 'Could not close job (not found or not yours).';
          END IF;
        END IF;
      END;
    
    -- GENERAL INQUIRY
    WHEN 'general_inquiry', 'help' THEN
      v_next_action := 'Provide help about posting jobs, finding work, or managing applications';
    
    -- UNKNOWN INTENT
    ELSE
      v_next_action := 'Ask clarifying question or show job/seeker options';
  END CASE;

  -- 3. Build result
  v_result := jsonb_build_object(
    'success', true,
    'updated_entities', array_to_json(v_updated_entities),
    'matches', array_to_json(v_matches),
    'next_action', v_next_action
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.apply_intent_jobs IS
'Applies Jobs Agent intents to domain tables (job_listings, job_seekers, job_applications)';

COMMIT;

-- =====================================================================
-- EXAMPLE USAGE
-- =====================================================================
/*
-- Test: Post a job
SELECT apply_intent_jobs(
  'some-intent-uuid'::uuid,
  '{"title": "Software Engineer", "description": "Build amazing apps", "pay_min": 500000, "pay_max": 800000, "location": "Kigali"}'::jsonb
);

-- Test: Search for jobs
SELECT apply_intent_jobs(
  'some-intent-uuid'::uuid,
  '{"category": "tech", "location": "Kigali", "min_pay": 300000}'::jsonb
);

-- Test: Create job seeker profile
SELECT apply_intent_jobs(
  'some-intent-uuid'::uuid,
  '{"skills": ["JavaScript", "React", "Node.js"], "experience_years": 3, "min_pay": 400000}'::jsonb
);

-- Test: Apply for job
SELECT apply_intent_jobs(
  'some-intent-uuid'::uuid,
  '{"job_id": "some-job-uuid", "cover_message": "I am interested in this position"}'::jsonb
);
*/
