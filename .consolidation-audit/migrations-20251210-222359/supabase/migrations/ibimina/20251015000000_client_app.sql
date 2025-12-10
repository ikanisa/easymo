-- Deprecated legacy client app bootstrap.
-- The real runtime now lives in app.* with public views recreated later.
-- This migration is intentionally left as a no-op so historical records remain
-- in supabase_migrations while replays on upgraded databases do not fail.

do $$
begin
  raise notice 'Skipping 20251015_client_app (deprecated legacy bootstrap).';
end;
$$;
