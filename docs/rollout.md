# Rollout & Deployment Strategy

This document outlines how new features ship safely to staging and production.

## Environments

- **Local**: Developers run `pnpm dev` and Supabase CLI (`supabase start`) with
  secrets sourced from `.env.local`. Shared env templates live under
  `docs/env/`.
- **Staging**: Preview deployments are triggered from PRs via
  `infra/ci/preview-deploy.yml`. Vercel previews use per-branch builds and
  Supabase Functions deploy to a dedicated project reference using the
  `SUPABASE_PREVIEW_ENV_FILE` secret.
- **Production**: Deployed from the default branch after CI passes. Use the same
  env file layout as staging but with production credentials.

## Deployment workflow

1. Open a PR against `main` with an updated changelog entry when appropriate.
2. CI runs linting, type checks, tests, Lighthouse audits, and Supabase drift
   detection.
3. Preview deployments publish a Vercel URL and deploy Supabase functions using
   secrets rendered from env files.
4. After review, squash-and-merge respecting CODEOWNERS. Production deployments
   are initiated via Vercel/Supabase dashboards using the merged commit.

## Rollback plan

- **Vercel**: Roll back to the previous deployment via the Vercel dashboard or
  redeploy a known-good commit using `vercel deploy --prod <deployment-id>`.
- **Supabase Functions**: Redeploy the last stable release tag with
  `supabase functions deploy --project-ref <ref> --import-map supabase/functions/import_map.json`.
- **Database migrations**: Use `pnpm --filter @easymo/db prisma:migrate:resolve`
  to mark a failed migration as rolled back and then re-run the pipeline after
  reverting the offending commit.

## Slow-roll & feature flags

- Use the feature flag utilities from `packages/commons/src/feature-flags.ts`
  to gate risky changes. Flags should default to `false` unless the feature is
  ready for broad release.
- Document flag ownership and expiry in the PR description. Remove stale flags
  during the next release cycle.

## Post-release verification

- Validate that the preview pipeline's observability checks remain green.
- Review Lighthouse scores and Supabase drift reports for anomalies.
- Confirm log drains are receiving traffic tagged with the new release
  trace IDs.
