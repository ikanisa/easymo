# Staging Launch Preparation Checklist

This document captures the pre-launch activities requested for the current staging release. Since the automation environment cannot access the staging infrastructure directly, the following checklists are provided for the engineering team to execute and record outcomes.

## 1. Supabase migrations and regression testing
- [ ] Re-run the latest Supabase migrations against the staging instance using `supabase db push` or the migration runner defined in `deploy_to_supabase.md`.
- [ ] Confirm that schema versions align with `latest_schema.sql` once the migrations complete.
- [ ] Execute the webhook regression suite via `./test-ai-agents-wa-webhook.sh` and capture logs in the release notes.
- [ ] Execute the PWA regression suites for both `waiter-pwa` and `real-estate-pwa` using `pnpm test --filter waiter-pwa` and `pnpm test --filter real-estate-pwa` respectively.
- [ ] Run the admin regression tests in `admin-app` with `pnpm --filter admin-app test` and archive results in the staging QA report.

## 2. Observability validation
- [ ] Inspect staging Grafana dashboards (traffic, latency, database health) to ensure metrics reflect recent test activity.
- [ ] Validate rate-limit metrics by triggering representative traffic and confirming limits appear in the `Rate Limits` dashboard.
- [ ] Hit all service health endpoints (`/healthz`, `/readyz`, Supabase status) and record HTTP 200 responses with timestamps.

## 3. Security review
- [ ] Review Supabase row-level security policies to ensure tables touched by the release retain least-privilege guarantees.
- [ ] Confirm secret storage for environment variables matches the guidance in `docs/SECURITY_TESTING.md` (no secrets checked into source control, rotation schedule current).
- [ ] Verify WhatsApp integration remains compliant with current Meta policies (opt-in handling, message templates, retention windows) and document findings.

## 4. Launch playbook updates
- [ ] Update rollback procedures referencing `docs/ROLLBACK_PROCEDURES.md` with any new contingencies discovered during testing.
- [ ] Ensure the on-call runbook lists current escalation paths, tooling links, and staging-to-production promotion steps.
- [ ] Review monitoring thresholds and alerts, documenting any adjustments required before the production push.

_This checklist should be completed and signed off before the staging build is promoted to production._
