# Rollout Plan – Admin Panel

## Phase 1: Staging

- **Objectives**: Validate integrations, fixtures, degraded modes, and smoke
  tests.
- **Checklist**
  - [ ] Fixtures loaded per `DATA_FIXTURES_PLAN.md`.
  - [ ] EF probes show expected status (green/amber).
  - [ ] Admin smoke tests (items 1–20) pass.
  - [ ] Station smoke tests (items 21–30) pass with mocked redeems.
  - [ ] Quiet hours/throttle policies verified (see `OUTBOUND_POLICIES.md`).
  - [ ] Audit logs capturing writes and policy blocks.
  - [ ] Incident runbooks reviewed by Ops.
  - [ ] Rollback toggles documented in settings.
  - [ ] `/api/settings/alerts` served from Supabase with RLS policies enabled;
        degraded mock messaging captured when credentials absent.
  - [ ] `tools/monitoring/admin/synthetic-checks.ts` running against staging `ADMIN_BASE_URL`
        (fails the job on non-2xx responses).

## Phase 2: Pilot

- **Scope**: Limited set of bars/stations (≤5) and support agents (≤3).
- **Checklist**
  - [ ] Pilot participants onboarded with admin roles.
  - [ ] Campaign dispatcher available and tested with ≤20 targets.
  - [ ] Station PWA redeems real vouchers end-to-end.
  - [ ] Daily review of dashboard KPIs and logs.
  - [ ] Opt-out audit ensures no opted-out numbers targeted.
  - [ ] Quiet hour overrides approved by project lead before enabling.
  - [ ] Incident response drill executed (simulate EF outage).

## Phase 3: Production

- **Scope**: All bars and support teams.
- **Checklist**
  - [ ] EF availability green for 24h before launch.
  - [ ] Throttle caps tuned based on pilot data.
  - [ ] Revolut link and payment instructions confirmed by Finance.
  - [ ] Campaign templates locked and approved by Compliance.
  - [ ] Audit log retention configured (≥90 days).
  - [ ] Rollback plan rehearsed (disable campaigns, re-enable legacy tooling).
  - [ ] Monitoring/alerting connected to Ops channel.
  - [ ] Go/No-Go meeting sign-off recorded.
  - [ ] Insurance OCR queue worker deployed (`insurance-ocr` function) and
        processing metrics (attempts/retries) monitored via `insurance_media_queue`.
  - [ ] Synthetic check script wired into production monitoring with alert routing.

## Rollback Signals

- Critical EF outages >30 minutes.
- Redemption failure rate >5% over 15 minutes.
- Policy engine misconfiguration causing mass blocks or sends.
- Support team unable to access Admin Panel for >10 minutes.

## Communication Plan

- Announce staging readiness to engineering + ops mailing list.
- Prior to pilot, share FAQ & training video.
- Production launch accompanied by runbook link and Ops contact rotation.
