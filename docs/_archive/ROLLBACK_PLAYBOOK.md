# Rollback Playbook

Use this playbook to disable new Admin features quickly without editing
forbidden paths.

## Immediate Stabilization (≤5 minutes)

1. **Disable Campaign Dispatch**
   - Hit `/api/campaigns/stop` for all running campaigns.
   - Toggle dispatcher EF (if available) into maintenance mode via provided
     endpoint.
2. **Block New Voucher Sends**
   - Update settings:
     - `send_throttle.whatsapp.per_minute = 0`
     - `quiet_hours` start = now, end = now + 24h (temporary block).
3. **Notify Stakeholders**
   - Post in #ops and #product with current status and expected timeline.
4. **Freeze Station Redeems (if required)**
   - Toggle feature flag in settings `station_redeem_enabled = false` (additive
     config).
5. **Suspend OCR Queue Processing**
   - Pause the Supabase scheduled job invoking `insurance-ocr` or set
     `OCR_QUEUE_SCAN_LIMIT=0` via environment override to stop further document
     ingestion.
6. **Fallback Alert Preferences to Mocks**
   - Set `NEXT_PUBLIC_USE_MOCKS=true` (and redeploy Admin app) so `/api/settings/alerts`
     serves degraded mock data while Supabase issues are resolved.

## Data Integrity Safeguards

- Ensure voucher statuses reflect true state (manually adjust via Admin API if
  mismatch).
- Capture export of campaign_targets and vouchers issued during incident for
  reconciliation.

## Revert UI Access (if needed)

- Rotate Supabase service role keys to invalidate Admin sessions.
- Keys live in AWS Secrets Manager (`prod/easymo/supabase/service-role` and
  `stg/easymo/supabase/service-role`). Use the project matrix
  (`docs/deployment/supabase-projects.md`) to contact owners, fetch the secret
  via `aws secretsmanager get-secret-value`, and update Vercel + Edge Function
  environments before revoking the previous key in Supabase.
- Provide fallback instructions (legacy tooling or manual support channel).

## Recovery Steps

1. Identify root cause using incident runbooks.
2. Restore settings (throttle, quiet hours) to previous values.
3. Re-enable `station_redeem_enabled` and dispatcher once healthy.
4. Resume `insurance-ocr` schedule and return `NEXT_PUBLIC_USE_MOCKS` to its
   previous value after verifying Supabase connectivity.
5. Run smoke subset: vouchers preview/send, campaign start, station redeem.
6. Communicate recovery confirmation and document in incident tracker.

## Follow-Up

- File postmortem within 48 hours.
- Create action items for long-term fixes (monitoring, tests, automation).
- Update this playbook if new mitigations emerge.
