-- Ensure security helpers and policies for agent documents bucket
BEGIN;

-- (Re)define public.is_admin() helper to avoid policy fallbacks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  claims := auth.jwt();
  RETURN coalesce(
    claims ->> 'role' = 'admin'
    OR claims -> 'app_metadata' ->> 'role' = 'admin'
    OR claims -> 'user_roles' ? 'admin',
    false
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Tighten access to agent-docs storage bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'agent_docs_service_rw'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY agent_docs_service_rw
      ON storage.objects
      FOR ALL
      USING (bucket_id = 'agent-docs' AND auth.role() = 'service_role')
      WITH CHECK (bucket_id = 'agent-docs' AND auth.role() = 'service_role');
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'agent_docs_admin_read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY agent_docs_admin_read
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'agent-docs' AND public.is_admin());
    $policy$;
  END IF;
END;
$$;

COMMIT;
