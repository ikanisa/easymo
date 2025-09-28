# Messaging Policy Compliance

## Policy Chain

- Implemented order: **Opt-out → Quiet Hours → Throttle**
  (`admin-app/lib/server/policy.ts:84-128`).
- Opt-out list pulled from `settings` (`opt_out.list`); quiet hours default
  `22:00–06:00`; throttle per-minute fallback 60.
- Policy evaluation returns `{ allowed: boolean, reason, message }`;
  `voucher_send` API responds 409 when blocked
  (`admin-app/app/api/vouchers/send/route.ts:33-78`).

## Quiet Hours

- Default window: 22:00–06:00 Rwanda; adjustable via settings form
  (`admin-app/components/settings/SettingsForm.tsx`).
- Recommendation: Expand schema to support Malta region specifics; ensure
  timezone stored.

## Throttles

- In-memory map (`throttleBucket`) tracks per-minute limit; resets every 60s.
  Needs persistence or distributed cache in production.
- Campaign dispatcher currently relies on future Edge Function to chunk sends
  (see `admin-app/docs/API.md`).

## Opt-Out

- Opt-out list expected hashed; UI instructs operators to hash numbers
  (`UX_POLISH_BRIEF.md`). Confirm hashing implemented before storing.
- Provide operator runbook for manual opt-out entries.

## Failure Messaging

- Blocked sends return JSON with `status: 'blocked'`, `reason`, `message`; UI
  should surface toast (currently manual). Ensure logs capture reason.

## Campaign Dispatcher Rules

- Actions (`start`, `pause`, `stop`) call bridge
  (`admin-app/app/api/campaigns/[id]/*`). No chunking logic defined yet.
- Recommend: Implement dispatcher with batching (e.g., 100 msgs/min),
  exponential backoff, jitter, and DLR handling.
- Ensure retriable errors, opt-out filtering before queue.

## Compliance Checklist

- [ ] Document timezone-aware quiet hours per region.
- [ ] Hash opt-out entries server-side; restrict UI to hashed values.
- [ ] Persist throttle counters to Supabase or Redis for multi-instance support.
- [ ] Log policy decisions to observability stack (`OBSERVABILITY_GAPS.md`).
- [ ] Add automated tests for policy order.

## Validation Steps

- Simulate opt-out entry and attempt send; confirm 409 with reason `opt_out`.
- Adjust quiet hours to current time; verify blocked send message.
- Trigger >60 sends/min to same channel; confirm throttle response.
- For campaigns, run dry-run with sample targets; monitor for chunking.
