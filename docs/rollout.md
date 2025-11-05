# Rollout Strategy

This guide outlines the phased rollout approach for easyMO and the checks we run
before, during, and after promoting a build to production.

## Phase 0 – Branch Readiness
- Confirm the PR follows the template checkboxes (lint/test/build, Supabase drift
  review, observability verification, secrets documented).
- Ensure at least one CODEOWNER review is recorded for affected areas.

## Phase 1 – Preview Validation
1. The `Preview Deployments` workflow posts a Vercel preview URL and confirms
   Supabase Functions deploy to the preview project.
2. Product owners review the preview build, using the runbook to validate:
   - Router navigation SLOs within target.
   - API latency/error metrics within thresholds.
   - No missing environment variables.
3. Collect QA feedback and iterate until acceptance criteria pass.

## Phase 2 – Staging Gate (Optional)
- If a staging environment exists, redeploy the preview artefact to staging and
  re-run the observability checks against staging drains.
- Record staging results (links to dashboards, Supabase migration status) in the
  PR comments or `docs/deployment/status/<date>.md`.

## Phase 3 – Production Promotion
1. Promote the approved Vercel preview deployment to production once App Quality,
   Lighthouse, and Supabase drift workflows are green.
2. Apply database migrations (if any) using Supabase CLI against production.
3. Trigger Supabase Functions deployment to the production project ref.
4. Monitor production dashboards for 30 minutes, ensuring the SLO gauges remain
   within budget. Capture trace IDs for any anomalies.

## Phase 4 – Post-Deployment
- Update `CHANGELOG.md` or release notes with key user-facing changes.
- Document the production deployment (timestamp, preview URL, Supabase project
  ref) in `docs/deployment/status/`.
- File follow-up issues for any known gaps observed during rollout.

## Rollback Plan
- **Vercel:** Use the Vercel dashboard to roll back to the previous deployment
  (history tab) or redeploy the prior commit via `vercel deploy --prebuilt`.
- **Supabase Migrations:** Run `supabase migration down <version>` or apply the
  relevant down migration scripts.
- **Supabase Functions:** Deploy the last known-good function artefact using
  `supabase functions deploy ... --project-ref <production ref> --import-map`.
- **Observability:** Annotate dashboards with the rollback timestamp to assist in
  postmortem analysis.

Maintain this document as the canonical release process so every stakeholder can
follow the same steps for future launches.
