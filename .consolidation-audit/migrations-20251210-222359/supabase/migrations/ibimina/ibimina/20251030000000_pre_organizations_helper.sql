-- Helper migration to create placeholder for migrations that reference organizations
-- This allows migrations dated before 20251110 (when organizations is created) to work

-- Create a temporary placeholder organizations table if it doesn't exist
-- The real organizations table will be created in 20251110100000_multitenancy.sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
    CREATE TABLE public.organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    COMMENT ON TABLE public.organizations IS 'Temporary placeholder - will be replaced by 20251110100000_multitenancy.sql';
  END IF;
  
  -- Also create org_memberships placeholder
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'org_memberships') THEN
    CREATE TABLE public.org_memberships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(org_id, user_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.org_memberships(user_id);
    CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON public.org_memberships(org_id);
    
    COMMENT ON TABLE public.org_memberships IS 'Temporary placeholder - will be replaced by multitenancy migration';
  END IF;
END $$;

