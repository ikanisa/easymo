-- Migration: Add User RLS Policies for Insurance Tables
-- Purpose: Allow users to view their own insurance policies
-- This addresses the P1-5 issue: missing user-facing RLS policies
-- Created: 2025-11-25

BEGIN;

-- RLS Policy: Users can view their own policies
-- Drop if exists to make migration idempotent
DROP POLICY IF EXISTS "Users can view own policies" ON public.insurance_policies;

CREATE POLICY "Users can view own policies"
  ON public.insurance_policies
  FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policy: Users can view their own quotes
DROP POLICY IF EXISTS "Users can view own quotes" ON public.insurance_quotes;

CREATE POLICY "Users can view own quotes"
  ON public.insurance_quotes
  FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policy: Users can view their own leads
DROP POLICY IF EXISTS "Users can view own leads" ON public.insurance_leads;

CREATE POLICY "Users can view own leads"
  ON public.insurance_leads
  FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policy: Users can view their own media in queue
DROP POLICY IF EXISTS "Users can view own media queue" ON public.insurance_media_queue;

CREATE POLICY "Users can view own media queue"
  ON public.insurance_media_queue
  FOR SELECT
  USING (profile_id = auth.uid());

-- Add comment for documentation
COMMENT ON POLICY "Users can view own policies" ON public.insurance_policies IS 
  'Allow authenticated users to view their own insurance policies';

COMMIT;
