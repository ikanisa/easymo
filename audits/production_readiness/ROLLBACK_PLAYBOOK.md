# Rollback Playbook

## Trigger Conditions

- Critical regression in voucher issuance/send.
- EF outages exceeding SLA (>15 minutes).
- Messaging policy malfunction causing mass blocks or spam.

## Immediate Actions

1. **Freeze Deployments:** Halt Admin/Station release pipelines; notify
   engineering Slack.
2. **Disable Campaign Dispatch:** Use admin API or Supabase flag to pause all
   running campaigns.
3. **Suspend Voucher Sends:** Set settings throttle to `0` or toggle feature
   flag to prevent new sends.
4. **Switch to Manual Redeem:** Instruct operators to record redeem requests for
   later processing.

## Rollback Steps

1. **Code Rollback:**
   - Revert Admin Panel/Station PWA to last known good deployment (git tag /
     hosting-platform rollback).
   - Re-deploy Edge Functions from previous version (Supabase CLI
     `functions deploy --import <tag>`).
2. **Config Reset:**
   - Restore previous `settings` snapshot (quiet hours/throttles) from backup.
   - Reapply opt-out entries if overwritten.
3. **Database Adjustments:**
   - If migrations failed, apply inverse migration (new additive script) or
     restore snapshot.
   - Validate voucher states; run reconciliation script to flag anomalies.

## Verification

- Run smoke suite: issue voucher, preview, send, redeem.
- Check integration badges return `OK`.
- Confirm campaign dispatcher remains paused until explicit approval.

## Communication

- Update stakeholders on rollback status; share ETA for resumed operations.
- Record incident in `INCIDENT_RUNBOOKS.md` with timeline.

## Post-Rollback Tasks

- Root cause analysis; identify guardrail gaps.
- Add regression tests to prevent recurrence.
- Update runbooks as needed.
