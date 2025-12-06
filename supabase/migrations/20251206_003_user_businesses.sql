BEGIN;

-- Migration 3: Create user_businesses linking table for business ownership tracking

CREATE TABLE IF NOT EXISTS public.user_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.business(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'staff')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verification_method TEXT CHECK (verification_method IN ('search_claim', 'manual_add', 'admin_assign', 'deeplink')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure unique user-business pairs
  UNIQUE (user_id, business_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_businesses_user_id ON public.user_businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_businesses_business_id ON public.user_businesses(business_id);
CREATE INDEX IF NOT EXISTS idx_user_businesses_role ON public.user_businesses(role);

-- Enable RLS
ALTER TABLE public.user_businesses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "user_businesses_read_own" ON public.user_businesses
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_businesses_insert_own" ON public.user_businesses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_businesses_update_own" ON public.user_businesses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_businesses_delete_own" ON public.user_businesses
  FOR DELETE
  USING (auth.uid() = user_id AND role = 'owner');

-- Migration: Sync existing business ownership from business.owner_user_id
INSERT INTO public.user_businesses (user_id, business_id, role, is_verified, verification_method, claimed_at)
SELECT 
  b.owner_user_id,
  b.id,
  'owner',
  true,
  'admin_assign',
  COALESCE(b.created_at, now())
FROM public.business b
WHERE b.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_businesses ub
    WHERE ub.user_id = b.owner_user_id
      AND ub.business_id = b.id
  )
ON CONFLICT (user_id, business_id) DO NOTHING;

COMMIT;
