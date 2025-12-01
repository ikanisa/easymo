-- Migration: Fix Insurance Foreign Key Consistency
-- Date: 2025-11-25
-- Purpose: Standardize all insurance tables to reference profiles(user_id) instead of auth.users(id)
-- This ensures consistency across insurance_leads, insurance_quotes, and insurance_policies

BEGIN;

-- 1. Fix insurance_leads table
DO $$ 
BEGIN
    -- Drop old FK constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'insurance_leads_user_id_fkey'
    ) THEN
        ALTER TABLE public.insurance_leads 
        DROP CONSTRAINT insurance_leads_user_id_fkey;
    END IF;
    
    -- Add new FK to profiles(user_id)
    ALTER TABLE public.insurance_leads 
    ADD CONSTRAINT insurance_leads_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
    ON DELETE SET NULL;
    
EXCEPTION
    WHEN undefined_table THEN
        -- If profiles table doesn't exist yet, skip this constraint
        RAISE NOTICE 'Skipping insurance_leads FK: profiles table not found';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating insurance_leads FK: %', SQLERRM;
END $$;

-- 2. Fix insurance_quotes table
DO $$ 
BEGIN
    -- Drop old FK constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'insurance_quotes_user_id_fkey'
    ) THEN
        ALTER TABLE public.insurance_quotes 
        DROP CONSTRAINT insurance_quotes_user_id_fkey;
    END IF;
    
    -- Add new FK to profiles(user_id)
    ALTER TABLE public.insurance_quotes 
    ADD CONSTRAINT insurance_quotes_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
    ON DELETE SET NULL;
    
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Skipping insurance_quotes FK: profiles table not found';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating insurance_quotes FK: %', SQLERRM;
END $$;

-- 3. Fix insurance_media_queue table (also references auth.users)
DO $$ 
BEGIN
    -- Drop old FK constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'insurance_media_queue_profile_id_fkey'
    ) THEN
        ALTER TABLE public.insurance_media_queue 
        DROP CONSTRAINT insurance_media_queue_profile_id_fkey;
    END IF;
    
    -- Add new FK to profiles(user_id)
    ALTER TABLE public.insurance_media_queue 
    ADD CONSTRAINT insurance_media_queue_profile_id_fkey 
    FOREIGN KEY (profile_id) REFERENCES public.profiles(user_id) 
    ON DELETE SET NULL;
    
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Skipping insurance_media_queue FK: profiles table not found';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating insurance_media_queue FK: %', SQLERRM;
END $$;

-- 4. Add composite indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_insurance_leads_user_status 
ON public.insurance_leads(user_id, status, created_at DESC)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_insurance_quotes_user_status 
ON public.insurance_quotes(user_id, status, updated_at DESC)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_insurance_media_queue_profile_status 
ON public.insurance_media_queue(profile_id, status, created_at DESC)
WHERE profile_id IS NOT NULL;

COMMIT;
