# easyMO Operational Runbook

## Supabase Phase-2 Operations

### Database migrations
1. Pull the latest repo changes.
2. Authenticate with Supabase CLI (`supabase login`).
3. Apply mobility migrations in order:
   ```bash
   supabase db push --file supabase/migrations/20251112090000_phase2_mobility_core.sql
   supabase db push --file supabase/migrations/20251112091000_phase2_mobility_rls.sql
   ```
4. Confirm `settings`, `profiles`, `driver_presence`, `trips`, `subscriptions`,
   `vouchers`, and related tables exist via `supabase db dump --schema public`.

### Seed fixtures
- Populate local/staging data with:
  ```bash
  supabase db push --workdir supabase && psql "$DATABASE_URL" -f supabase/seed/fixtures/phase_b_seed.sql
  ```
- The script is idempotent; rerun when you need fresh simulator presence or
  sample subscriptions.

### Edge function deployment
1. Export the required environment secrets (`SUPABASE_URL`,
   `SERVICE_ROLE_KEY`, `ADMIN_TOKEN`).
2. Deploy each function:
   ```bash
   supabase functions deploy admin-settings
   supabase functions deploy admin-stats
   supabase functions deploy admin-users
   supabase functions deploy admin-trips
   supabase functions deploy admin-subscriptions
   supabase functions deploy simulator
   ```
3. Verify functions with:
   ```bash
   curl -H "x-admin-token: $ADMIN_TOKEN" \
     "$SUPABASE_URL/functions/v1/admin-settings"
   ```

### Monitoring & logging
- Use Supabase dashboard → Functions → Logs to monitor invocations.
- Edge functions emit structured logs via `logRequest`/`logResponse`; filter on
  the scope (e.g. `simulator`).
- Front-end errors bubble through toast notifications; enable Sentry by setting
  `SENTRY_DSN` and `SENTRY_ENVIRONMENT` in the environment file.

## Support playbooks

### Simulator access denied
1. Confirm the driver profile exists via `/functions/v1/simulator?action=profile&ref_code=XXX`.
2. Ensure an active subscription record exists for the driver (`status = active`
   and `expires_at > now()`).
3. If necessary, approve the subscription in the admin UI or call the
   `/functions/v1/admin-subscriptions?action=approve` endpoint.

### Settings changes not persisting
1. Confirm the admin panel is using the real adapter (`VITE_USE_MOCK` is unset).
2. Check the edge function logs for `admin-settings.update_failed`.
3. Re-run the migrations to ensure the `settings` table exists and RLS policies
   allow admin updates.

### Trip closures failing
1. Inspect `/functions/v1/admin-trips?action=list` for the target trip.
2. Confirm the trip `status` is `active`; closed trips are ignored.
3. Retry the close action; if it fails, check Supabase logs for
   `admin-trips.close_failed` and verify the RLS policy `trips_admin_manage` is
   applied.
