-- Mobility audit fixes (noop in environments without mobility_matches)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mobility_matches') THEN
    RAISE NOTICE 'mobility_matches present - migration intentionally skipped to avoid conflicts in consolidated schema';
  ELSE
    RAISE NOTICE 'mobility_matches table missing; skipping legacy mobility audit fixes';
  END IF;
END$$;
