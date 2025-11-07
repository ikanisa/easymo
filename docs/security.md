# Security Baseline

This document records the minimum security controls operators must maintain
while shipping easyMO across local, preview, and production environments.

## Secrets Management
- **Environment files only.** Secrets are stored in `.env`-style files or the
  respective platform secret stores (Netlify, Supabase, CI repository secrets).
  Never commit plaintext secrets to the repository.
- **`.env.example` as the catalogue.** Update `.env.example` when introducing a
  new environment variable so developers can populate local `.env.local`
  without guesswork.
- **Propagate changes consistently.** When adding a secret:
  1. Update `.env.example` (no values, names only).
  2. Populate the secret in Netlify (`Project Settings → Environment Variables`)
     for both Preview and Production.
  3. Populate the secret in Supabase via `supabase secrets set` or the dashboard
     as required.
  4. Document the value’s purpose in the PR summary or runbook if it affects
     incident response.
- **Runtime access.** Server-only secrets must be referenced via `process.env`
  (Next.js/Supabase functions) and may only be exposed to the browser if the
  variable name is prefixed with `NEXT_PUBLIC_`.

## Logging and Telemetry
- **Structured logs.** `withRouteInstrumentation` produces JSON logs and forwards
  metadata to configured drains. Do not introduce ad-hoc `console.*` statements
  in App Router handlers; instead, extend the helper to keep trace propagation
  intact.
- **Sensitive data scrubbing.** Redaction paths can be set via
  `LOG_REDACT_PATHS` (comma-separated) to strip sensitive fields before logs are
  emitted.
- **Drain endpoints.** `LOG_DRAIN_URL`, `METRICS_DRAIN_URL`,
  `VITE_ROUTER_LOG_DRAIN_URL`, and `VITE_ROUTER_METRICS_DRAIN_URL` must point to
  HTTPS endpoints under operator control. Use credentials or IP allow lists if
  the collector is multi-tenant.

## Authentication and Authorisation
- **Header-based auth for APIs.** App Router endpoints expect
  `x-user-id`/`x-user-roles` headers. These headers must be set by the upstream
  proxy (Netlify Edge Middleware) after validating Supabase sessions.
- **Supabase RLS.** Review migration diffs for new tables to ensure policies are
  defined. The CI drift check fails if migrations diverge from the linked
  project.
- **Admin tooling.** Restrict access to Supabase dashboard, Netlify project, and
  GitHub Actions environments to the CODEOWNERS listed in `.github/CODEOWNERS`.

## Incident Response Links
- **Runbooks.** `docs/runbook.md` covers log drain validation, SLO dashboards,
  and Supabase recovery steps.
- **Rollout controls.** `docs/rollout.md` lists release gates and rollback steps
  (including Netlify preview promotion and Supabase migration guardrails).

Keep this document updated whenever secrets move platforms or new telemetry
sinks are introduced.
