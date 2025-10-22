# PWA Readiness Checklist

This checklist tracks the minimum requirements for deploying the EasyMO admin panel as a Progressive Web App on a standard Node.js hosting platform.

## Platform Configuration

- Enforce Node.js 18.18+ at build and runtime.
- Provide HTTPS endpoints for the public site and any backend APIs consumed by the admin panel.
- Ensure environment variables mirror `.env.example`; secrets should only live in the hosting provider's secret manager.

## Build Settings

- Install dependencies with `pnpm install`.
- Build with `pnpm run build`.
- Start the app using `pnpm run preview -- --host 0.0.0.0 --port 5000` or the platform's recommended process manager.

## Environment Variables

| Variable | Purpose | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase REST endpoint | Runtime & build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key for browser requests | Runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase operations | Runtime (never exposed to the browser) |
| `EASYMO_ADMIN_TOKEN` | Auth token for admin APIs | Runtime |

## Runtime Checks

- Confirm the service worker registers successfully (`pnpm run preview` locally and inspect devtools).
- Validate `manifest.json` includes 192px and 512px icons.
- Verify `theme-color` meta tags in `index.html` or equivalent document head.
- Confirm API routes (`/api/*`) respond with HTTP 200 under expected payloads.
- Exercise smoke tests via `./scripts/smoke-brokerai.sh <base-url>`.

## Rollback Guidance

- Retain the previous container image or build artifact to allow quick redeploys.
- Maintain operational dashboards (Grafana, Supabase logs) to track errors after rollout.
- Document the canonical production URL and the latest successful deployment ID in `docs/deployment/status/`.
