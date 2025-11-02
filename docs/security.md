# Security Posture

Security controls are layered across development, CI, and production to protect
customer data and operational integrity.

## Secrets management

- Secrets **must only live in env files** that are stored in secure secrets
  managers (Vercel project env, Supabase dashboard, 1Password vault). The repo
  ships with `docs/env/*.example` templates to describe the required keys.
- New CI workflows (`infra/ci/preview-deploy.yml`,
  `infra/ci/supabase-drift.yml`) expect multi-line secrets to be provided via
  encrypted GitHub secrets that mirror the env file contents (for example
  `SUPABASE_PREVIEW_ENV_FILE` and `STAGING_ENV_FILE`).
- Never commit raw secrets or inject them directly into workflow definitions.
  The preview deployment pipeline writes ephemeral files from the encrypted
  inputs and deletes them after use.

## Access controls

- Supabase service roles are restricted to backend services and functions. CI
  jobs enforce `scripts/assert-no-service-role-in-client.mjs` during builds.
- The shared `@easymo/commons` request context propagates trace IDs, session
  identifiers, and user metadata so that log drains can attach access patterns
  to authenticated actors.
- All public endpoints enforce validation and sanitisation through NestJS
  validation pipes (`apps/api/src/main.ts`).

## Observability and incident response

- Structured logging now forwards to external drains when `LOG_DRAIN_URL` is set
  (see `packages/commons/src/logger.ts`). This enables centralised dashboards for
  APIs, Supabase Edge Functions, and the admin router.
- The `scripts/verify-observability-hooks.mjs` helper validates staging env
  files for required observability hooks (`LOG_DRAIN_URL`,
  `METRICS_DRAIN_URL`, `TRACES_EXPORTER_URL`, and Sentry DSNs).
- CI pipelines emit Lighthouse scores and Supabase drift reports as artifacts so
  security reviewers can trace regressions.

## Runtime hardening

- Services default to JSON logging and redact PII through shared helper
  utilities (`config/logging.ts`), allowing log drains to enforce downstream
  data retention rules.
- Preview deployments run against pre-provisioned environment files, ensuring
  that scoped API tokens are used for each environment and can be rotated
  without touching the repository.
