-- Migration: create businesses table and RLS policies
BEGIN;

-- Table for businesses owned by profiles
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Index for fast lookup by owner
CREATE INDEX IF NOT EXISTS idx_businesses_profile ON public.businesses(profile_id);

-- Row Level Security: owners can read/write their own rows, others read only
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Owner can select, insert, update, delete their own rows
CREATE POLICY business_owner_full ON public.businesses
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Everyone (including anon) can read businesses (public view)
CREATE POLICY business_public_read ON public.businesses
  FOR SELECT TO anon, authenticated
  USING (true);

COMMIT;
