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

## Data Integrity Safeguards

- Ensure voucher statuses reflect true state (manually adjust via Admin API if
  mismatch).
- Capture export of campaign_targets and vouchers issued during incident for
  reconciliation.

## Revert UI Access (if needed)

- Rotate Supabase service role keys to invalidate Admin sessions.
- Provide fallback instructions (legacy tooling or manual support channel).

## Recovery Steps

1. Identify root cause using incident runbooks.
2. Restore settings (throttle, quiet hours) to previous values.
3. Re-enable `station_redeem_enabled` and dispatcher once healthy.
4. Run smoke subset: vouchers preview/send, campaign start, station redeem.
5. Communicate recovery confirmation and document in incident tracker.

## Follow-Up

- File postmortem within 48 hours.
- Create action items for long-term fixes (monitoring, tests, automation).
- Update this playbook if new mitigations emerge.
