-- Multi-tenancy: Organizations & Memberships with Row-Level Security (RLS)
-- Creates organization hierarchy (District -> SACCO/MFI) with proper tenant isolation

-- 1. Create organization type enum ---------------------------------------------
CREATE TYPE public.organization_type AS ENUM ('SACCO', 'MFI', 'DISTRICT');

-- 2. Create organizations table ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.organization_type NOT NULL,
  name TEXT NOT NULL,
  district_code TEXT,
  parent_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  
  -- Constraints: district_code required for DISTRICT type
  CONSTRAINT organizations_district_code_check 
    CHECK (
      (type = 'DISTRICT' AND district_code IS NOT NULL) OR
      (type IN ('SACCO', 'MFI'))
    ),
  
  -- Constraints: parent_id should reference DISTRICT for SACCO/MFI
  CONSTRAINT organizations_parent_hierarchy_check
    CHECK (
      (type = 'DISTRICT' AND parent_id IS NULL) OR
      (type IN ('SACCO', 'MFI') AND parent_id IS NOT NULL)
    )
);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS organizations_touch_updated_at ON public.organizations;
CREATE TRIGGER organizations_touch_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_organizations_parent ON public.organizations(parent_id);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON public.organizations(type);
CREATE INDEX IF NOT EXISTS idx_organizations_district_code ON public.organizations(district_code);

-- 3. Extend role enum to support new organizational roles ---------------------
-- First check if the enum exists and needs updating
DO $$
BEGIN
  -- Add new role values if they don't exist
  BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'DISTRICT_MANAGER';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'MFI_MANAGER';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'MFI_STAFF';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 4. Create org_memberships table ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_memberships (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  
  PRIMARY KEY (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON public.org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.org_memberships(user_id);

-- 5. Add org_id columns to tenant tables --------------------------------------

-- Add org_id to app.saccos (link SACCO to its organization)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'saccos' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE app.saccos ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_saccos_org ON app.saccos(org_id);
  END IF;
END $$;

-- Add org_id to app.ikimina
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'ikimina' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE app.ikimina ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_ikimina_org ON app.ikimina(org_id);
  END IF;
END $$;

-- Add org_id to app.members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'members' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE app.members ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_members_org ON app.members(org_id);
  END IF;
END $$;

-- Add org_id to app.payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'payments' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE app.payments ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_payments_org ON app.payments(org_id);
  END IF;
END $$;

-- Add org_id to public.join_requests (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'join_requests'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'join_requests' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.join_requests ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_join_requests_org ON public.join_requests(org_id);
  END IF;
END $$;

-- Add org_id to public.notifications (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(org_id);
  END IF;
END $$;

-- 6. Create helper functions for multi-tenant RLS -----------------------------

-- Check if user is a platform admin (SYSTEM_ADMIN)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'SYSTEM_ADMIN',
    FALSE
  ) OR COALESCE(
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid() AND role = 'SYSTEM_ADMIN'
    ),
    FALSE
  ) OR COALESCE(
    EXISTS (
      SELECT 1 FROM app.user_profiles
      WHERE user_id = auth.uid() AND role = 'SYSTEM_ADMIN'
    ),
    FALSE
  )
$$;

-- Get user's organization memberships
CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
$$;

-- Get all organizations accessible by user (including children via hierarchy)
CREATE OR REPLACE FUNCTION public.user_accessible_org_ids()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE org_hierarchy AS (
    -- Base case: user's direct organization memberships
    SELECT o.id, o.parent_id, om.role
    FROM public.organizations o
    JOIN public.org_memberships om ON om.org_id = o.id
    WHERE om.user_id = auth.uid()
    
    UNION
    
    -- Recursive case: child organizations (for district managers)
    SELECT o.id, o.parent_id, oh.role
    FROM public.organizations o
    JOIN org_hierarchy oh ON o.parent_id = oh.id
    WHERE oh.role = 'DISTRICT_MANAGER'
  )
  SELECT DISTINCT id FROM org_hierarchy
$$;

-- Check if user has access to a specific org_id
CREATE OR REPLACE FUNCTION public.user_can_access_org(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin() 
    OR target_org_id IN (SELECT public.user_accessible_org_ids())
$$;

-- 7. Update RLS policies for tenant tables ------------------------------------

-- Drop existing policies that will be replaced
DROP POLICY IF EXISTS sacco_select_staff ON app.saccos;
DROP POLICY IF EXISTS sacco_select_admin ON app.saccos;
DROP POLICY IF EXISTS sacco_manage_admin ON app.saccos;

DROP POLICY IF EXISTS ikimina_select ON app.ikimina;
DROP POLICY IF EXISTS ikimina_modify ON app.ikimina;

DROP POLICY IF EXISTS members_select ON app.members;
DROP POLICY IF EXISTS members_modify ON app.members;

DROP POLICY IF EXISTS payments_select ON app.payments;
DROP POLICY IF EXISTS payments_insert ON app.payments;
DROP POLICY IF EXISTS payments_update ON app.payments;

-- New RLS policies for app.saccos
CREATE POLICY sacco_select_multitenancy
  ON app.saccos
  FOR SELECT
  USING (
    public.is_platform_admin() 
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND id = app.current_sacco())
  );

CREATE POLICY sacco_modify_multitenancy
  ON app.saccos
  FOR ALL
  USING (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND app.is_admin())
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND app.is_admin())
  );

-- New RLS policies for app.ikimina
CREATE POLICY ikimina_select_multitenancy
  ON app.ikimina
  FOR SELECT
  USING (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

CREATE POLICY ikimina_modify_multitenancy
  ON app.ikimina
  FOR ALL
  USING (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

-- New RLS policies for app.members
CREATE POLICY members_select_multitenancy
  ON app.members
  FOR SELECT
  USING (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

CREATE POLICY members_modify_multitenancy
  ON app.members
  FOR ALL
  USING (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

-- New RLS policies for app.payments
CREATE POLICY payments_select_multitenancy
  ON app.payments
  FOR SELECT
  USING (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

CREATE POLICY payments_insert_multitenancy
  ON app.payments
  FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

CREATE POLICY payments_update_multitenancy
  ON app.payments
  FOR UPDATE
  USING (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

-- RLS policies for public.join_requests (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'join_requests'
  ) THEN
    -- Drop old policies that might conflict
    DROP POLICY IF EXISTS "Staff can manage join requests" ON public.join_requests;
    DROP POLICY IF EXISTS join_requests_staff_manage ON public.join_requests;
    
    -- Create new policy
    EXECUTE 'CREATE POLICY join_requests_multitenancy
      ON public.join_requests
      FOR ALL
      USING (
        auth.uid() = user_id
        OR public.is_platform_admin()
        OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
        OR (org_id IS NULL AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid() AND u.sacco_id = join_requests.sacco_id
        ))
      )';
  END IF;
END $$;

-- RLS policies for public.notifications (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    -- Drop old policies that might conflict
    DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
    DROP POLICY IF EXISTS notifications_service_insert ON public.notifications;
    
    -- Create new policy for org-based access
    EXECUTE 'CREATE POLICY notifications_multitenancy
      ON public.notifications
      FOR SELECT
      USING (
        auth.uid() = user_id
        OR public.is_platform_admin()
        OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
      )';
  END IF;
END $$;

-- 8. Enable RLS on new tables -------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships FORCE ROW LEVEL SECURITY;

-- RLS policies for organizations
CREATE POLICY organizations_select
  ON public.organizations
  FOR SELECT
  USING (
    public.is_platform_admin()
    OR id IN (SELECT public.user_accessible_org_ids())
  );

CREATE POLICY organizations_modify
  ON public.organizations
  FOR ALL
  USING (public.is_platform_admin());

-- RLS policies for org_memberships
CREATE POLICY org_memberships_select_own
  ON public.org_memberships
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_platform_admin()
  );

CREATE POLICY org_memberships_manage_admin
  ON public.org_memberships
  FOR ALL
  USING (public.is_platform_admin());

-- 9. Add helpful comments ------------------------------------------------------
COMMENT ON TABLE public.organizations IS 'Multi-tenant organization hierarchy (District -> SACCO/MFI)';
COMMENT ON TABLE public.org_memberships IS 'User membership in organizations with roles';
COMMENT ON COLUMN public.organizations.parent_id IS 'References parent organization (DISTRICT for SACCOs/MFIs)';
COMMENT ON COLUMN public.organizations.district_code IS 'District code, required for DISTRICT type organizations';
COMMENT ON FUNCTION public.is_platform_admin() IS 'Returns true if current user is SYSTEM_ADMIN';
COMMENT ON FUNCTION public.user_org_ids() IS 'Returns all organization IDs the current user is a member of';
COMMENT ON FUNCTION public.user_accessible_org_ids() IS 'Returns all organization IDs accessible by user including hierarchy';
COMMENT ON FUNCTION public.user_can_access_org(UUID) IS 'Checks if user can access a specific organization';
