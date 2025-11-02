# Operations Runbook

This runbook documents the day-to-day operational checks for easyMO across
preview and production environments.

## 1. Verify Observability Hooks (Staging/Preview)
1. Open the latest Vercel preview URL (available in the PR checklist or the
   `Preview Deployments` workflow summary).
2. Navigate through the SPA and confirm that `RouteObserver` logs appear in the
   browser console (prefixed with `observability`).
3. In the log aggregation tool configured by `VITE_ROUTER_LOG_DRAIN_URL`/`LOG_DRAIN_URL`,
   ensure navigation and API events share the same `trace_id`.
4. Check the metrics drain dashboard for:
   - `router.navigation.duration_ms` samples within the defined SLO
     (`routerSloConfig.latencyTargetMs`).
   - API request metrics meeting the latency/error thresholds exported from
     `sloCatalogue`.
5. Update the PR with findings or raise an incident if SLOs are breached.

## 2. Supabase Migration Review
1. Confirm the `Supabase Drift Check` workflow completed successfully.
2. If it failed, download `.tmp-schema-diff.sql` from the workflow artifacts and
   share the diff with the database owner.
3. Resolve by either applying missing migrations to the preview database or
   committing new migrations. Re-run the workflow to validate.

## 3. Vercel Preview Promotion
1. Ensure `App Quality`, `Lighthouse Audits`, and `Supabase Drift Check` succeed
   on the target commit.
2. From the Vercel dashboard, promote the preview deployment to production
   once stakeholders approve the PR.
3. Verify production log drains receive traffic and update `docs/rollout.md`
   with deployment notes if required.

## 4. Supabase Functions Deployment
1. The preview workflow links to the preview project defined by
   `SUPABASE_FUNCTIONS_PREVIEW_REF` and executes `pnpm run functions:deploy`.
2. After merge, run the same command locally with the production project ref or
   trigger the production Supabase deploy workflow.
3. Validate CloudWatch/Supabase logs for successful cold start counts and
   absence of runtime errors.

## 5. Incident Response Checklist
- Capture the failing trace ID from logs and correlate with router metrics.
- Use `createChildSpan` (if instrumented) to trace secondary operations.
- Roll back via `docs/rollout.md` if production instability persists.
- Record the resolution, affected components, and follow-up tasks in the
  incident tracker.

Keep this runbook close to deployment tooling so operators have a single source
of truth during high-pressure events.
