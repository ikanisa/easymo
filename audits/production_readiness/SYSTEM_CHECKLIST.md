# Release Readiness Checklist

## Environment & Access

- [ ] Production vs staging Supabase projects documented with owners and access
      controls.
- [ ] Service role keys stored in secrets manager; never present in client
      bundles (`admin-app/docs/API.md`).
- [ ] Admin roles assigned via `admin_roles` table with audit trail.

## Secrets & Config

- [ ] `.env` templates reviewed; mandatory variables
      (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, WABA endpoints)
      present.
- [ ] Edge Function shared secrets rotated and referenced via bridge helper
      (`admin-app/lib/server/edge-bridges.ts`).

## Data Protection & RLS

- [ ] RLS policies audited for `vouchers`, `voucher_events`, `campaigns`,
      `campaign_targets`, `insurance_quotes`, `settings`.
- [ ] Opt-out hashes stored using SHA-256; verification script documented.

## Backup / Restore / DR

- [ ] Supabase automated backups schedule confirmed; restoration dry-run
      completed and logged.
- [ ] Storage bucket snapshot/retention policy documented.
- [ ] DR communication tree tested.

## CI / Quality Gates

- [ ] Lint + Vitest suites run in CI (`pnpm --filter admin-app lint/test`).
- [ ] Admin PWA smoke tests (voucher issue/send/preview) executed on staging.
- [ ] Station PWA redeem path validated (scan + manual code).

## Edge Function Availability

- [ ] Voucher preview/send, campaign dispatcher, insurance workflow health
      probes monitored (`EF_AVAILABILITY_MATRIX.md`).
- [ ] On-call alert thresholds configured (degraded >5m).

## Messaging Policy Enforcement

- [ ] Quiet hours, opt-out, throttle values confirmed in `settings` table.
- [ ] Policy evaluation order tested (opt-out → quiet hours → throttle) via
      staging dry-run.
- [ ] Blocked sends recorded in monitoring dashboard.

## Voucher Lifecycle

- [ ] Issuance → preview → send → redeem/expire tested with audit trail
      (`voucher_events`).
- [ ] Station scope enforcement validated (redeem fails outside scope).
- [ ] PNG/QR integrity checks executed (no re-encode, correct branding).

## Campaign Operations

- [ ] Template catalogue validated against WhatsApp approvals.
- [ ] Campaign dispatcher chunk size documented; retries with jitter tested.
- [ ] Notifications/outbox resend + cancel flows pass smoke tests.

## Observability & Alerts

- [ ] Structured logs include actor, entity, action, integration status.
- [ ] Dashboards cover KPIs (voucher issuance, campaign send rate, policy
      blocks).
- [ ] PagerDuty/Slack alerts wired for EF downtime, policy anomalies, redeem
      failures.

## Runbooks & Rollbacks

- [ ] Incident runbooks reviewed and signed off (`INCIDENT_RUNBOOKS.md`).
- [ ] Rollback playbook tested: disable campaign dispatch, halt notifications,
      restore last stable release.
- [ ] Operator guide accessible to support staff.

## Accessibility & UX

- [ ] Admin Panel keyboard navigation audit complete; screen-reader pass
      recorded.
- [ ] Station PWA outdoor legibility and large-type mode enabled.
- [ ] Empty/loading/error states validated per `UX_POLISH_BRIEF.md`.

## Go/No-Go Decision

- [ ] Risk register reviewed; P1/P2 risks mitigated or accepted with sign-off.
- [ ] Business stakeholders approve messaging/campaign launch criteria.
- [ ] Legal/privacy officer confirms Malta/Rwanda compliance.
