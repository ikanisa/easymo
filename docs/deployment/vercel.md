# Vercel Deployment Guide

This guide documents how to deploy EasyMO web surfaces to Vercel using the new
preview workflows.

## Prerequisites

- Vercel project with access token stored as `VERCEL_TOKEN` in GitHub secrets.
- Organisation and project IDs stored as `VERCEL_ORG_ID` and
  `VERCEL_PROJECT_ID`.
- Preview environment variables managed via Vercel's env dashboard (no secrets
  checked into git).

## Local verification

1. Populate `.env.local` using the templates in `docs/env/`.
2. Run `pnpm build` to validate the production bundle.
3. Execute Lighthouse locally with `npx @lhci/cli autorun`.

## Continuous deployment

- Pull requests trigger `infra/ci/preview-deploy.yml` which performs:
  1. Install dependencies and run `pnpm build`.
  2. `vercel pull --environment=preview` to sync env files.
  3. `vercel deploy --prebuilt` to publish a preview URL.
- Preview links should be added to the PR description for QA sign-off.
- Production deployments are run from the Vercel dashboard after merging to
  `main`.

## Secrets management

- All environment variables live in Vercel env files. The workflow never stores
  them in plaintext; it only pulls and uses them for the duration of the job.
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
