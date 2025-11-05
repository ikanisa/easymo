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

### WhatsApp router fan-out (`apps/router-fn`)
- Deploy the Deno application alongside edge functions: `supabase functions deploy router-fn` after exporting `WA_APP_SECRET`,
  `WA_VERIFY_TOKEN`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Apply the router schema migration before deploying:
  ```bash
  supabase db push --file supabase/migrations/20260201090000_router_fn_foundation.sql
  ```
- Destination allowlists live in `router_destinations`. Update rows instead of changing environment variables, and keep URLs HTTPS.
- Idempotency and rate limiting use `router_message_gate` and `router_rate_limits`. Empty the tables with `DELETE` statements if
  you need to replay traffic in lower environments.
- Structured telemetry is emitted as console JSON with the `ROUTER_TELEMETRY` event. Unknown keywords and downstream failures
  are summarized in the payload.
- Run regression tests locally with:
  ```bash
  deno test --config apps/router-fn/deno.json
  ```
  The suite covers signature replay, unknown keywords, and downstream error scenarios.

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
