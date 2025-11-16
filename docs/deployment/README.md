# Deployment guardrails and rollback references

This document summarizes the operator-facing steps we follow for every Netlify deployment of the admin app. It complements `docs/deployment/PRODUCTION_CHECKLIST.md` and the deeper runbooks in `docs/runbooks/` by providing a fast path to the most common controls.

## Pre-deploy validation

Run the consolidated deployment gate to fail fast on common issues:

```bash
pnpm deploy:check
```

The command verifies:

- **Environment completeness** for the admin app (Supabase URLs/keys, alerting webhooks, and the environment label).
- **Schema checksum alignment** between `supabase/migrations` and `latest_schema.sql` so DB drift is caught before release.
- **Service worker + manifest integrity**, ensuring that the manifest icons exist and match the service worker pre-cache list used for offline support.

## Feature flags and progressive delivery

- **Environment label**: Set `NEXT_PUBLIC_ENVIRONMENT_LABEL` in Netlify to clearly distinguish staging vs production in the UI.
- **Supabase webhooks**: `SLA_ALERT_WEBHOOK_URL`, `SUPABASE_CHANNEL_MONITOR_WEBHOOK`, and `AGENT_AUDIT_WEBHOOK_URL` gate error reporting; rotate or disable to pause noisy alerts during maintenance windows.
- **Marketplace access**: Use the marketplace settings API (`/api/marketplace/settings`) to toggle vendor endpoints without a redeploy.
- **Admin offline shell**: Keep `public/manifest.webmanifest` and `public/sw.js` aligned; disabling the service worker temporarily removes offline caching without touching application code.

## Rollback quick actions

- **Netlify instant rollback**: Promote the previous successful deploy in the Netlify UI. Smoke tests (`pnpm smoke:netlify`) can target the chosen deploy URL via `SMOKE_BASE_URL` to confirm health before re-promoting DNS.
- **Database state**: Because schema checksums gate deploys, failed DB migrations should be rolled back by re-applying the last known-good `latest_schema.sql` and re-running migrations from the matched commit.
- **Feature-flag rollback**: Revert environment labels or disable marketplace endpoints first; then promote the last stable deploy if functional parity isn’t restored.
- **Operator comms**: When rolling back, post the deploy URL and the smoke-test result summary to the incident channel so responders can coordinate redirects or cache invalidation.

## Post-deploy smoke tests

Netlify runs `pnpm smoke:netlify` after builds using the current `DEPLOY_URL`/`DEPLOY_PRIME_URL`. You can also execute it manually:

```bash
SMOKE_BASE_URL=https://your-preview-or-prod-url pnpm smoke:netlify
```

Endpoints covered:

- `/login`
- `/dashboard`
- `/api/live-calls`
- `/marketplace`
- `/marketplace/settings`
- `/api/marketplace/settings`

Failures return non-zero to fail the pipeline or local shell, keeping bad deploys from being promoted.
