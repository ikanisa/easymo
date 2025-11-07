# Netlify Deployment Documentation

Netlify now hosts every public admin surface. This guide captures the
configuration, CI workflow, and operational expectations for the site at
`https://easymo-admin.netlify.app` (production sites usually attach the custom
domain `easymo.ikanisa.com`).

## Build Overview

| Setting | Value |
| --- | --- |
| Build command | `pnpm netlify:build` |
| Publish directory | `admin-app/.next` |
| Node version | `18.18.0` |
| Package manager | `pnpm` (via `NETLIFY_USE_PNPM=true`) |
| Next.js adapter | `@netlify/plugin-nextjs` |

Before each build Netlify installs workspace dependencies, builds shared UI
packages (`@va/shared`, `@easymo/commons`, `@easymo/ui`), and then executes
`next build` inside `admin-app`.

## Environment Variables

Add the following site-level variables in the Netlify dashboard (Settings →
Environment):

| Name | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL used by the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for API routes |
| `ADMIN_SESSION_SECRET` | Signs the admin session cookie |
| `ADMIN_ACCESS_CREDENTIALS` | JSON array with admin email/password pairs |
| `EASYMO_ADMIN_TOKEN` | Shared token for Supabase Edge Functions |
| `ADMIN_SESSION_TTL_SECONDS` | Session lifetime (default 43200) |

Netlify separates Production/Deploy Preview/Branch Deploy contexts—mirror the
values for each context or intentionally scope them when testing new secrets.

## CI + Deploy Flow

1. GitHub Actions run unit tests, linting, and type checks on every PR. The
   workflows are Netlify-agnostic and simply guarantee that `pnpm build` works.
2. When code merges to `main`, Netlify automatically creates a Deploy Preview
   and production build. The preview URL is posted back to the PR.
3. Production releases happen once the Netlify deploy promoting the custom
   domain is marked successful. Rollbacks use Netlify's "Publish deploy" option.

## Custom Domains

1. Add `easymo.ikanisa.com` under Site settings → Domain management.
2. Point the `CNAME` record to `<site>.netlify.app`.
3. Netlify issues certificates automatically through Let's Encrypt; no external
   proxying or tunnels are required.

## Headers & Redirects

`admin-app/public/_headers` ships strict security headers (CSP, HSTS,
Permissions Policy). Netlify reads this file automatically, so no extra settings
are required in the dashboard.

## Observability

- **Logs:** Netlify streams build/runtime logs in the dashboard. For permanent
  storage, configure `LOG_DRAIN_URL` so the app forwards structured JSON to your
  preferred sink.
- **Health checks:** `admin-app` exposes `/api/health` which Netlify monitors
  through Synthetic Monitoring (`synthetic-checks.yml`).
- **Analytics:** Use Netlify Analytics or hook the existing `synthetic-checks`
  job into your Grafana stack.

## Troubleshooting

| Issue | Resolution |
| --- | --- |
| Build exceeds 15 minutes | Ensure workspace deps are cached (Netlify automatically caches `~/.pnpm-store`). If needed, split the Netlify build into two commands (`pnpm install && pnpm netlify:build`). |
| 404s on dynamic routes | Confirm `@netlify/plugin-nextjs` is enabled and that `next build` completes without errors. |
| Environment variable missing | Double-check the Environment tab for the correct context (Production vs. Deploy Preview). |

For more operational procedures (release approvals, Supabase migrations, etc.)
see `docs/deployment/production-pipeline.md`.
