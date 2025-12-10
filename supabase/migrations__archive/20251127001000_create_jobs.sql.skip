-- Migration: create jobs table and RLS policies
BEGIN;

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  salary INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_jobs_profile ON public.jobs(profile_id);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_owner_full ON public.jobs
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY job_public_read ON public.jobs
  FOR SELECT TO anon, authenticated
  USING (true);

COMMIT;
