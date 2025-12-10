-- Skip the legacy remote schema teardown migration in local environments.
DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO supabase_migrations.schema_migrations (version)
  VALUES ('20251017220824_remote_schema.sql')
  ON CONFLICT (version) DO NOTHING;
END
$$;
