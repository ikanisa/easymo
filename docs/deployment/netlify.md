# Netlify Deployment Guide

This guide documents how to deploy EasyMO web surfaces to Netlify using the new
preview workflows.

## Prerequisites

- Netlify site with an access token stored as `NETLIFY_AUTH_TOKEN` in GitHub
  secrets.
- Netlify site ID stored as `NETLIFY_SITE_ID`.
- Preview environment variables managed via Netlify's env dashboard (no secrets
  checked into git).

## Local verification

1. Populate `.env.local` using the templates in `docs/env/`.
2. Run `pnpm build` to validate the production bundle.
3. Execute Lighthouse locally with `npx @lhci/cli autorun`.

## Continuous deployment

- Pull requests trigger `infra/ci/preview-deploy.yml` which performs:
  1. Install dependencies and run `pnpm build`.
  2. `netlify env:list` to verify required variables.
  3. `netlify deploy --build --context=deploy-preview` to publish a preview URL.
- Preview links should be added to the PR description for QA sign-off.
- Production deployments are run from the Netlify dashboard after merging to
  `main`.

## Secrets management

- All environment variables live in Netlify env files. The workflow never stores
  them in plaintext; it only reads them for the duration of the job.
- For Supabase Edge Functions, provide the preview env file content via the
  `SUPABASE_PREVIEW_ENV_FILE` GitHub secret. The workflow writes it to
  `supabase/.tmp/preview.env` and removes it after deployment.

## Post-deploy validation

- Verify the preview URL loads without console errors and that API calls include
  trace headers (`x-request-id`, `x-trace-id`).
- Confirm the observability hook check passes (see CI logs for
  `verify-observability-hooks`).
- After production deploys, monitor the log drain dashboard to ensure new
  traffic is tagged with the latest release commit.
