-- =====================================================================
-- FIX: Add missing columns to job_listings and job_seekers tables
-- =====================================================================
-- Migration to add columns to existing tables for AI Agent ecosystem
-- =====================================================================

BEGIN;

-- Fix job_listings table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_listings') THEN
    -- Add user_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_listings' AND column_name = 'user_id') THEN
      ALTER TABLE public.job_listings ADD COLUMN user_id uuid;
      ALTER TABLE public.job_listings ADD CONSTRAINT job_listings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
    
    -- Add country_code
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_listings' AND column_name = 'country_code') THEN
      ALTER TABLE public.job_listings ADD COLUMN country_code text DEFAULT 'RW';
    END IF;
    
    -- Add category
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_listings' AND column_name = 'category') THEN
      ALTER TABLE public.job_listings ADD COLUMN category text;
    END IF;
    
    -- Add job_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_listings' AND column_name = 'job_type') THEN
      ALTER TABLE public.job_listings ADD COLUMN job_type text DEFAULT 'full_time';
    END IF;
    
    -- Add required_skills
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_listings' AND column_name = 'required_skills') THEN
      ALTER TABLE public.job_listings ADD COLUMN required_skills text[];
    END IF;
    
    -- Add is_external
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_listings' AND column_name = 'is_external') THEN
      ALTER TABLE public.job_listings ADD COLUMN is_external boolean DEFAULT false;
    END IF;
    
    -- Add external_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_listings' AND column_name = 'external_url') THEN
      ALTER TABLE public.job_listings ADD COLUMN external_url text;
    END IF;
    
    RAISE NOTICE 'Fixed job_listings table columns';
  END IF;
END$$;

-- Fix job_seekers table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_seekers') THEN
    -- Add user_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_seekers' AND column_name = 'user_id') THEN
      ALTER TABLE public.job_seekers ADD COLUMN user_id uuid;
      ALTER TABLE public.job_seekers ADD CONSTRAINT job_seekers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
    
    -- Add country_code
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_seekers' AND column_name = 'country_code') THEN
      ALTER TABLE public.job_seekers ADD COLUMN country_code text DEFAULT 'RW';
    END IF;
    
    -- Add availability
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_seekers' AND column_name = 'availability') THEN
      ALTER TABLE public.job_seekers ADD COLUMN availability text DEFAULT 'full_time';
    END IF;
    
    -- Add location_preference
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_seekers' AND column_name = 'location_preference') THEN
      ALTER TABLE public.job_seekers ADD COLUMN location_preference text;
    END IF;
    
    RAISE NOTICE 'Fixed job_seekers table columns';
  END IF;
END$$;

COMMIT;
