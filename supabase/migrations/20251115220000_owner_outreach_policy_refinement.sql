BEGIN;

-- owner_outreach policy refinements to restrict system access to the service role
-- Only apply if the table exists (for deployments that have the real estate module)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'owner_outreach') THEN
    -- Drop the broad policy so we can replace it with scoped variants
    DROP POLICY IF EXISTS "system_write_outreach" ON owner_outreach;

    -- Allow the Supabase service role to read outreach records when needed by background jobs
    CREATE POLICY "service_role_read_owner_outreach"
      ON owner_outreach FOR SELECT
      USING (auth.role() = 'service_role');

    -- Service role inserts outreach entries after contacting owners via internal tooling
    CREATE POLICY "service_role_insert_owner_outreach"
      ON owner_outreach FOR INSERT
      WITH CHECK (auth.role() = 'service_role');

    -- Updates should only be performed by the service role to keep transcripts consistent
    CREATE POLICY "service_role_update_owner_outreach"
      ON owner_outreach FOR UPDATE
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');

    -- Deletions are restricted to the service role for data hygiene jobs
    CREATE POLICY "service_role_delete_owner_outreach"
      ON owner_outreach FOR DELETE
      USING (auth.role() = 'service_role');
      
    RAISE NOTICE 'owner_outreach policies updated';
  ELSE
    RAISE NOTICE 'owner_outreach table does not exist, skipping policy updates';
  END IF;
END $$;

COMMIT;
