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
  supabase db remote commit --file supabase/seed/fixtures/phase_b_seed.sql
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

### WhatsApp router operations
- Apply router migrations in sequence:
  ```bash
  supabase db push --file supabase/migrations/20260127160000_router_keyword_map.sql
  supabase db push --file supabase/migrations/20260127161000_router_logs.sql
  supabase db push --file supabase/migrations/20260131120000_router_infrastructure.sql
  ```
- Destinations live in `public.router_destinations`. Ensure the `slug` matches
  entries in the runtime allowlist (`ROUTER_DEST_ALLOWLIST`) and update the
  `url` column for each environment.
- Keyword-to-destination bindings resolve through the
  `public.router_keyword_destinations` view (join of keyword map + destinations).
  Use `SELECT * FROM public.router_keyword_destinations ORDER BY keyword;` to
  confirm expected routes.
- Idempotency, rate limiting, and telemetry tables (`router_idempotency`,
  `router_rate_limits`, `router_telemetry`) should be monitored for growth. The
  router edge function writes telemetry records for `message_duplicate`,
  `message_rate_limited`, `keyword_unmatched`, `message_routed`, and
  `downstream_error` events.
- Deployment target now lives under `apps/router-fn`. Build and test locally via:
  ```bash
  deno test -A apps/router-fn/src
  supabase functions deploy wa-router
  ```
- Confirm allowlist enforcement by verifying that the destination slug or host
  exists in `ROUTER_DEST_ALLOWLIST`. Requests to non-allowlisted endpoints are
  silently ignored and logged as unmatched.

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

### Storage retention rotation (voucher PNG/QR, insurance docs)
1. Run `scripts/supabase-backup-restore.sh` or `supabase storage list --bucket`
   to export an inventory for `voucher-png`, `voucher-qr`, and
   `insurance-docs`.
2. Verify AWS S3 lifecycle rules:
   ```bash
   aws s3api get-bucket-lifecycle-configuration --bucket $AWS_BACKUP_BUCKET \
     --query "Rules[?contains(ID, 'voucher') || contains(ID, 'insurance')]"
   ```
   Ensure voucher buckets expire objects after 90 days and insurance documents
   after 30 days.
3. For manual rotations, list timestamped prefixes and delete folders older than
   the retention window:
   ```bash
   aws s3 ls s3://$AWS_BACKUP_BUCKET/supabase/
   aws s3 rm s3://$AWS_BACKUP_BUCKET/supabase/20240101T000000/storage/voucher-png/ --recursive
   ```
   (Always run with `--dryrun` first and only prune prefixes beyond 90 days for
   voucher assets or 30 days for insurance documents.)
4. Update the retention log (`backups/<timestamp>/backup.log`) with the
   rotation window reviewed and any deletions executed.
