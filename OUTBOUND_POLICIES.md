# Outbound Messaging Policies

All outbound sends (voucher tickets, campaign messages, nudges) must respect opt-out lists, quiet hours, and throttle settings. This document defines evaluation order, UI feedback, and testing scenarios.

## Evaluation Order
1. **Opt-Out Check**
   - Source: `settings.opt_out_list` (array of msisdn hashes) or dedicated `opt_outs` table.
   - Decision: if recipient is opted out → block send with reason `opt_out`.
2. **Quiet Hours Check**
   - Source: `settings.quiet_hours` keyed by locale or country.
   - Decision: if current timestamp (TZ aware) is inside quiet window → block send with reason `quiet_hours`.
3. **Throttle Check**
   - Source: `settings.send_throttle` (per-minute caps per channel).
   - Decision: if sending would exceed cap → block send with reason `throttled` and provide retry-after timestamp.
4. **Permit**
   - If all checks pass → proceed with EF bridge call.

All checks must be logged in `audit_log` with action `outbound_policy_check` whenever a send is blocked.

## Admin UI Feedback
- **Toast Notification**: `Send blocked – {{reason_copy}}.`
- **Detail Banner**: Inline banner summarizing the block with CTA to open Settings.
- **Retry Guidance**:
  - For opt-out: show "Recipient opted out. Remove from list only with explicit consent." (link to policy doc).
  - For quiet hours: display next permissible window (derived server-side) and disable send button until then.
  - For throttling: show "Retry after HH:MM" and surface current send counters.
- **Settings Shortcut**: Provide `Adjust settings` button deep-linking to Quiet Hours / Throttles sections (permission gated to Super Admin).

## Test Matrix
| # | Scenario | Preconditions | Action | Expected Result |
|---|----------|---------------|--------|-----------------|
| 1 | Opt-out direct send | Recipient hash in opt-out list | Trigger voucher resend | Blocked; toast references opt-out |
| 2 | Opt-out campaign target | Target flagged `opted_out` | Start campaign | Target remains queued with error `opt_out` |
| 3 | Quiet hours single send | Quiet hours 22:00–06:00; current 23:00 | Send voucher | Blocked; next window shown |
| 4 | Quiet hours bulk send | 5 targets; 3 outside, 2 inside quiet window (locale-based) | Start campaign | 3 send, 2 blocked with reason |
| 5 | Throttle cap hit | Limit 10/min; 10 sent in last 60s | Send voucher | Blocked; retry-after timestamp shown |
| 6 | Throttle recover | Same as #5 but after retry-after | Retry send | Success and throttle counter resets |
| 7 | Multiple reasons (opt-out + quiet) | Recipient opted out, quiet hours active | Send voucher | Opt-out takes precedence, quiet hours info in tooltip |
| 8 | Policy override attempt | Support role without override permission | Try to bypass block | Server rejects; audit log entry created |
| 9 | Super Admin adjusts quiet hours | Quiet hours block triggered | Click "Adjust" | Settings modal opens; update allowed |
|10 | Campaign bulk throttle | Batch of 100, throttle 60/min | Start | 60 queued to send, 40 scheduled after throttle window |
|11 | Campaign retries after throttle | After 1 min | Auto retry | Deferred targets transition from `queued_throttled` to `sent` |
|12 | Policy logging | Any block scenario | Review logs | `audit_log` shows entry with reason, actor, context |

## Implementation Notes
- Policy engine lives server-side within Admin APIs; client receives structured error `{ reason: "opt_out" | "quiet_hours" | "throttled", "retry_after"?: ISO string }`.
- Provide metrics counters for blocked reasons to monitor policy efficacy.
- Document override escalation path in `INCIDENT_RUNBOOKS.md`.
