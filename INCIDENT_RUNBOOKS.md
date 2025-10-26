# Incident Runbooks

## Voucher Preview Failures

1. **Detect**: Integrations Status shows voucher PNG = red or preview modal
   error reports `not_configured`/`timeout`.
2. **Immediate Actions**
   - Confirm Supabase Edge Function deployment status via Supabase dashboard.
   - Retry probe using `/api/integrations/status?force=true`.
3. **Mitigation**
   - Communicate to support team: "Voucher previews unavailable; fallback to
     code view." (Slack #ops channel).
   - Ensure Admin UI degraded copy is visible.
4. **Resolution**
   - Redeploy EF or fix network issue.
   - Verify preview works; close incident in PagerDuty.
5. **Postmortem Inputs**
   - Capture timeline, impacted vouchers, and mitigations used.

## WhatsApp Send Failures

1. **Detect**: Elevated failures in Notifications, toast error `send_failed`, or
   EF returning 5xx/429.
2. **Immediate Actions**
   - Pause campaigns via Admin Panel (`Stop` action) to prevent further sends.
   - Check quiet hours and throttle settings to ensure they are not
     misconfigured.
3. **Mitigation**
   - If rate-limited (429), honor `retry-after` and reschedule sends.
   - If invalid numbers, export failed targets for data cleanup.
4. **Escalation**
   - Notify WABA provider if issue persists >15 minutes.
5. **Resolution**
   - Resume campaigns once EF returns `202`.
   - Log incident summary in audit log under `incident_resolution`.

## Campaign Dispatcher Stalls

1. **Detect**: Campaign detail shows running but targets not advancing;
   Integrations Status amber/red.
2. **Immediate Actions**
   - Hit `status` endpoint; confirm queue length.
   - Pause campaign to prevent stale state.
3. **Mitigation**
   - Replay dispatcher by calling `stop` then `start` once EF healthy.
   - If EF unreachable, keep campaign paused and notify engineering.
4. **Resolution**
   - Verify target statuses update within 5 minutes.
   - Record actions in `audit_log`.

## Station Redeem Anomalies

1. **Detect**: Station PWA returns errors for valid vouchers or allows double
   redemption.
2. **Immediate Actions**
   - Check `/api/station/redeem` logs for idempotency failures.
   - Review voucher status and events for affected IDs.
3. **Mitigation**
   - If double redemption: mark voucher `void` and issue replacement manually.
   - If scope mismatch: update voucher `station_scope` or educate station
     operator.
4. **Escalation**
   - Notify Data Ops if OCR mapping produced wrong station scope.
5. **Resolution**
   - Add incident note in Logs page and communicate to vendor support.

## Supabase Credential Leak

1. **Detect**: Service-role key appears in logs/repos or an external party gains
   access to Admin APIs without authorisation.
2. **Immediate Actions**
   - Notify the primary owner listed in
     `docs/deployment/supabase-projects.md` (production or staging as
     appropriate).
   - Fetch a replacement key from AWS Secrets Manager
     (`prod/easymo/supabase/service-role` or
     `stg/easymo/supabase/service-role`) using the AWS CLI.
3. **Mitigation**
   - Update Vercel + Supabase Edge Function environments with the new key.
   - Revoke the leaked key in the Supabase dashboard and invalidate Admin
     sessions.
4. **Resolution**
   - Confirm Admin API access requires the new key only.
   - Post an incident summary with rotation timestamp in #ops.
