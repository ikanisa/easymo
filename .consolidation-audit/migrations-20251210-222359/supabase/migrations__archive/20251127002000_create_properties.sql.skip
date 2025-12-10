-- Migration: create properties table and RLS policies
BEGIN;

CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  address TEXT,
  price INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_properties_profile ON public.properties(profile_id);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY property_owner_full ON public.properties
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY property_public_read ON public.properties
  FOR SELECT TO anon, authenticated
  USING (true);

COMMIT;
