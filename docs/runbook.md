# Operations Runbook

This runbook documents day-two operations for EasyMO across staging and
production.

## Monitoring & dashboards

- **Log drains**: All APIs and routers emit structured JSON via
  `@easymo/commons` with trace IDs. Dashboards can ingest the drain payloads from
  the `LOG_DRAIN_URL` endpoint configured per environment.
- **Metrics**: Ensure `METRICS_DRAIN_URL` and `TRACES_EXPORTER_URL` are set in
  staging/production env files. The `scripts/verify-observability-hooks.mjs`
  script validates this during CI preview deployments.
- **Lighthouse CI**: Review artifacts from `infra/ci/lighthouse-audit.yml` to
  monitor Core Web Vitals regressions.
- **Supabase drift**: The `infra/ci/supabase-drift.yml` workflow uploads diff
  reports if the managed database diverges from committed migrations.

## Incident response workflow

1. **Triage**: Use log search (filtered by `trace_id`) to correlate events across
   API, Supabase Functions, and admin router requests.
2. **Escalate**: Notify the owning squad (see `CODEOWNERS`). Use the new
   CODEOWNERS patterns for `infra/ci` and `docs/` to route the alert to platform
   maintainers.
3. **Mitigate**: Roll back via the documented strategy (see
   `docs/rollout.md#rollback-plan`), or deploy a hotfix branch that passes the
   monorepo quality gate (`infra/ci/monorepo-quality.yml`).
4. **Post-incident**: Capture incident notes in `INCIDENT_RUNBOOKS.md` and
   update dashboards if new signals are required.

## Routine tasks

- **Weekly**: Confirm preview deployments succeed with valid env files and that
  Supabase drift reports remain empty.
- **Before releases**: Run Lighthouse audits locally (`npx @lhci/cli autorun`)
  and verify `pnpm build` completes without warnings.
- **After schema changes**: Re-export `latest_schema.sql` and update the
  `MIGRATIONS_CHECKSUM` comment. Ensure the drift workflow passes on the PR.

## Service level objectives

| Surface | Objective | Measurement window | Alerting threshold |
| --- | --- | --- | --- |
| Voice API (`apps/api`) | 99.5% successful responses (<500 ms median) | 30 days | Error rate >0.5% or median latency >500 ms for 3 consecutive hours |
| Admin router (Vercel) | Lighthouse performance score ≥0.8 | Each PR & daily cron | Score <0.75 or major regression (>10%) between deploys |
| Supabase Functions | 99% successful invocations | 30 days | Failure rate >1% for 30 minutes |
| Kafka broker orchestrator | Message e2e latency <5s (p95) | 7 days | Latency breach for two consecutive measurement windows |

## Contact matrix

| Area | Owners |
| --- | --- |
| CI / infra automation | Platform engineering (@ikanisa, @jeanbosco) |
| Supabase Edge Functions | Messaging squad (@ikanisa, @jeanbosco) |
| Admin router | Admin experience squad (@ikanisa) |
| Voice/WhatsApp agents | Conversational AI squad (@jeanbosco) |
