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

## DR Tabletop Test – Backup/Restore Cutover

- **Cadence**: First Tuesday of each quarter at 14:00 UTC (next: 2025-01-07).
- **Participants**: Incident Commander (on-call engineer), Data Platform Lead,
  Support Manager, Stakeholder Communications (Customer Success lead).

### Scenario Outline
1. **Notification Drill**
   - Trigger PagerDuty "DR-Tabletop" event; ensure all participants acknowledge
     within 5 minutes.
   - Support Manager posts customer-facing holding statement draft in
     `#ops-status` for review.
2. **Backup Execution**
   - Run `scripts/supabase-backup-restore.sh` with staging project ref.
   - Capture runtime, S3 destination, and row-count parity in the generated
     `backup.log` and `rowcount.csv`.
3. **Restore & Cutover Rehearsal**
   - Validate staging smoke tests (voucher issue/redeem, campaign send, station
     redeem) and log results in the tabletop report.
   - Review DNS/env var cutover checklist without executing production change;
     confirm rollback owner.
4. **Stakeholder Comms**
   - Draft status page update and escalation email template; store in
     `docs/incidents/templates/` (create if missing and link in tabletop notes).
5. **Findings & Follow-Up**
   - File retro notes in this runbook section with action owners and due dates.
   - Update `SYSTEM_CHECKLIST.md` if new controls are introduced.

### Latest Findings (2024-10-01 Tabletop)
- Snapshot manifest fetch initially failed (HTTP 401); resolved by rotating the
  Supabase access token and re-running the script.
- Storage sync took 11 minutes; action item to enable multipart uploads for
  voucher PNG bucket before next exercise.
