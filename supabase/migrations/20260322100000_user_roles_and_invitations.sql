BEGIN;

-- Ensure a lightweight roles catalog exists
CREATE TABLE IF NOT EXISTS public.roles (
  slug text PRIMARY KEY,
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

INSERT INTO public.roles (slug, description)
VALUES
  ('admin', 'Full administrative access'),
  ('manager', 'Operational access to manage teams and inventory'),
  ('member', 'Standard authenticated user access')
ON CONFLICT (slug) DO UPDATE
  SET description = EXCLUDED.description;

-- Map users to roles (profiles are authoritative for user_ids)
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role_slug text NOT NULL REFERENCES public.roles(slug),
  assigned_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  assigned_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_slug)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

-- Invitation pipeline for controlled onboarding
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role_slug text NOT NULL REFERENCES public.roles(slug),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  invited_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT timezone('utc', now()) + interval '14 days',
  accepted_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations (lower(email));
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations (status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON public.invitations (expires_at DESC);

-- Harden access with RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Service role can manage everything
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'Service role manages user_roles'
  ) THEN
    CREATE POLICY "Service role manages user_roles" ON public.user_roles
      FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role')
      WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invitations'
      AND policyname = 'Service role manages invitations'
  ) THEN
    CREATE POLICY "Service role manages invitations" ON public.invitations
      FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role')
      WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- Authenticated users can inspect their own roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'Users can read own roles'
  ) THEN
    CREATE POLICY "Users can read own roles" ON public.user_roles
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Invited users can read the invitation sent to their email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invitations'
      AND policyname = 'Users can read their invitations'
  ) THEN
    CREATE POLICY "Users can read their invitations" ON public.invitations
      FOR SELECT
      USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
  END IF;
END $$;

COMMIT;
