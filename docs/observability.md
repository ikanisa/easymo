Observability
=============

This project wires lightweight observability for the admin app without introducing mandatory runtime dependencies. The following components are available:

- Structured logs: `logStructured` emits JSON to stdout and can optionally forward to a log drain via `LOG_DRAIN_URL`.
- API observability wrapper: All API routes can be wrapped with `createHandler(name, handler)` to gain basic metrics hooks and unified error handling.
- Error boundary: `app/error.tsx` captures unhandled UI errors and reports to the console and (optionally) Sentry.
- Sentry (optional): Client and server helpers lazily import `@sentry/nextjs` when DSN env vars are present.
- Synthetic checks: `tools/monitoring/admin-synthetic-checks.ts` performs HEAD/GET/POST pings to critical endpoints.

Environment variables
---------------------

- `LOG_DRAIN_URL`: If set, server logs are forwarded as JSON POSTs (fire-and-forget).
- `SENTRY_DSN`: Enables server-side Sentry capture via lazy imports.
- `NEXT_PUBLIC_SENTRY_DSN`: Enables client-side Sentry capture in the error boundary.
- `ADMIN_BASE_URL`, `ADMIN_API_TOKEN`: Used by the synthetic checks workflow.

Usage
-----

- Wrap new API routes with `createHandler('namespace.route', async (req, ctx, { recordMetric, log }) => { ... })`.
- Emit logs via `logStructured({ event, target, status, message, details })`.
- Add critical endpoints to `tools/monitoring/admin-synthetic-checks.ts` to expand monitoring coverage.

Notes
-----

- Sentry is optional. No imports are executed unless DSN variables are set. Lazy dynamic import is used to avoid bundle impact in tests.
- You can later replace `recordMetric` no-ops with a StatsD/OTel emitter.

